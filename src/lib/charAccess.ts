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
