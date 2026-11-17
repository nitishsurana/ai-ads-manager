-- Rating and inline edits are compare-and-swap writes: each one names the rev it read and bumps it.
alter table public.creatives
  add column rev integer not null default 0;
