'use client';
// 콘텐츠 저장 계층 (v2.0) — 백엔드 어댑터(Supabase/Firebase)에 그대로 넘긴다.
//
// 앱 전체는 "목록 배열을 통째로 바꿔 저장"하는 방식(useLocalList)이다.
// 그 호출부 86곳을 건드리지 않으면서 DB는 항목 1개 = 행/문서 1개로 두기 위해,
// 저장 시점에 이전/새 배열을 비교해 바뀐 것만 보낸다(어댑터의 syncList).
import { backend, COLLECTION_OF } from './backend';
import type { ListItem } from './backend';
import { invalidateList, trackWrite } from './listCache';   // 포크 최적화 — 저장하면 그 표의 짧은 기억을 버린다

export { COLLECTION_OF as TABLE_OF };

export async function fetchList<T extends ListItem>(coll: string): Promise<T[]> {
  const be = backend();
  return be ? be.fetchList<T>(coll) : [];
}

export async function syncList<T extends ListItem>(
  coll: string, prev: T[], next: T[], uid: string | null,
): Promise<void> {
  const be = backend();
  // 저장하는 동안 그 표를 읽으려는 화면은 저장이 끝난 뒤에 받는다 (포크: lib/listCache)
  const job = (async () => {
    invalidateList(coll);
    try { if (be) await be.syncList(coll, prev, next, uid); }
    finally { invalidateList(coll); }
  })();
  trackWrite(coll, job);
  return job;
}

/* ---------- 실시간 목록 공유 (포크, 읽기 최적화) ----------
 * 같은 목록을 화면 여러 곳(역극 화면의 캐릭터·자관, 위젯 등)이 쓰면 예전엔 저마다 따로 읽고 따로 구독했다.
 * 이제 목록마다 연결을 하나만 열고 나눠 쓴다. 마지막 사용처가 사라져도 잠시(KEEP_MS) 열어 두어,
 * 페이지를 오가도 같은 목록을 처음부터 다시 읽지 않게 한다. 로그인 상태가 바뀌면 다른 연결로 본다
 * (읽을 수 있는 범위가 달라지므로). 백엔드가 watchList를 지원하지 않으면 null — 예전 방식으로 동작한다. */
const KEEP_MS = 60_000;
type Watch = { rows: unknown[] | null; subs: Set<(rows: unknown[]) => void>; off: () => void; timer?: ReturnType<typeof setTimeout> };
const watches = new Map<string, Watch>();

export function watchTable<T extends ListItem>(coll: string, uid: string | null, onRows: (rows: T[]) => void): (() => void) | null {
  const be = backend();
  if (!be?.watchList) return null;
  const key = `${coll}|${uid ?? ''}`;
  let w = watches.get(key);
  if (!w) {
    const nw: Watch = { rows: null, subs: new Set(), off: () => {} };
    nw.off = be.watchList<T>(coll, rows => {
      nw.rows = rows;
      nw.subs.forEach(fn => fn(rows));
    });
    watches.set(key, nw);
    w = nw;
  }
  const cur = w;
  if (cur.timer) { clearTimeout(cur.timer); cur.timer = undefined; }
  const fn = onRows as (rows: unknown[]) => void;
  cur.subs.add(fn);
  if (cur.rows) fn(cur.rows);                    // 이미 받아 둔 목록이 있으면 바로 넘긴다 (다시 읽지 않음)
  return () => {
    cur.subs.delete(fn);
    if (cur.subs.size === 0 && !cur.timer) {
      cur.timer = setTimeout(() => {
        if (cur.subs.size) return;
        cur.off();
        if (watches.get(key) === cur) watches.delete(key);
      }, KEEP_MS);
    }
  };
}

export function subscribeTable(coll: string, onChange: () => void): () => void {
  const be = backend();
  return be ? be.subscribe(coll, onChange) : () => { /* 로컬 모드 */ };
}

/* ---------- 사이트 설정 (테마·메뉴·폰트·메인 위젯 등 key/value) ---------- */

export async function fetchSetting<T>(key: string): Promise<T | null> {
  const be = backend();
  return be ? be.fetchSetting<T>(key) : null;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const be = backend();
  if (be) await be.saveSetting(key, value);
}

export async function fetchAllSettings(): Promise<Record<string, unknown>> {
  const be = backend();
  return be ? be.fetchAllSettings() : {};
}
