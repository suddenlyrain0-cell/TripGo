alter table rooms add column if not exists owner text;

update rooms
set owner = first_member.username
from (
  select distinct on (room_id) room_id, username
  from room_members
  order by room_id, created_at
) first_member
where rooms.id = first_member.room_id
  and rooms.owner is null;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rooms'
      and policyname = 'public update rooms'
  ) then
    create policy "public update rooms" on rooms for update using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;
