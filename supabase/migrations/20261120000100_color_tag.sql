-- The reject tag is spelled "Color" in the app now; saved ratings follow so the tag stays selected and filters match.
update public.creatives
  set tags = array_replace(tags, 'Colour', 'Color')
  where 'Colour' = any(tags);
