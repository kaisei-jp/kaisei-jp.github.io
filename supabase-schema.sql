-- kaisei 赴日计划：Supabase 数据库与 Storage 初始化脚本
-- 请在 Supabase Dashboard → SQL Editor 中完整执行一次。
-- 本脚本不会创建或暴露 service_role key。

create extension if not exists pgcrypto;

-- 只有 SQL Editor 中明确加入的账号才具有管理权限。
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.site_admins enable row level security;
revoke all on public.site_admins from public, anon, authenticated;
grant select on public.site_admins to authenticated;

drop policy if exists "Admin can inspect own membership" on public.site_admins;
create policy "Admin can inspect own membership"
  on public.site_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.milestone_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_key text not null check (
    milestone_key in (
      'bachelor',
      'master',
      'db-engineer',
      'jlpt-n1',
      'jtest',
      'graduation',
      'career',
      'long-term'
    )
  ),
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  public_url text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists milestone_assets_created_at_idx
  on public.milestone_assets (created_at desc);

alter table public.milestone_assets enable row level security;

revoke all on public.milestone_assets from public, anon, authenticated;
grant select on public.milestone_assets to anon, authenticated;
grant insert, delete on public.milestone_assets to authenticated;

drop policy if exists "Public can view milestone records" on public.milestone_assets;
create policy "Public can view milestone records"
  on public.milestone_assets
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Owner can create milestone records" on public.milestone_assets;
drop policy if exists "Admin can create milestone records" on public.milestone_assets;
create policy "Admin can create milestone records"
  on public.milestone_assets
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owner can update milestone records" on public.milestone_assets;

drop policy if exists "Owner can delete milestone records" on public.milestone_assets;
drop policy if exists "Admin can delete milestone records" on public.milestone_assets;
create policy "Admin can delete milestone records"
  on public.milestone_assets
  for delete
  to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-proofs',
  'milestone-proofs',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owner can upload milestone images" on storage.objects;
drop policy if exists "Admin can upload milestone images" on storage.objects;
create policy "Admin can upload milestone images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'milestone-proofs'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

drop policy if exists "Owner can inspect uploaded milestone images" on storage.objects;
drop policy if exists "Admin can inspect uploaded milestone images" on storage.objects;
create policy "Admin can inspect uploaded milestone images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'milestone-proofs'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owner can delete milestone images" on storage.objects;
drop policy if exists "Admin can delete milestone images" on storage.objects;
create policy "Admin can delete milestone images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'milestone-proofs'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

-- 在 Authentication → Users 创建自己的账号之后，再单独执行：
-- insert into public.site_admins (user_id)
-- select id from auth.users where email = '你的登录邮箱'
-- on conflict (user_id) do nothing;
