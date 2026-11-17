-- Today's spend for the spend cap: every cost row since UTC midnight, except golden testers'.
create function public.spend_today_usd()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(c.usd), 0)
  from public.costs c
  join public.testers t on t.user_id = c.user_id
  where not t.is_golden
    and c.created_at >= date_trunc('day', now(), 'UTC');
$$;

revoke execute on function public.spend_today_usd() from public, anon, authenticated;
grant execute on function public.spend_today_usd() to service_role;
