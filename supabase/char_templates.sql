-- 캐릭터 양식(char_templates) 테이블 추가 — Supabase SQL Editor에 통째로 붙여넣고 Run (여러 번 실행해도 안전)
-- 읽기: 누구나 (캐릭터 화면이 양식으로 그려지므로)  ·  쓰기: 관리자만
create table if not exists public.char_templates (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  author_id   uuid references auth.users(id) on delete set null,
  visibility  text not null default 'public',
  sort        double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.char_templates enable row level security;
create index if not exists char_templates_sort_idx on public.char_templates (sort);
-- 편집 권한 칸 — 원작 업데이트로 저장할 때 항상 함께 보낸다 (없으면 저장이 400으로 거부됨)
alter table public.char_templates add column if not exists editor_ids text[] not null default '{}'::text[];
notify pgrst, 'reload schema';

drop policy if exists "read" on public.char_templates;
create policy "read" on public.char_templates for select using (true);
drop policy if exists "insert" on public.char_templates;
create policy "insert" on public.char_templates for insert to authenticated with check (public.is_admin());
drop policy if exists "update" on public.char_templates;
create policy "update" on public.char_templates for update to authenticated
  using (public.is_admin());
drop policy if exists "delete" on public.char_templates;
create policy "delete" on public.char_templates for delete to authenticated
  using (public.is_admin());
