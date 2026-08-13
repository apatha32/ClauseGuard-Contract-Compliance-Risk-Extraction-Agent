-- Paragraph-level chunks with Voyage embeddings (voyage-law-2, 1024 dims)
-- for hybrid retrieval: exact clause-type language matters as much as
-- semantic similarity, so this sits alongside full-text search on contracts.
create table if not exists public.contract_chunks (
  id uuid primary key default extensions.uuid_generate_v4(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  start_char integer not null,
  end_char integer not null,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  unique (contract_id, chunk_index)
);

create index if not exists contract_chunks_contract_id_idx on public.contract_chunks (contract_id);

create index if not exists contract_chunks_embedding_idx
  on public.contract_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.contract_chunks enable row level security;

create policy "Authenticated users can read contract chunks"
  on public.contract_chunks for select
  using (auth.role() = 'authenticated');
