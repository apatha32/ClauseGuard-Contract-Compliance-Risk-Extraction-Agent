-- Agent-extracted clauses, distinct from clause_labels (CUAD ground truth).
-- Every present row's source_text/start_char/end_char is verified against
-- the contract's source_text before being written here: the extraction
-- pipeline downgrades any claim it cannot ground to is_present = false
-- rather than store an unverified span.
create table if not exists public.clauses (
  id uuid primary key default extensions.uuid_generate_v4(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  category public.clause_category not null,
  is_present boolean not null,
  source_text text,
  start_char integer,
  end_char integer,
  summary text,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  unique (contract_id, category, model, prompt_version),
  check (
    (is_present and source_text is not null and start_char is not null and end_char is not null)
    or (not is_present and source_text is null and start_char is null and end_char is null)
  )
);

create index if not exists clauses_contract_id_idx on public.clauses (contract_id);
create index if not exists clauses_category_idx on public.clauses (category);

alter table public.clauses enable row level security;

create policy "Authenticated users can read clauses"
  on public.clauses for select
  using (auth.role() = 'authenticated');
