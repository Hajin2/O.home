'use client';
// 로그 본문 「하나만」 읽기 (포크 최적화).
//
// 원작은 로그 목록·상세를 열 때마다 본문 표(trpg_log_bodies)를 **통째로** 받아 왔다 — 700KB 이하 본문은
// 표 안에 글 그대로 들어 있어서, 로그 하나를 열어도 모든 로그의 본문(수 MB)이 오갔다.
// Supabase 무료 요금제의 월 전송량(egress)을 금방 갉아먹는 가장 큰 원인이었다.
//   · 상세: 그 로그의 본문 한 행만 읽는다 (useLogBody) — 화면 코드는 예전처럼 [목록, 저장, 로드완료]를 쓴다
//   · 목록: 본문을 아예 읽지 않고, 새 로그를 추가할 때 그 본문 하나만 저장한다 (addLogBody)
// 서버가 없는 로컬 모드는 예전 그대로 브라우저 저장소의 목록 전체를 쓴다(내 기기 안이라 전송량과 무관).
// 권한(RLS·보안 규칙)은 목록으로 읽을 때와 똑같이 걸린다 — 못 보는 본문은 오지 않는다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import { useCallback, useEffect, useRef, useState } from 'react';
import { backend, isServerMode } from './backend';
import { TABLE_OF, fetchList, syncList, subscribeTable } from './db';
import { currentUserId } from './currentUser';
import { LIST_ERR_EVT } from './postStore';
import { TRPG_BODY_SEED, type TrpgLogBody } from './galleryStore';

const KEY = 'ohome.trpgbody.v1';
type Row = TrpgLogBody & Record<string, unknown>;   // 저장 계층(ListItem) 형식에 맞춘 것
const table = () => TABLE_OF[KEY];

async function fetchOne(id: string): Promise<TrpgLogBody | null> {
  const be = backend();
  if (!be) return null;
  if (be.fetchById) return be.fetchById<Row>(table(), id);
  // 하나만 읽기를 모르는 백엔드면 예전 방식으로 (안전한 대체)
  return (await fetchList<Row>(table())).find(x => x.id === id) ?? null;
}

const readLocal = (): TrpgLogBody[] => {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as TrpgLogBody[]) : TRPG_BODY_SEED; } catch { return TRPG_BODY_SEED; }
};

function reportError(err: unknown) {
  console.error('[ohome] 로그 본문 저장 실패', err);
  try {
    window.dispatchEvent(new CustomEvent(LIST_ERR_EVT, {
      detail: { table: table(), message: err instanceof Error ? err.message : String(err) },
    }));
  } catch { /* 무시 */ }
}

/** 로그 상세용 — 그 로그의 본문만 담긴 목록(0개 또는 1개). 로컬 모드면 전체 목록 */
export function useLogBody(id: string): [TrpgLogBody[], (next: TrpgLogBody[]) => void, boolean] {
  const server = isServerMode() && !!table();
  const [list, setList] = useState<TrpgLogBody[]>([]);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef<TrpgLogBody[]>([]);
  latest.current = list;
  const reqId = useRef(0);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    if (server) {
      const load = () => {
        const n = ++reqId.current;
        fetchOne(id)
          .then(row => {
            if (!alive || n !== reqId.current) return;   // 더 최신 요청이 있었으면 버림
            const rows = row ? [row] : [];
            setList(rows); latest.current = rows; setLoaded(true);
          })
          .catch(() => { if (alive) setLoaded(true); });
      };
      load();
      // 다른 사람이 본문을 고치면 다시 읽는다 — 이 로그 것만 다시 받으므로 가볍다
      const off = subscribeTable(table(), load);
      return () => { alive = false; off(); };
    }
    const rows = readLocal();
    setList(rows); latest.current = rows; setLoaded(true);
    return () => { alive = false; };
  }, [id, server]);

  const update = useCallback((next: TrpgLogBody[]) => {
    const prev = latest.current;
    const n = ++reqId.current;
    setList(next); latest.current = next;
    if (server) {
      syncList(table(), prev as Row[], next as Row[], currentUserId()).catch(err => {
        reportError(err);
        reqId.current = n;
        fetchOne(id).then(row => { if (n === reqId.current) { const rows = row ? [row] : []; setList(rows); latest.current = rows; } })
          .catch(() => { /* 무시 */ });
      });
      return;
    }
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  }, [id, server]);

  return [list, update, loaded];
}

/** 로그 목록에서 새 로그를 추가할 때 — 그 본문 하나만 저장한다 (목록 화면은 본문을 읽지 않는다) */
export async function addLogBody(body: TrpgLogBody): Promise<void> {
  if (isServerMode() && table()) {
    try { await syncList(table(), [] as Row[], [body as Row], currentUserId()); }
    catch (err) { reportError(err); throw err; }
    return;
  }
  const all = readLocal();
  try { localStorage.setItem(KEY, JSON.stringify([...all.filter(x => x.id !== body.id), body])); } catch { /* 무시 */ }
}
