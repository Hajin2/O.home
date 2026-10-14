'use client';
// 목록 짧은 기억 + 중복 합치기 (포크 최적화).
//
// 원작 useLocalList는 화면에서 부를 때마다 표 전체를 서버에서 새로 받았다 —
//   · 같은 페이지 안에서 같은 표를 두 군데서 부르면 두 번 (메인의 갤러리·자관, 캐릭터 상세의 자관 등)
//   · 페이지를 옮길 때마다 같은 표를 처음부터 다시 (캐릭터 목록 → 상세 → 자관이면 캐릭터 표를 세 번)
// 그래서 Supabase 무료 요금제의 월 전송량(egress)을 필요 이상으로 썼다.
//
// 이제:
//   · 같은 표를 동시에 부르면 요청 하나를 함께 기다린다
//   · 받은 지 TTL(30초)이 안 지났으면 다시 받지 않고 그대로 쓴다
//   · 무언가를 저장·삭제하면(db.syncList) 그 표의 기억을 곧바로 버린다 — 「지운 글이 남아 보임」 방지
//   · 실시간 구독으로 바뀜 신호가 오면 기억을 무시하고 새로 받는다 (다른 사람의 변경)
//   · 보는 사람(로그인 계정)마다 따로 기억한다 — 권한에 따라 받는 행이 다르므로
// 기억은 이 탭의 메모리에만 있다 — 새로고침하면 비워진다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌을 줄이려고 (원작 파일에는 부르는 몇 줄만).

const TTL = 30_000;

interface Entry {
  rows?: unknown[];
  at: number;               // rows를 받은 시각
  p?: Promise<unknown[]>;   // 지금 받는 중인 요청
  forced?: boolean;         // 그 요청이 「새로 받기」(구독 신호)로 시작됐는지
  gen: number;              // 저장으로 기억을 버릴 때마다 올라간다 — 그 전에 시작된 요청 결과는 기억하지 않는다
}

const store = new Map<string, Entry>();
const keyOf = (table: string, uid: string | null) => `${table}|${uid ?? '-'}`;

/** 아직 신선한 기억이 있으면 바로 돌려준다 (화면 첫 그림에 빈 목록이 번쩍이지 않게) */
export function peekList<T>(table: string, uid: string | null): T[] | undefined {
  const e = store.get(keyOf(table, uid));
  return e?.rows && Date.now() - e.at < TTL ? (e.rows as T[]) : undefined;
}

/** 기억 우선으로 표 읽기 — force면 기억을 무시하고 새로 받는다(같은 때 들어온 새로 받기 요청은 하나로 합친다) */
export function cachedList<T>(table: string, uid: string | null, fetcher: () => Promise<T[]>, force = false): Promise<T[]> {
  const key = keyOf(table, uid);
  const e = store.get(key) ?? { at: 0, gen: 0 };
  if (!force && e.rows && Date.now() - e.at < TTL) return Promise.resolve(e.rows as T[]);
  if (e.p && (!force || e.forced)) return e.p as Promise<T[]>;
  const gen = e.gen;
  const p = fetcher().then(rows => {
    const cur = store.get(key);
    if (cur && cur.gen === gen && cur.p === p) { cur.rows = rows; cur.at = Date.now(); cur.p = undefined; }
    return rows;
  }, err => {
    const cur = store.get(key);
    if (cur && cur.p === p) cur.p = undefined;
    throw err;
  });
  store.set(key, { ...e, p: p as Promise<unknown[]>, forced: force });
  return p;
}

/** 이 표의 기억을 버린다 (저장·삭제 직전과 직후에 부른다) — 모든 계정분 */
export function invalidateList(table: string) {
  const pre = `${table}|`;
  store.forEach((e, k) => {
    if (!k.startsWith(pre)) return;
    e.gen += 1; e.rows = undefined; e.at = 0; e.p = undefined; e.forced = false;
  });
}
