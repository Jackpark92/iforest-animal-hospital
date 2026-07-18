-- Run this in Supabase SQL Editor if an existing admin account is blocked
-- because case_admins.user_id no longer matches the current auth user id.
-- It keeps the existing user_id check and also allows the verified auth email.

drop policy if exists "Admins can view admins" on public.case_admins;
drop policy if exists "Admins can read all cases" on public.cases;
drop policy if exists "Admins can insert cases" on public.cases;
drop policy if exists "Admins can update cases" on public.cases;
drop policy if exists "Admins can delete cases" on public.cases;

create policy "Admins can view admins"
on public.case_admins for select
to authenticated
using (auth.uid() = user_id or lower(auth.jwt() ->> 'email') = lower(email));

create policy "Admins can read all cases"
on public.cases for select
to authenticated
using (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
     or lower(email) = lower(auth.jwt() ->> 'email')
));

create policy "Admins can insert cases"
on public.cases for insert
to authenticated
with check (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
     or lower(email) = lower(auth.jwt() ->> 'email')
));

create policy "Admins can update cases"
on public.cases for update
to authenticated
using (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
     or lower(email) = lower(auth.jwt() ->> 'email')
))
with check (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
     or lower(email) = lower(auth.jwt() ->> 'email')
));

create policy "Admins can delete cases"
on public.cases for delete
to authenticated
using (exists (
  select 1
  from public.case_admins
  where user_id = auth.uid()
     or lower(email) = lower(auth.jwt() ->> 'email')
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
       or lower(email) = lower(auth.jwt() ->> 'email')
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
       or lower(email) = lower(auth.jwt() ->> 'email')
  )
)
with check (
  bucket_id = 'case-images'
  and exists (
    select 1
    from public.case_admins
    where user_id = auth.uid()
       or lower(email) = lower(auth.jwt() ->> 'email')
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
       or lower(email) = lower(auth.jwt() ->> 'email')
  )
);
