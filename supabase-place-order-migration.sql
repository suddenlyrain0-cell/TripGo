alter table places
  add column if not exists sort_order integer;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'places'
      and policyname = 'public update places'
  ) then
    create policy "public update places" on places
      for update
      using (true)
      with check (true);
  end if;
end $$;
