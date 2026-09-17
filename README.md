# ClauseGuard

A contract compliance and risk extraction agent for commercial legal documents. ClauseGuard extracts key clauses from a contract, flags deviations from a configurable risk policy, and grounds every claim in the exact source text it was drawn from, so a reviewer can verify a finding in seconds instead of rereading the whole document.

Live demo: https://clauseguard-self.vercel.app

Built and evaluated against the Contract Understanding Atticus Dataset (CUAD): 510 commercial contracts with over 13,000 expert clause annotations, used as ground truth for measuring extraction accuracy.

## How to use it

1. Go to the live demo link above and create an account (email confirmation is required, so use a real email address).
2. From the dashboard, open **Contracts** to browse the seeded CUAD corpus, or **Upload** to submit your own `.txt` contract (2MB max).
3. Uploading a contract runs live extraction against Claude for the 10 tracked clause categories, then evaluates the result against the configured risk policy.
4. Open a contract's detail page to see the source text alongside a clause checklist. Clicking a present clause scrolls to and highlights its exact grounded span in the source text.
5. The **Risk Flags** tab on a contract lists policy deviations by severity (info, warning, critical).
6. **Eval Metrics** shows precision, recall, F1, hallucination rate, and abstention accuracy, scored against CUAD's expert labels, broken down per clause category.

## Architecture

- **`apps/web`**: Next.js 14 dashboard (App Router, Server Components, Server Actions). Deployed on Vercel.
- **`apps/api`**: Fastify REST API exposing contracts, clauses, risk flags, and eval reports over a bearer-token-authenticated interface. Deployed on Railway.
- **`packages/schemas`**: Shared Zod schemas and types for clauses, contracts, risk policy, and eval reports.
- **`packages/ingestion`**: CUAD dataset loading and chunking.
- **`packages/extraction`**: Claude-based clause extraction with a hallucination guard. The model returns a verbatim quote; the code independently grounds it against the source text (exact match, then whitespace-normalized fallback) before accepting it as present, computing real character offsets rather than trusting model-reported positions.
- **`packages/risk-engine`**: YAML-configurable risk policy engine (`policy/default.yaml`).
- **`packages/eval`**: Precision/recall/F1, hallucination rate, and abstention accuracy scoring against CUAD ground truth.
- **Database**: Supabase (Postgres, pgvector, Auth), hosted on Supabase Cloud in production.

## Local development

Requires Node.js, Docker (for local Supabase), and a Claude API key for live extraction.

```bash
npm install
npx supabase start          # local Postgres, Auth, Studio
cp .env.example .env        # fill in Supabase and Anthropic keys
cp apps/web/.env.local.example apps/web/.env.local

npm run seed:cuad           # seed the CUAD corpus and ground-truth labels
npm run dev:web             # dashboard at localhost:3000 (or next free port)
npm run dev:api             # API at localhost:4000
```

Other useful scripts from the repo root:

```bash
npm run typecheck           # typecheck every workspace package
npm run extract:clauses     # run live extraction against pending contracts
npm run evaluate:risk       # run the risk policy engine against extracted clauses
npm run run:eval            # score extraction output against CUAD ground truth
```
