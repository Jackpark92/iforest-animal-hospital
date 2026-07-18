-- Run this in Supabase SQL Editor to make admin access use auth.uid() only.
-- Expected admin:
-- email: treey1624@naver.com
-- user id: 2c97cb18-4ae0-4d7e-867c-8b87a9907167

update public.case_admins
set user_id = '2c97cb18-4ae0-4d7e-867c-8b87a9907167'
where lower(email) = lower('treey1624@naver.com');

drop policy if exists "Admins can view admins" on public.case_admins;

create policy "Admins can view admins"
on public.case_admins for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all cases" on public.cases;
drop policy if exists "Admins can insert cases" on public.cases;
drop policy if exists "Admins can update cases" on public.cases;
drop policy if exists "Admins can delete cases" on public.cases;

create policy "Admins can read all cases"
on public.cases for select
to authenticated
using (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
));

create policy "Admins can insert cases"
on public.cases for insert
to authenticated
with check (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
));

create policy "Admins can update cases"
on public.cases for update
to authenticated
using (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
))
with check (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
));

create policy "Admins can delete cases"
on public.cases for delete
to authenticated
using (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
));

drop policy if exists "Admins can upload case images" on storage.objects;
drop policy if exists "Admins can update case images" on storage.objects;
drop policy if exists "Admins can delete case images" on storage.objects;

create policy "Admins can upload case images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'case-images'
  and exists (
    select 1
    from public.case_admins
    where user_id = auth.uid()
  )
);

create policy "Admins can update case images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'case-images'
  and exists (
    select 1
    from public.case_admins
    where user_id = auth.uid()
  )
)
with check (
  bucket_id = 'case-images'
  and exists (
    select 1
    from public.case_admins
    where user_id = auth.uid()
  )
);

create policy "Admins can delete case images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'case-images'
  and exists (
    select 1
    from public.case_admins
    where user_id = auth.uid()
  )
);

select *
from public.case_admins
where user_id = '2c97cb18-4ae0-4d7e-867c-8b87a9907167';
