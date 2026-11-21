-- At most one reading intake per thread, so two starts for the same thread can't both run.
create unique index intakes_thread_reading_idx
  on public.intakes (thread_id)
  where status = 'reading';
