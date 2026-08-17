import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../lib/require-auth.js";

export const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", requireAuth);

  fastify.get("/stats", async (_request, reply) => {
    const [
      { count: contractsCount },
      { count: clauseLabelsCount },
      { count: clausesCount },
      { count: riskFlagsCount },
      { count: criticalFlagsCount },
    ] = await Promise.all([
      fastify.supabaseAdmin.from("contracts").select("*", { count: "exact", head: true }),
      fastify.supabaseAdmin.from("clause_labels").select("*", { count: "exact", head: true }),
      fastify.supabaseAdmin.from("clauses").select("*", { count: "exact", head: true }),
      fastify.supabaseAdmin.from("risk_flags").select("*", { count: "exact", head: true }),
      fastify.supabaseAdmin.from("risk_flags").select("*", { count: "exact", head: true }).eq("severity", "critical"),
    ]);

    const { count: extractedContractsCount, error } = await fastify.supabaseAdmin
      .from("clauses")
      .select("contract_id", { count: "exact", head: true });
    if (error) return reply.code(500).send({ error: error.message });

    return {
      contractsCount: contractsCount ?? 0,
      clauseLabelsCount: clauseLabelsCount ?? 0,
      clausesCount: clausesCount ?? 0,
      riskFlagsCount: riskFlagsCount ?? 0,
      criticalFlagsCount: criticalFlagsCount ?? 0,
      extractedContractsCount: extractedContractsCount ?? 0,
    };
  });
};
