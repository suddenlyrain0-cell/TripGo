create or replace function public.enforce_numeric_room_password()
returns trigger
language plpgsql
as $$
begin
  if new.password is null or new.password !~ '^[0-9]+$' then
    raise exception 'room password must contain digits only';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_numeric_room_password on public.rooms;

create trigger enforce_numeric_room_password
before insert or update of password on public.rooms
for each row
execute function public.enforce_numeric_room_password();
