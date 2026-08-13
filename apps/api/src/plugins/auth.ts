import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
  }
}

/**
 * Decorates each request with `userId`, resolved by verifying the bearer
 * token against Supabase. Does not itself reject unauthenticated requests —
 * routes that require auth should check `request.userId` and 401 if null.
 */
export function createAuthPlugin(adminClient: SupabaseClient): FastifyPluginAsync {
  const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorateRequest("userId", null);

    fastify.addHook("onRequest", async (request) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return;

      const token = authHeader.slice("Bearer ".length);
      const { data, error } = await adminClient.auth.getUser(token);
      if (!error && data.user) {
        request.userId = data.user.id;
      }
    });
  };

  return fp(plugin);
}
