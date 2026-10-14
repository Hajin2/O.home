'use client';
// 세계관 — 캐릭터가 하나씩 속하는 세계. 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
// 공개범위(visibility)는 항목 데이터에 같이 저장돼 서버(RLS)가 그대로 지킨다.
import { useMemo } from 'react';
import { useAuth } from './auth';
import { useRawList, type RawList } from './rawList';
import type { Visibility, Character, CharGrant } from './charStore';
import type { CropValue } from '@/components/ui/CropEditor';

export const WORLD_KEY = 'ohome.worlds.v1';

export interface WorldTab { id: string; title: string; html: string }

export interface World {
  id: string;
  name: string;
  sub?: string;              // 한 줄 소개
  imgId?: string;            // 커버 이미지 (1:1 크롭)
  crop?: CropValue;
  tabs: WorldTab[];          // 문서 탭 — 각 탭은 HTML 에디터로 작성
  tags?: string[];
  label?: string;            // 목록 오른쪽 작은 글씨 (기본 VIEW)
  visibility: Visibility;
  date: string;
  /** 처음 만든 관리자 (세계관 편집 권한) — 편집 회원이 저장해도 작성자가 바뀌지 않게 데이터에 같이 둔다 */
  authorId?: string;
  /** 이 세계관을 편집할 수 있는 회원 (세계관 편집 권한). level은 언제나 'edit'.
   *  저장할 때 editorIds(평평한 배열)로 뽑혀 서버 규칙이 그대로 확인한다 */
  grants?: CharGrant[];
}

export const WORLD_SEED: World[] = [];

export const worldPath = (w: { id: string }) => `/worlds/${w.id}`;

export function useWorldList(): RawList<World> {
  return useRawList<World>(WORLD_KEY, WORLD_SEED);
}

/** 이 세계관을 편집할 수 있는가 — 관리자 또는 편집 권한을 받은 회원 */
export function canEditWorld(w: World, userId: string | undefined, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  return !!w.grants?.some(g => g.userId === userId && g.level === 'edit');
}

/** 이 사람이 볼 수 있는 공개범위인가 */
export function useCanSee() {
  const { user, isAdmin } = useAuth();
  return (v: Visibility | undefined) => isAdmin || v === 'public' || v === undefined || (v === 'member' && !!user);
}

/** 이 사람이 볼 수 있는 세계관만 */
export function useVisibleWorlds(): RawList<World> & { visible: World[] } {
  const src = useWorldList();
  const canSee = useCanSee();
  const visible = useMemo(() => src.list.filter(w => canSee(w.visibility)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src.list, canSee]);
  return { ...src, visible };
}

/** 세계관별 캐릭터 수 — 보는 사람이 볼 수 있는 캐릭터만 센다 */
export function countByWorld(chars: Character[], isAdmin: boolean): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of chars) {
    if (!c.own || !c.worldId) continue;
    if (!isAdmin && c.visibility !== 'public') continue;
    out[c.worldId] = (out[c.worldId] ?? 0) + 1;
  }
  return out;
}
