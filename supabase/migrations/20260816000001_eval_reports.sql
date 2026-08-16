-- Eval harness output (packages/eval), persisted so the dashboard can chart
-- runs over time without re-parsing local JSON/markdown report files.
create table if not exists public.eval_reports (
  id uuid primary key default extensions.uuid_generate_v4(),
  run_id text not null unique,
  model text not null,
  prompt_version text not null,
  contracts_evaluated integer not null,
  precision numeric not null,
  recall numeric not null,
  f1 numeric not null,
  hallucination_rate numeric not null,
  abstention_accuracy numeric not null,
  per_category jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists eval_reports_created_at_idx on public.eval_reports (created_at desc);

alter table public.eval_reports enable row level security;

create policy "Authenticated users can read eval reports"
  on public.eval_reports for select
  using (auth.role() = 'authenticated');
