import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => ({ status: "ok" }));
};
