-- Success persistence for an intake in one transaction, so a crash or a lost race leaves no half-built workspace.
-- Returns { workspaceId, adopted }: workspaceId is null when the intake had already failed (nothing changed), and adopted says whether this intake's photo rows belong to that workspace (false when the intake only points at an existing workspace).
create function public.complete_intake(
  p_user_id uuid,
  p_intake_id uuid,
  p_workspace jsonb,
  p_photos jsonb,
  p_summary jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_intake public.intakes%rowtype;
  v_workspace_id uuid;
  v_campaign jsonb;
begin
  select * into v_intake
  from public.intakes
  where id = p_intake_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'intake % not found', p_intake_id;
  end if;

  if v_intake.status = 'failed' then
    return jsonb_build_object('workspaceId', null, 'adopted', false);
  end if;

  if v_intake.status = 'done' then
    return jsonb_build_object(
      'workspaceId', v_intake.workspace_id,
      'adopted', exists (
        select 1 from public.photos
        where intake_id = p_intake_id and workspace_id = v_intake.workspace_id
      )
    );
  end if;

  select campaign into v_campaign
  from public.threads
  where id = v_intake.thread_id and user_id = p_user_id;

  insert into public.workspaces (
    user_id, thread_id, product_key, source_url, product, campaign,
    brand_kit_scraped, brand_kit, logo
  )
  values (
    p_user_id,
    v_intake.thread_id,
    p_workspace->>'product_key',
    p_workspace->>'source_url',
    p_workspace->'product',
    coalesce(v_campaign, '{}'::jsonb),
    p_workspace->'brand_kit_scraped',
    p_workspace->'brand_kit',
    nullif(p_workspace->'logo', 'null'::jsonb)
  )
  on conflict (user_id, product_key) where deleted_at is null do nothing
  returning id into v_workspace_id;

  if v_workspace_id is null then
    -- Someone else already has this product: point the intake at it and keep nothing of this run.
    select id into v_workspace_id
    from public.workspaces
    where user_id = p_user_id
      and product_key = p_workspace->>'product_key'
      and deleted_at is null;

    update public.intakes
    set status = 'done', workspace_id = v_workspace_id,
        product_key = p_workspace->>'product_key',
        finished_at = now(), progress_at = now()
    where id = p_intake_id;

    return jsonb_build_object('workspaceId', v_workspace_id, 'adopted', false);
  end if;

  insert into public.photos (
    intake_id, workspace_id, position, source_url, orig_width, orig_height,
    work_path, thumb_path, sha256, phash, checks, tier, cutout_path, mask_path,
    dropped, drop_reason, selected
  )
  select
    p_intake_id, v_workspace_id, x.position, x.source_url, x.orig_width,
    x.orig_height, x.work_path, x.thumb_path, x.sha256, x.phash, x.checks,
    x.tier, x.cutout_path, x.mask_path, x.dropped, x.drop_reason, x.selected
  from jsonb_to_recordset(p_photos) as x(
    position integer, source_url text, orig_width integer, orig_height integer,
    work_path text, thumb_path text, sha256 text, phash text, checks jsonb,
    tier text, cutout_path text, mask_path text, dropped boolean,
    drop_reason text, selected boolean
  );

  update public.threads
  set workspace_id = v_workspace_id
  where id = v_intake.thread_id and user_id = p_user_id;

  insert into public.messages (thread_id, ui_id, role, kind, parts)
  values (
    v_intake.thread_id, p_summary->>'ui_id', 'assistant', 'summary',
    p_summary->'parts'
  )
  on conflict (thread_id, ui_id) do nothing;

  update public.intakes
  set status = 'done', workspace_id = v_workspace_id,
      product_key = p_workspace->>'product_key',
      finished_at = now(), progress_at = now()
  where id = p_intake_id;

  return jsonb_build_object('workspaceId', v_workspace_id, 'adopted', true);
end;
$$;

revoke execute on function public.complete_intake(uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_intake(uuid, uuid, jsonb, jsonb, jsonb)
  to service_role;
