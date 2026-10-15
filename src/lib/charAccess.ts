'use client';
// 캐릭터 추가·편집·삭제 권한 (세계관 편집 회원의 캐릭터 추가, 포크)
//  · 추가: 관리자 또는 세계관 편집 권한을 받은 회원 — 회원은 자기가 편집할 수 있는 세계관에만
//  · 편집: 관리자 · 「편집까지」 권한 회원 · 만든 사람
//  · 삭제: 관리자 · 만든 사람
// 새 파일로 따로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게.
import { useMemo } from 'react';
import { useAuth } from './auth';
import { charGrant, type Character } from './charStore';
import { useWorldList, canEditWorld, type World } from './worldStore';

/** 이 사람이 캐릭터를 추가할 수 있는 세계관 — 관리자는 전부 */
export function useEditableWorlds(): { worlds: World[]; loaded: boolean; canAdd: boolean } {
  const { user, isAdmin } = useAuth();
  const src = useWorldList();
  const worlds = useMemo(() => src.list.filter(w => canEditWorld(w, user?.id, isAdmin)),
    [src.list, user?.id, isAdmin]);
  return { worlds, loaded: src.loaded, canAdd: isAdmin || worlds.length > 0 };
}

export function canEditChar(ch: Character, userId: string | undefined, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  return charGrant(ch, userId) === 'edit' || ch.authorId === userId;
}

export function canDeleteChar(ch: Character, userId: string | undefined, isAdmin: boolean): boolean {
  return isAdmin || (!!userId && ch.authorId === userId);
}

/** 회원이 만든 캐릭터에 붙일 권한 — 만든 사람이 그 캐릭터로 역극·문답에 참여하고, 서버도 편집을 허용하도록.
 *  관리자는 원래 전권이라 붙이지 않는다 */
export function creatorGrants(userId: string | undefined, isAdmin: boolean): Character['grants'] {
  return !isAdmin && userId ? [{ userId, level: 'edit' }] : undefined;
}

/* ---------- 자관 ---------- */

type RelLike = { id: string; authorId?: string; members: { charId: string }[]; editorUids?: string[] };

/** 자관 편집 — 관리자 · 만든 사람 · 멤버 캐릭터 중 하나라도 편집할 수 있는 회원 */
export function canEditRel(rel: RelLike, chars: Character[], userId: string | undefined, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  if (rel.authorId === userId) return true;
  return rel.members.some(m => {
    const c = chars.find(x => x.id === m.charId);
    return !!c && canEditChar(c, userId, false);
  });
}

/** 자관 삭제 — 관리자 · 만든 사람 */
export function canDeleteRel(rel: RelLike, userId: string | undefined, isAdmin: boolean): boolean {
  return isAdmin || (!!userId && rel.authorId === userId);
}

/** 서버가 확인할 편집 회원 목록 — 멤버 캐릭터를 편집할 수 있는 회원(만든 사람·「편집까지」 권한) */
export function relEditorUids(rel: RelLike, chars: Character[]): string[] {
  const ids = new Set<string>();
  for (const m of rel.members) {
    const c = chars.find(x => x.id === m.charId);
    if (!c) continue;
    if (c.authorId) ids.add(c.authorId);
    c.grants?.forEach(g => { if (g.level === 'edit') ids.add(g.userId); });
  }
  return [...ids].sort();
}

/** 바뀐 자관에만 편집 회원 목록을 새로 붙인다 — 안 바뀐 자관까지 건드리면 남의 자관 저장이 거부된다 */
export function stampRelEditors<T extends RelLike>(next: T[], prev: T[], chars: Character[]): T[] {
  return next.map(r => {
    const before = prev.find(p => p.id === r.id);
    if (before && JSON.stringify(before) === JSON.stringify(r)) return r;
    const uids = relEditorUids(r, chars);
    return JSON.stringify(uids) === JSON.stringify(r.editorUids ?? []) ? r : { ...r, editorUids: uids };
  });
}
