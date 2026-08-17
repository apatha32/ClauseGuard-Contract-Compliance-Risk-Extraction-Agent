import type { FastifyReply, FastifyRequest } from "fastify";

/** Route-level guard: 401s unless the auth plugin resolved a userId from the bearer token. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) {
    return reply.code(401).send({ error: "Not authenticated." });
  }
}
