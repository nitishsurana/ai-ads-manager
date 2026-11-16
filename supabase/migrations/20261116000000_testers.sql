create table public.testers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  is_golden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.testers enable row level security;

revoke all on public.testers from anon, authenticated;
