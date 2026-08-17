import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/require-auth.js";

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const evalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", requireAuth);

  fastify.get("/eval-reports", async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { data, error } = await fastify.supabaseAdmin
      .from("eval_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);
    if (error) return reply.code(500).send({ error: error.message });

    return { evalReports: data ?? [] };
  });
};
