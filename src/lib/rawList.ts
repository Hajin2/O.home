'use client';
// 목록 한 번 읽기 + 바뀐 것만 저장 (구독 없음) — 태그 관리·태그 모아보기가 쓴다.
//
// useLocalList를 쓰지 않는 이유: 서버 모드의 useLocalList는 목록마다 실시간 구독을 여는데,
// 같은 목록을 이미 쓰는 곳과 겹치면 Supabase가 「구독 후 콜백 추가 불가」 오류를 내며 화면이 안 열린다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import { useCallback, useEffect, useRef, useState } from 'react';
import { TABLE_OF, fetchList, syncList } from './db';
import { isServerMode } from './supabase';
import { currentUserId } from './currentUser';
import { cachedList } from './listCache';   // 같은 표 중복 요청 합치기 + 30초 기억 (포크 최적화)

export type Tagged = { id: string; tags?: string[] };

export interface RawList<T extends Tagged> {
  list: T[];
  loaded: boolean;
  save: (next: T[]) => Promise<void>;
}

export function useRawList<T extends Tagged>(key: string, seed: T[]): RawList<T> {
  const [list, setList] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<T[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      let rows: T[] = [];
      try {
        if (isServerMode() && TABLE_OF[key]) rows = await cachedList<T>(TABLE_OF[key], currentUserId(), () => fetchList<T>(TABLE_OF[key]));
        else {
          const raw = localStorage.getItem(key);
          rows = raw ? (JSON.parse(raw) as T[]) : seed;
        }
      } catch { /* 못 읽으면 빈 목록 */ }
      if (!alive) return;
      ref.current = rows; setList(rows); setLoaded(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = useCallback(async (next: T[]) => {
    const prev = ref.current;
    if (isServerMode() && TABLE_OF[key]) await syncList<T>(TABLE_OF[key], prev, next, currentUserId());
    else localStorage.setItem(key, JSON.stringify(next));
    ref.current = next; setList(next);
  }, [key]);
  return { list, loaded, save };
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);
export const uniq = (a: string[]) => [...new Set(a)];

/** 목록의 태그를 fn으로 바꿔 저장 — only가 있으면 그 id만. 바뀐 항목 수를 돌려준다 */
export async function runTags<T extends Tagged>(src: RawList<T>, fn: (tags: string[]) => string[], only?: Set<string>): Promise<number> {
  let n = 0;
  const next = src.list.map(it => {
    if (only && !only.has(it.id)) return it;
    const cur = it.tags ?? [];
    const nt = fn(cur);
    if (same(cur, nt)) return it;
    n++;
    return { ...it, tags: nt };
  });
  if (n > 0) await src.save(next);
  return n;
}
