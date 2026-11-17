-- Composite foreign keys below keep user_id on briefs, rounds and creatives equal to their workspace's owner.
alter table public.workspaces
  add constraint workspaces_id_user_id_key unique (id, user_id);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  version integer not null check (version > 0),
  cause text not null check (cause in ('initial', 'chat', 'round', 'tester_edit')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, version),
  foreign key (workspace_id, user_id)
    references public.workspaces (id, user_id) on delete cascade
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  n integer not null check (n > 0),
  attempt integer not null check (attempt > 0),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'timed_out', 'no_pass')),
  stage text check (stage in ('writing_copy', 'making_backgrounds', 'compositing', 'checking_quality')),
  progress jsonb not null default '{}',
  inputs jsonb not null,
  brief_version integer not null check (brief_version > 0),
  started_at timestamptz not null,
  running_at timestamptz,
  deadline_at timestamptz,
  finished_at timestamptz,
  error text,
  unique (workspace_id, n, attempt),
  unique (id, user_id),
  foreign key (workspace_id, user_id)
    references public.workspaces (id, user_id) on delete cascade,
  foreign key (workspace_id, brief_version)
    references public.briefs (workspace_id, version),
  check ((status in ('queued', 'running')) = (finished_at is null)),
  check (status <> 'queued' or running_at is null),
  check (status not in ('running', 'done', 'timed_out', 'no_pass') or running_at is not null),
  check (status <> 'timed_out' or deadline_at is not null)
);

create unique index rounds_one_active_idx
  on public.rounds (workspace_id)
  where status in ('queued', 'running');
create index rounds_user_active_idx
  on public.rounds (user_id)
  where status in ('queued', 'running');
create index rounds_user_running_at_idx
  on public.rounds (user_id, running_at)
  where running_at is not null;

create index intakes_user_reading_idx
  on public.intakes (user_id)
  where status = 'reading';

create table public.creatives (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null,
  user_id uuid not null,
  n integer not null check (n > 0),
  angle text not null
    check (angle in ('benefit', 'social_proof', 'price', 'offer', 'lifestyle', 'feature_close_up')),
  photo_id uuid references public.photos (id) on delete set null,
  background jsonb not null,
  supporting_element text check (supporting_element in ('price', 'rating', 'offer')),
  copy jsonb not null,
  -- layout and background_path stay null until the text layer and backgrounds exist (Phase 6c).
  layout jsonb,
  background_path text,
  preview_path text not null,
  judge jsonb,
  rating text check (rating in ('approve', 'reject')),
  tags text[] not null default '{}',
  note text,
  edits jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (round_id, n),
  foreign key (round_id, user_id)
    references public.rounds (id, user_id) on delete cascade
);

create index creatives_photo_id_idx on public.creatives (photo_id);

alter table public.costs
  add constraint costs_round_id_fkey
  foreign key (round_id) references public.rounds (id) on delete set null;
create index costs_round_id_idx on public.costs (round_id);

alter table public.briefs enable row level security;
alter table public.rounds enable row level security;
alter table public.creatives enable row level security;

revoke all on public.briefs, public.rounds, public.creatives from anon, authenticated;
grant select, insert, update, delete on public.briefs, public.rounds,
  public.creatives to service_role;

insert into storage.buckets (id, name, public)
values
  ('backgrounds', 'backgrounds', false),
  ('previews', 'previews', false),
  ('fonts', 'fonts', false),
  ('exports', 'exports', false)
on conflict (id) do nothing;

-- Appends a brief version only when the workspace's latest version is still p_base_version (0 when none exists yet); returns the new version, or null when someone else wrote first.
create function public.add_brief_version(
  p_user_id uuid,
  p_workspace_id uuid,
  p_cause text,
  p_content jsonb,
  p_base_version integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_latest integer;
begin
  perform 1 from public.workspaces
  where id = p_workspace_id and user_id = p_user_id and deleted_at is null
  for update;
  if not found then
    raise exception 'workspace % not found', p_workspace_id;
  end if;

  select coalesce(max(version), 0) into v_latest
  from public.briefs where workspace_id = p_workspace_id;
  if v_latest <> p_base_version then
    return null;
  end if;

  insert into public.briefs (workspace_id, user_id, version, cause, content)
  values (p_workspace_id, p_user_id, v_latest + 1, p_cause, p_content);
  return v_latest + 1;
end;
$$;

-- Inserts a queued round and moves the workspace to its rounds phase in one transaction. Returns the round id, or null when the workspace changed since the confirmed values were saved (p_updated_at is the stamp that save returned). A second active round, or a repeated (n, attempt), raises unique_violation.
create function public.start_round(
  p_user_id uuid,
  p_workspace_id uuid,
  p_updated_at timestamptz,
  p_n integer,
  p_attempt integer,
  p_brief_version integer,
  p_inputs jsonb,
  p_now timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_round_id uuid;
begin
  perform 1 from public.workspaces
  where id = p_workspace_id and user_id = p_user_id and deleted_at is null
    and updated_at = p_updated_at
  for update;
  if not found then
    return null;
  end if;

  insert into public.rounds (
    workspace_id, user_id, n, attempt, brief_version, inputs, started_at
  )
  values (
    p_workspace_id, p_user_id, p_n, p_attempt, p_brief_version, p_inputs, p_now
  )
  returning id into v_round_id;

  -- The stamp moves on, so a confirm save loaded before this insert fails its compare-and-swap.
  update public.workspaces
  set phase = 'rounds',
      updated_at = greatest(p_now, updated_at + interval '1 millisecond')
  where id = p_workspace_id;
  return v_round_id;
end;
$$;

-- The one place a round ends. Only a running round changes; any other state is returned as it is, so a repeated call is harmless. A done or no_pass round that is already past its deadline becomes timed_out instead, and shows no creatives. Returns the round's status after the call.
create function public.finish_round(
  p_user_id uuid,
  p_round_id uuid,
  p_status text,
  p_error text,
  p_creatives jsonb,
  p_now timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_round public.rounds%rowtype;
  v_status text := p_status;
begin
  if p_status not in ('done', 'no_pass', 'failed', 'timed_out') then
    raise exception 'cannot finish a round as %', p_status;
  end if;

  select * into v_round
  from public.rounds
  where id = p_round_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'round % not found', p_round_id;
  end if;
  if v_round.status <> 'running' then
    return v_round.status;
  end if;

  if p_status in ('done', 'no_pass') and v_round.deadline_at is not null
     and p_now > v_round.deadline_at then
    v_status := 'timed_out';
  end if;

  update public.rounds
  set status = v_status,
      error = case when v_status = 'failed' then p_error end,
      finished_at = case when v_status = 'timed_out' then v_round.deadline_at else p_now end
  where id = p_round_id;

  if v_status = 'done' then
    insert into public.creatives (
      round_id, user_id, n, angle, photo_id, background, supporting_element,
      copy, layout, background_path, preview_path
    )
    select
      p_round_id, p_user_id, x.n, x.angle, x.photo_id, x.background,
      x.supporting_element, x.copy, x.layout, x.background_path, x.preview_path
    from jsonb_to_recordset(p_creatives) as x(
      n integer, angle text, photo_id uuid, background jsonb,
      supporting_element text, copy jsonb, layout jsonb,
      background_path text, preview_path text
    );
  end if;
  return v_status;
end;
$$;

-- The compare-and-set rules for a tester's rounds, in one statement: a running round past its deadline becomes timed_out (finished at the deadline), a queued round older than p_stale_queued_s becomes failed, and a running round that has had no deadline for p_rewrite_s (the brief rewrite never finished) becomes failed. Returns the ids it changed; the caller owns their Storage cleanup.
create function public.housekeep_rounds(
  p_user_id uuid,
  p_stale_queued_s integer,
  p_rewrite_s integer,
  p_now timestamptz
)
returns uuid[]
language sql
security invoker
set search_path = ''
as $$
  with timed_out as (
    update public.rounds
    set status = 'timed_out', finished_at = deadline_at
    where user_id = p_user_id and status = 'running' and deadline_at < p_now
    returning id
  ),
  stale as (
    update public.rounds
    set status = 'failed', error = 'stale_queued', finished_at = p_now
    where user_id = p_user_id and status = 'queued'
      and started_at < p_now - make_interval(secs => p_stale_queued_s)
    returning id
  ),
  stuck as (
    update public.rounds
    set status = 'failed', error = 'brief_rewrite_timeout', finished_at = p_now
    where user_id = p_user_id and status = 'running' and deadline_at is null
      and running_at < p_now - make_interval(secs => p_rewrite_s)
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[])
  from (
    select id from timed_out
    union all select id from stale
    union all select id from stuck
  ) changed;
$$;

revoke execute on function public.add_brief_version(uuid, uuid, text, jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.start_round(uuid, uuid, timestamptz, integer, integer, integer, jsonb, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.finish_round(uuid, uuid, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.housekeep_rounds(uuid, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.add_brief_version(uuid, uuid, text, jsonb, integer)
  to service_role;
grant execute on function public.start_round(uuid, uuid, timestamptz, integer, integer, integer, jsonb, timestamptz)
  to service_role;
grant execute on function public.finish_round(uuid, uuid, text, text, jsonb, timestamptz)
  to service_role;
grant execute on function public.housekeep_rounds(uuid, integer, integer, timestamptz)
  to service_role;
