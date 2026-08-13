-- Contracts and CUAD ground-truth clause labels.
-- clause_labels holds CUAD's expert annotations for the 10 target categories
-- (used as eval ground truth); the agent's own extractions live in a
-- separate `clauses` table added in Phase 2, so the two can be compared.

create table if not exists public.contracts (
  id uuid primary key default extensions.uuid_generate_v4(),
  file_name text not null,
  source_text text not null,
  cuad_doc_id text unique,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create type public.clause_category as enum (
  'Governing Law',
  'Termination For Convenience',
  'Cap On Liability',
  'Uncapped Liability',
  'Non-Compete',
  'Exclusivity',
  'Ip Ownership Assignment',
  'Anti-Assignment',
  'Change Of Control',
  'Insurance'
);

create table if not exists public.clause_labels (
  id uuid primary key default extensions.uuid_generate_v4(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  category public.clause_category not null,
  is_present boolean not null,
  source_text text,
  start_char integer,
  end_char integer,
  created_at timestamptz not null default now(),
  unique (contract_id, category),
  check (
    (is_present and source_text is not null and start_char is not null and end_char is not null)
    or (not is_present and source_text is null and start_char is null and end_char is null)
  )
);

create index if not exists clause_labels_contract_id_idx on public.clause_labels (contract_id);
create index if not exists clause_labels_category_idx on public.clause_labels (category);

alter table public.contracts enable row level security;
alter table public.clause_labels enable row level security;

-- MVP single-tenant policy: any authenticated user can read all contracts/labels.
-- Writes go through the API's service-role client, which bypasses RLS.
create policy "Authenticated users can read contracts"
  on public.contracts for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read clause labels"
  on public.clause_labels for select
  using (auth.role() = 'authenticated');
