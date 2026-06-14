create table if not exists place_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  username text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table place_comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'place_comments'
      and policyname = 'public read place comments'
  ) then
    create policy "public read place comments" on place_comments for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'place_comments'
      and policyname = 'public insert place comments'
  ) then
    create policy "public insert place comments" on place_comments for insert with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'place_comments'
  ) then
    alter publication supabase_realtime add table public.place_comments;
  end if;
end $$;
