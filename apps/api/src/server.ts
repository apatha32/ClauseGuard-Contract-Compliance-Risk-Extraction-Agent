import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { loadEnv } from "./lib/env.js";
import { createSupabaseAdminClient } from "./lib/supabase.js";
import { createAuthPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { contractRoutes } from "./routes/contracts.js";
import { evalRoutes } from "./routes/eval.js";
import { statsRoutes } from "./routes/stats.js";

async function main() {
  const env = loadEnv();

  const fastify = Fastify({
    logger: {
      transport:
        env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
  });

  await fastify.register(cors, { origin: env.CORS_ORIGIN });
  await fastify.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });

  const supabaseAdmin = createSupabaseAdminClient(env);
  fastify.decorate("supabaseAdmin", supabaseAdmin);
  await fastify.register(createAuthPlugin(supabaseAdmin));

  await fastify.register(healthRoutes);
  await fastify.register(contractRoutes);
  await fastify.register(evalRoutes);
  await fastify.register(statsRoutes);

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
