-- 로그 책갈피(bookmarks) 표 추가 — Supabase SQL Editor에 통째로 붙여넣고 Run (여러 번 실행해도 안전)
-- 각자 자기 것만: 책갈피는 항상 공개범위 private로 저장 → 읽기는 본인(과 관리자 계정)만.
-- 쓰기: 로그인 회원 누구나 자기 책갈피를 추가 · 고치기·지우기는 본인만(관리자 포함)
create table if not exists public.bookmarks (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  author_id   uuid references auth.users(id) on delete cascade,
  visibility  text not null default 'private',
  sort        double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.bookmarks enable row level security;
create index if not exists bookmarks_sort_idx on public.bookmarks (sort);
-- 편집 권한 칸 — 저장할 때 항상 함께 보낸다 (없으면 저장이 400으로 거부됨)
alter table public.bookmarks add column if not exists editor_ids text[] not null default '{}'::text[];

drop policy if exists "read" on public.bookmarks;
create policy "read" on public.bookmarks for select using (
  visibility = 'public'
  or (visibility = 'member' and auth.uid() is not null)
  or author_id = auth.uid()
  or public.is_admin()
);
drop policy if exists "insert" on public.bookmarks;
create policy "insert" on public.bookmarks for insert to authenticated
  with check (author_id = auth.uid());
drop policy if exists "update" on public.bookmarks;
create policy "update" on public.bookmarks for update to authenticated
  using (author_id = auth.uid() or public.is_admin());
drop policy if exists "delete" on public.bookmarks;
create policy "delete" on public.bookmarks for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
