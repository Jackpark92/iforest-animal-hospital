create extension if not exists pgcrypto;

create table if not exists public.case_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null,
  species text,
  breed text,
  age text,
  sex text,
  diagnosis text,
  card_description text,
  summary text,
  thumbnail_url text,
  content_html text not null default '',
  source_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'private')),
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  images jsonb not null default '[]'::jsonb,
  author_id uuid references auth.users(id)
);

create index if not exists cases_status_published_idx on public.cases(status, published_at desc);
create index if not exists cases_category_idx on public.cases(category);

alter table public.cases
add column if not exists thumbnail_url text;

alter table public.cases
add column if not exists card_description text;

comment on column public.cases.thumbnail_url is
'Representative thumbnail for archive cards only. Content images are stored separately in the images jsonb column.';

comment on column public.cases.card_description is
'Short plain-text description shown on public archive cards.';

-- Storage path convention:
-- case-images/thumbnails/... : representative thumbnails for archive cards
-- case-images/contents/...   : content images inserted manually into case body

alter table public.case_admins enable row level security;
alter table public.cases enable row level security;

create policy "Admins can view admins"
on public.case_admins for select
to authenticated
using (auth.uid() = user_id);

create policy "Published cases are public"
on public.cases for select
to anon, authenticated
using (status = 'published');

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-images',
  'case-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read case images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'case-images');

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

-- 관리자 계정 생성 후 아래 예시처럼 auth.users의 id와 email을 등록하세요.
-- insert into public.case_admins (user_id, email)
-- values ('AUTH_USER_UUID', 'admin@example.com');
