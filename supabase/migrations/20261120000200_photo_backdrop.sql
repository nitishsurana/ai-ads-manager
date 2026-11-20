-- The cached backdrop-difference mask of a photo and which mask its cut-outs use ('backdrop-1' or 'model-1').
alter table public.photos
  add column backdrop_path text,
  add column mask_choice text;
