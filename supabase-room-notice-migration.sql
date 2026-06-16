alter table rooms
  add column if not exists notice text,
  add column if not exists notice_by text,
  add column if not exists notice_updated_at timestamptz;
