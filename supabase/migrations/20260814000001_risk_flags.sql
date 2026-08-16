-- Deviations between extracted clauses and the YAML policy config.
create type public.risk_severity as enum ('info', 'warning', 'critical');

create table if not exists public.risk_flags (
  id uuid primary key default extensions.uuid_generate_v4(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  rule_id text not null,
  category public.clause_category not null,
  severity public.risk_severity not null,
  message text not null,
  clause_source_text text,
  policy_version integer not null,
  created_at timestamptz not null default now(),
  -- One flag per rule per contract per policy version: re-evaluating under an
  -- unchanged policy version upserts in place rather than accumulating duplicates.
  unique (contract_id, rule_id, policy_version)
);

create index if not exists risk_flags_contract_id_idx on public.risk_flags (contract_id);
create index if not exists risk_flags_severity_idx on public.risk_flags (severity);

alter table public.risk_flags enable row level security;

create policy "Authenticated users can read risk flags"
  on public.risk_flags for select
  using (auth.role() = 'authenticated');
