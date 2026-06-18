alter table places
  add column if not exists category text,
  add column if not exists estimated_stay_minutes integer,
  add column if not exists priority integer,
  add column if not exists saved_by_users text[];
