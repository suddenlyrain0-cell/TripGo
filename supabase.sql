create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password text not null,
  owner text,
  notice text,
  notice_by text,
  notice_updated_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  username text not null,
  created_at timestamptz default now(),
  unique(room_id, username)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  username text not null,
  content text not null,
  type text default 'chat',
  created_at timestamptz default now()
);

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  added_by text not null,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  tag text default '기타',
  memo text,
  sort_order integer,
  created_at timestamptz default now()
);

create table if not exists place_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  username text not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  message_id uuid references messages(id) on delete cascade,
  username text not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, username)
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  visitor_id text,
  user_id text,
  room_id uuid references rooms(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists analytics_events_event_name_created_at_idx on analytics_events(event_name, created_at);
create index if not exists analytics_events_created_at_idx on analytics_events(created_at);
create index if not exists analytics_events_room_id_created_at_idx on analytics_events(room_id, created_at);

alter table rooms enable row level security;
alter table room_members enable row level security;
alter table messages enable row level security;
alter table places enable row level security;
alter table place_comments enable row level security;
alter table message_reactions enable row level security;
alter table analytics_events enable row level security;

drop policy if exists "public read rooms" on rooms;
drop policy if exists "public insert rooms" on rooms;
drop policy if exists "public update rooms" on rooms;
drop policy if exists "public delete rooms" on rooms;
drop policy if exists "public read members" on room_members;
drop policy if exists "public insert members" on room_members;
drop policy if exists "public delete members" on room_members;
drop policy if exists "public read messages" on messages;
drop policy if exists "public insert messages" on messages;
drop policy if exists "public read places" on places;
drop policy if exists "public insert places" on places;
drop policy if exists "public update places" on places;
drop policy if exists "public delete places" on places;
drop policy if exists "public read place comments" on place_comments;
drop policy if exists "public insert place comments" on place_comments;
drop policy if exists "public read message reactions" on message_reactions;
drop policy if exists "public insert message reactions" on message_reactions;
drop policy if exists "public update message reactions" on message_reactions;
drop policy if exists "public delete message reactions" on message_reactions;
drop policy if exists "public insert analytics events" on analytics_events;
drop policy if exists "public read analytics events" on analytics_events;

create policy "public read rooms" on rooms for select using (true);
create policy "public insert rooms" on rooms for insert with check (true);
create policy "public update rooms" on rooms for update using (true) with check (true);
create policy "public delete rooms" on rooms for delete using (true);
create policy "public read members" on room_members for select using (true);
create policy "public insert members" on room_members for insert with check (true);
create policy "public delete members" on room_members for delete using (true);
create policy "public read messages" on messages for select using (true);
create policy "public insert messages" on messages for insert with check (true);
create policy "public read places" on places for select using (true);
create policy "public insert places" on places for insert with check (true);
create policy "public update places" on places for update using (true) with check (true);
create policy "public delete places" on places for delete using (true);
create policy "public read place comments" on place_comments for select using (true);
create policy "public insert place comments" on place_comments for insert with check (true);
create policy "public read message reactions" on message_reactions for select using (true);
create policy "public insert message reactions" on message_reactions for insert with check (true);
create policy "public update message reactions" on message_reactions for update using (true) with check (true);
create policy "public delete message reactions" on message_reactions for delete using (true);
create policy "public insert analytics events" on analytics_events for insert with check (true);
