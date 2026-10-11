-- IseiKa 赴日计划：Supabase 数据库与 Storage 初始化脚本
-- 请在 Supabase Dashboard → SQL Editor 中完整执行一次。
-- 本脚本不会创建或暴露 service_role key。

create extension if not exists pgcrypto;

create table if not exists public.milestone_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_key text not null check (milestone_key in ('master', 'graduation', 'career', 'long-term')),
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

grant select on public.milestone_assets to anon, authenticated;
grant insert, update, delete on public.milestone_assets to authenticated;

drop policy if exists "Public can view milestone records" on public.milestone_assets;
create policy "Public can view milestone records"
  on public.milestone_assets
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Owner can create milestone records" on public.milestone_assets;
create policy "Owner can create milestone records"
  on public.milestone_assets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can update milestone records" on public.milestone_assets;
create policy "Owner can update milestone records"
  on public.milestone_assets
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can delete milestone records" on public.milestone_assets;
create policy "Owner can delete milestone records"
  on public.milestone_assets
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

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
create policy "Owner can upload milestone images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'milestone-proofs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

drop policy if exists "Owner can inspect uploaded milestone images" on storage.objects;
create policy "Owner can inspect uploaded milestone images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'milestone-proofs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Owner can delete milestone images" on storage.objects;
create policy "Owner can delete milestone images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'milestone-proofs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
