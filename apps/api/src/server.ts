import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { loadEnv } from "./lib/env.js";
import { createSupabaseAdminClient } from "./lib/supabase.js";
import { createAuthPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";

async function main() {
  const env = loadEnv();

  const fastify = Fastify({
    logger: {
      transport:
        env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
  });

  await fastify.register(cors, { origin: env.CORS_ORIGIN });
  await fastify.register(multipart);

  const supabaseAdmin = createSupabaseAdminClient(env);
  fastify.decorate("supabaseAdmin", supabaseAdmin);
  await fastify.register(createAuthPlugin(supabaseAdmin));

  await fastify.register(healthRoutes);
  // Registered in later phases: contracts, clauses, risk-flags, eval routes.

  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
}

declare module "fastify" {
  interface FastifyInstance {
    supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
