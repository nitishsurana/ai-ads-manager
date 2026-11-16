create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.testers (user_id) on delete cascade,
  workspace_id uuid,
  campaign jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.testers (user_id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  product_key text not null,
  source_url text not null,
  phase text not null default 'confirm' check (phase in ('confirm', 'rounds')),
  product jsonb not null,
  confirmed jsonb,
  campaign jsonb not null default '{}',
  brand_kit_scraped jsonb not null,
  brand_kit jsonb not null,
  logo jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workspaces_user_product_key_idx
  on public.workspaces (user_id, product_key)
  where deleted_at is null;
create index workspaces_thread_id_idx on public.workspaces (thread_id);

alter table public.threads
  add constraint threads_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete set null;
create index threads_user_id_idx on public.threads (user_id);

create table public.intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.testers (user_id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  url text not null,
  product_key text,
  status text not null default 'reading' check (status in ('reading', 'failed', 'done')),
  progress jsonb,
  failure_code text,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  progress_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((status = 'failed') = (failure_code is not null)),
  check (status <> 'done' or workspace_id is not null),
  check ((status = 'reading') = (finished_at is null))
);

create index intakes_thread_id_idx on public.intakes (thread_id);
create index intakes_workspace_id_idx on public.intakes (workspace_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  ui_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  kind text not null check (kind in ('chat', 'research', 'brief_update', 'status', 'divider', 'summary')),
  parts jsonb not null,
  created_at timestamptz not null default now(),
  unique (thread_id, ui_id)
);

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  text text not null,
  kind text not null check (kind in ('offer', 'other')),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  created_at timestamptz not null default now()
);

create index facts_thread_id_idx on public.facts (thread_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.intakes (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  position integer not null check (position > 0),
  source_url text not null,
  orig_width integer not null,
  orig_height integer not null,
  work_path text not null,
  thumb_path text not null,
  sha256 text not null,
  phash text not null,
  checks jsonb not null,
  tier text not null check (tier in ('clean', 'clean_low_res', 'added_text')),
  product_bbox jsonb,
  cutout_path text,
  mask_path text,
  dropped boolean not null default false,
  drop_reason text check (drop_reason in ('text_card', 'multiple_products', 'text_over_product', 'product_cropped', 'mask_not_one_shape')),
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (intake_id, position),
  check (dropped = (drop_reason is not null)),
  check (not (dropped and selected))
);

create index photos_workspace_id_idx on public.photos (workspace_id);

-- round_id gets its foreign key when rounds exist.
create table public.costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.testers (user_id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  intake_id uuid references public.intakes (id) on delete set null,
  round_id uuid,
  provider text not null check (provider in ('ai', 'fal', 'firecrawl')),
  model text,
  usd numeric(12, 6) check (usd >= 0),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index costs_user_created_idx on public.costs (user_id, created_at);
create index costs_intake_id_idx on public.costs (intake_id);

alter table public.threads enable row level security;
alter table public.workspaces enable row level security;
alter table public.intakes enable row level security;
alter table public.messages enable row level security;
alter table public.facts enable row level security;
alter table public.photos enable row level security;
alter table public.costs enable row level security;

revoke all on public.threads, public.workspaces, public.intakes, public.messages,
  public.facts, public.photos, public.costs from anon, authenticated;
grant select, insert, update, delete on public.threads, public.workspaces,
  public.intakes, public.messages, public.facts, public.photos, public.costs
  to service_role;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false), ('cutouts', 'cutouts', false), ('logos', 'logos', false)
on conflict (id) do nothing;
