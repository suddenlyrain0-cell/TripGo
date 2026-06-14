create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password text not null,
  owner text,
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

alter table rooms enable row level security;
alter table room_members enable row level security;
alter table messages enable row level security;
alter table places enable row level security;
alter table place_comments enable row level security;

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
create policy "public read place comments" on place_comments for select using (true);
create policy "public insert place comments" on place_comments for insert with check (true);
