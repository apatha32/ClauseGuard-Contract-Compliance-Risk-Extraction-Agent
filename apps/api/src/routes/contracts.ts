import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { extractClauses, EXTRACTION_MODEL, PROMPT_VERSION } from "@clauseguard/extraction";
import { parsePolicyConfig, evaluateContract, type ClauseInput } from "@clauseguard/risk-engine";
import { requireAuth } from "../lib/require-auth.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — plenty for a text contract
const PLACEHOLDER_KEY = "dummy-anthropic-key";

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

const IdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const contractRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", requireAuth);

  fastify.get("/contracts", async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    const { page, pageSize, search } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = fastify.supabaseAdmin
      .from("contracts")
      .select("id, file_name, cuad_doc_id, created_at", { count: "exact" })
      .order("created_at", { ascending: true })
      .range(from, to);

    if (search) {
      query = query.ilike("file_name", `%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });

    return { contracts: data ?? [], total: count ?? 0, page, pageSize };
  });

  fastify.get("/contracts/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid contract id." });

    const { data, error } = await fastify.supabaseAdmin
      .from("contracts")
      .select("id, file_name, cuad_doc_id, created_at, source_text")
      .eq("id", params.data.id)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: "Contract not found." });

    return data;
  });

  fastify.get("/contracts/:id/clauses", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid contract id." });

    const { data, error } = await fastify.supabaseAdmin
      .from("clauses")
      .select("id, category, is_present, source_text, start_char, end_char, summary, model, prompt_version")
      .eq("contract_id", params.data.id);
    if (error) return reply.code(500).send({ error: error.message });

    return { clauses: data ?? [] };
  });

  fastify.get("/contracts/:id/risk-flags", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid contract id." });

    const { data, error } = await fastify.supabaseAdmin
      .from("risk_flags")
      .select("id, rule_id, category, severity, message, clause_source_text")
      .eq("contract_id", params.data.id)
      .order("severity", { ascending: true });
    if (error) return reply.code(500).send({ error: error.message });

    return { riskFlags: data ?? [] };
  });

  fastify.post("/contracts", async (request, reply) => {
    const uploaded = await request.file();
    if (!uploaded) return reply.code(400).send({ error: "No file provided." });

    if (!uploaded.filename.toLowerCase().endsWith(".txt")) {
      return reply.code(400).send({ error: "Only .txt files are supported right now." });
    }

    const buffer = await uploaded.toBuffer();
    if (buffer.byteLength > MAX_FILE_BYTES) {
      return reply.code(400).send({ error: "File is too large (max 2MB)." });
    }

    const sourceText = buffer.toString("utf-8").trim();
    if (!sourceText) return reply.code(400).send({ error: "File is empty." });

    const { data: contract, error: insertError } = await fastify.supabaseAdmin
      .from("contracts")
      .insert({ file_name: uploaded.filename, source_text: sourceText, uploaded_by: request.userId })
      .select("id")
      .single();

    if (insertError || !contract) {
      return reply.code(500).send({ error: insertError?.message ?? "Failed to save contract." });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    let extractionRan = false;
    let riskFlagsCreated = 0;

    if (apiKey && apiKey !== PLACEHOLDER_KEY) {
      try {
        const clauses = await extractClauses({ sourceText, apiKey });
        await fastify.supabaseAdmin.from("clauses").upsert(
          clauses.map((clause) => ({
            contract_id: contract.id,
            category: clause.category,
            is_present: clause.present,
            source_text: clause.present ? clause.sourceText : null,
            start_char: clause.present ? clause.startChar : null,
            end_char: clause.present ? clause.endChar : null,
            summary: clause.present ? clause.summary : clause.reason,
            model: EXTRACTION_MODEL,
            prompt_version: PROMPT_VERSION,
          })),
          { onConflict: "contract_id,category,model,prompt_version" },
        );
        extractionRan = true;

        const policyYaml = await readFile(path.join(process.cwd(), "../../policy/default.yaml"), "utf-8");
        const policy = parsePolicyConfig(policyYaml);
        const clauseInputs: ClauseInput[] = clauses.map((c) => ({
          category: c.category,
          isPresent: c.present,
          sourceText: c.present ? c.sourceText : null,
        }));
        const flags = evaluateContract(contract.id, clauseInputs, policy);
        if (flags.length > 0) {
          await fastify.supabaseAdmin.from("risk_flags").upsert(
            flags.map((f) => ({
              contract_id: f.contractId,
              rule_id: f.ruleId,
              category: f.category,
              severity: f.severity,
              message: f.message,
              clause_source_text: f.clauseSourceText,
              policy_version: f.policyVersion,
            })),
            { onConflict: "contract_id,rule_id,policy_version" },
          );
          riskFlagsCreated = flags.length;
        }
      } catch (err) {
        // Contract is already saved — surface the extraction failure without
        // failing the whole upload.
        fastify.log.error({ err, contractId: contract.id }, "Extraction failed for upload");
      }
    }

    return reply.code(201).send({ contractId: contract.id, extractionRan, riskFlagsCreated });
  });
};
