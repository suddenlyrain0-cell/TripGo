alter table public.rooms enable row level security;

grant delete on table public.rooms to anon, authenticated;

drop policy if exists "public delete rooms" on public.rooms;

create policy "public delete rooms"
on public.rooms
for delete
to anon, authenticated
using (true);
