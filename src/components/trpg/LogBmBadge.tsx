'use client';
// 로그 목록 카드의 책갈피 표시 (포크 기능) — 책갈피가 있는 로그 카드 썸네일 구석에 🔖 개수.
// 누르면 그 로그의 책갈피 목록이 뜨고, 고르면 로그가 열리면서 그 자리로 간다(?bm=).
// 책갈피는 각자 자기 것만 — 로그인은 계정(bookmarks 표), 비로그인은 이 브라우저 (LogBookmarks와 같은 규칙).
// 카드마다 서버를 부르지 않도록 한 번 읽어 모든 카드가 나눠 쓴다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { isServerMode } from '@/lib/backend';
import { fetchList } from '@/lib/db';
import type { LogBookmark } from './LogBookmarks';

const LOCAL_KEY = 'ohome.logbm.v1';
let cache: { uid: string | null; at: number; p: Promise<LogBookmark[]> } | null = null;

function loadAll(uid: string | null): Promise<LogBookmark[]> {
  // 같은 사람이 3초 안에 다시 부르면 같은 결과를 나눠 쓴다 (카드 수만큼 요청하지 않게)
  if (cache && cache.uid === uid && Date.now() - cache.at < 3000) return cache.p;
  const p = (async () => {
    if (uid && isServerMode()) {
      try { return (await fetchList<LogBookmark>('bookmarks')).filter(b => b.authorId === uid); } catch { /* 표가 없으면 아래 */ }
    }
    try { const raw = localStorage.getItem(LOCAL_KEY); return raw ? (JSON.parse(raw) as LogBookmark[]) : []; } catch { return []; }
  })();
  cache = { uid, at: Date.now(), p };
  return p;
}

/** 로그 id → 그 로그의 책갈피 (위치 순) */
export function useBookmarkIndex(): Map<string, LogBookmark[]> {
  const { user, ready } = useAuth();
  const uid = user?.id ?? null;
  const [idx, setIdx] = useState<Map<string, LogBookmark[]>>(new Map());
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    loadAll(uid).then(list => {
      if (!alive) return;
      const m = new Map<string, LogBookmark[]>();
      list.forEach(b => { const g = m.get(b.logId) ?? []; g.push(b); m.set(b.logId, g); });
      m.forEach(g => g.sort((a, b) => a.a.p - b.a.p));
      setIdx(m);
    });
    return () => { alive = false; };
  }, [uid, ready]);
  return idx;
}

const CSS = `
.lbb{position:absolute;top:8px;right:8px;z-index:3}
.lbb-btn{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px 0 7px;border-radius:999px;border:0;
  background:rgba(20,22,27,.62);color:#fff;font-size:11px;font-family:var(--sans,inherit);line-height:1;cursor:var(--cur-pointer,pointer);
  -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,.18)}
.lbb-btn:hover{background:rgba(20,22,27,.8)}
.lbb-btn svg{width:12px;height:12px}
.lbb-pop{position:fixed;z-index:95;min-width:200px;max-width:260px;max-height:240px;overflow:auto;padding:6px;border-radius:11px;
  background:var(--panel-solid,#fff);color:var(--ink,#222);border:1px solid var(--line);box-shadow:var(--sh-dd,0 8px 24px rgba(0,0,0,.2));text-align:left}
.lbb-pop .h{font-size:10px;letter-spacing:.14em;color:var(--faint);padding:4px 8px 6px}
.lbb-pop button{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;text-align:left;
  padding:7px 8px;border-radius:7px;font-size:12px;cursor:var(--cur-pointer,pointer)}
.lbb-pop button:hover{background:rgba(127,127,127,.12)}
.lbb-pop button span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbb-pop button small{color:var(--faint);font-size:10.5px;font-variant-numeric:tabular-nums}
.lbb.sm{top:4px;right:4px}
.lbb.sm .lbb-btn{height:20px;padding:0 6px 0 5px;font-size:10px}
`;

/** 카드 썸네일 구석의 책갈피 표시 — 책갈피가 없으면 아무것도 그리지 않는다 */
export function LogBmBadge({ logId, items, small }: { logId: string; items?: LogBookmark[]; small?: boolean }) {
  const router = useRouter();
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);   // 열린 목록 위치 (화면 기준)
  const open = !!at;
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      setAt(null);
    };
    const close = () => setAt(null);
    document.addEventListener('pointerdown', down, true);
    document.getElementById('appMain')?.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.getElementById('appMain')?.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  const toggle = () => {
    if (open) { setAt(null); return; }
    const r = ref.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };
  if (!items?.length) return null;
  return (
    <div ref={ref} className={`lbb${small ? ' sm' : ''}`} onClick={e => e.stopPropagation()}>
      <style>{CSS}</style>
      <button type="button" className="lbb-btn" title={`책갈피 ${items.length}개`} aria-expanded={open} onClick={toggle}>
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6l-4.5-3-4.5 3V3a.5.5 0 0 1 .5-.5z" /></svg>
        {items.length}
      </button>
      {at && createPortal(
        <div ref={popRef} className="lbb-pop" role="menu" style={{ top: at.top, right: at.right }} onClick={e => e.stopPropagation()}>
          <style>{CSS}</style>
          <div className="h">책갈피로 바로 가기</div>
          {items.map(b => (
            <button key={b.id} type="button" role="menuitem" onClick={() => router.push(`/trpg/${logId}?bm=${b.id}`)}>
              <span>{b.name}</span><small>{Math.round(Math.min(1, Math.max(0, b.a.p)) * 100)}%</small>
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}
