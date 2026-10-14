'use client';
// 로그 안 검색 (포크 기능) — 로그 상세의 떠 있는 버튼 줄 🔍 → 화면 위에 검색 줄.
// 찾은 곳을 모두 노랗게 칠하고, 지금 보고 있는 곳은 진하게. Enter = 다음 · Shift+Enter = 이전 · Esc = 닫기.
//   · HTML 로그(분리된 상자 iframe): 상자 안 스크립트(LOG_BM_IFRAME)가 찾고 칠한다 — 메시지로 주고받음
//   · 일반 글 로그: 이 화면에서 찾고, 브라우저가 지원하면 전부 칠하고(CSS Highlight) 지금 위치는 상자로 표시
// 대소문자 구분 없음. 한 줄(한 글 조각) 안에서 이어지는 글자만 찾는다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ask, mainEl, readLineY, scrollMainBy } from './LogBookmarks';

type Mode = 'frame' | 'plain';

const fab: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', lineHeight: 1,
  background: 'var(--panel-solid, #fff)', color: 'var(--ink, #333)', border: '1px solid var(--line, rgba(0,0,0,.14))',
  boxShadow: 'var(--sh-dd, 0 4px 14px rgba(0,0,0,.16))', cursor: 'var(--cur-pointer, pointer)', padding: 0,
};

const CSS = `
.lfd{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:41;display:flex;align-items:center;gap:6px;
  padding:6px 6px 6px 12px;border-radius:999px;background:var(--panel-solid,#fff);color:var(--ink,#222);
  border:1px solid var(--line);box-shadow:var(--sh-lg,0 12px 34px rgba(0,0,0,.22));width:min(440px,calc(100vw - 24px))}
.lfd svg{flex-shrink:0;color:var(--faint)}
.lfd input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font-size:13.5px;padding:6px 2px}
.lfd .cnt{font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:44px;text-align:right}
.lfd .cnt.none{color:#c0392b}
.lfd button{width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:var(--ink);display:grid;place-items:center;cursor:var(--cur-pointer,pointer);flex-shrink:0}
.lfd button:hover:not(:disabled){background:rgba(127,127,127,.14)}
.lfd button:disabled{opacity:.3;cursor:default}
.lfd-cur{position:fixed;z-index:29;pointer-events:none;border-radius:3px;outline:2px solid #f2a33a;background:rgba(242,163,58,.28)}
::highlight(ohome-find){background-color:rgba(255,214,102,.6);color:inherit}
@media (max-width:560px){.lfd{top:64px}}
`;

type HL = { set: (k: string, v: unknown) => void; delete: (k: string) => void };
const highlights = (): HL | null => {
  try {
    const c = (globalThis as unknown as { CSS?: { highlights?: HL } }).CSS;
    return c?.highlights && typeof (globalThis as { Highlight?: unknown }).Highlight === 'function' ? c.highlights : null;
  } catch { return null; }
};

/** 일반 글 로그에서 q가 나오는 글자 위치들 */
function plainHits(text: string, q: string): number[] {
  const out: number[] = [];
  if (!q) return out;
  const lt = text.toLowerCase(); const lq = q.toLowerCase();
  let i = lt.indexOf(lq);
  while (i >= 0 && out.length < 3000) { out.push(i); i = lt.indexOf(lq, i + lq.length); }
  return out;
}

export function LogFindButton({ mode, frameRef }: { mode: 'frame' | 'plain' | null; frameRef: React.RefObject<HTMLIFrameElement | null> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [n, setN] = useState(0);
  const [cur, setCur] = useState(-1);
  const [box, setBox] = useState<DOMRect | null>(null);   // 일반 글 로그 — 지금 위치 상자
  const inputRef = useRef<HTMLInputElement>(null);
  const hitsRef = useRef<number[]>([]);
  const curRef = useRef<{ i: number } | null>(null);

  const plainEl = () => document.querySelector<HTMLElement>('.log-plain');
  const plainRange = (c: number, len: number): Range | null => {
    const el = plainEl(); const node = el?.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    try { const r = document.createRange(); r.setStart(node, c); r.setEnd(node, Math.min((node.textContent ?? '').length, c + len)); return r; } catch { return null; }
  };

  const clear = useCallback(() => {
    if (mode === 'frame') { try { frameRef.current?.contentWindow?.postMessage({ __bm: 'findClear', k: 'f' }, '*'); } catch { /* 무시 */ } }
    highlights()?.delete('ohome-find');
    hitsRef.current = []; curRef.current = null; setN(0); setCur(-1); setBox(null);
  }, [mode, frameRef]);

  const go = useCallback(async (i: number, total: number, query: string) => {
    if (!total) return;
    const idx = ((i % total) + total) % total;
    setCur(idx); curRef.current = { i: idx };
    const line = readLineY();
    if (mode === 'frame') {
      const res = await ask<{ y?: number }>(frameRef.current, { __bm: 'findGo', i: idx });
      const fr = frameRef.current?.getBoundingClientRect();
      if (fr && typeof res?.y === 'number') scrollMainBy(fr.top + res.y - line - 60);
      return;
    }
    const r = plainRange(hitsRef.current[idx], query.length);
    if (!r) return;
    const rect = r.getBoundingClientRect();
    scrollMainBy(rect.top - line - 60, false);
    requestAnimationFrame(() => setBox(plainRange(hitsRef.current[idx], query.length)?.getBoundingClientRect() ?? null));
  }, [mode, frameRef]);

  // 입력이 멈추면 찾기
  useEffect(() => {
    if (!open || !mode) return;
    const t = setTimeout(async () => {
      const query = q.trim();
      if (!query) { clear(); return; }
      let total = 0;
      if (mode === 'frame') {
        const res = await ask<{ n?: number }>(frameRef.current, { __bm: 'find', q: query }, 4000);
        total = res?.n ?? 0;
      } else {
        const el = plainEl();
        const hits = plainHits(el?.textContent ?? '', query);
        hitsRef.current = hits; total = hits.length;
        const hl = highlights();
        if (hl) {
          const ranges = hits.map(c => plainRange(c, query.length)).filter(Boolean) as Range[];
          const H = (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight;
          hl.set('ohome-find', new H(...ranges));
        }
      }
      setN(total);
      if (total) {
        // 첫 결과로 이동
        void go(0, total, query);
      } else { setCur(-1); setBox(null); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, mode, frameRef, clear, go]);

  // 일반 글 로그 — 스크롤하면 지금 위치 상자를 따라 옮긴다
  useEffect(() => {
    if (!open || mode !== 'plain') return;
    const on = () => {
      const c = curRef.current;
      if (!c) return;
      setBox(plainRange(hitsRef.current[c.i], q.trim().length)?.getBoundingClientRect() ?? null);
    };
    const m = mainEl();
    m?.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { m?.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, q]);

  const close = () => { setOpen(false); clear(); };
  useEffect(() => () => { highlights()?.delete('ohome-find'); }, []);

  if (!mode) return null;
  const query = q.trim();

  return (
    <>
      <style>{CSS}</style>
      <button type="button" style={fab} title="로그 안 검색" aria-label="로그 안 검색" aria-expanded={open}
        onClick={() => { if (open) close(); else { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30); } }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4 14 14" />
        </svg>
      </button>
      {open && (
        <div className="lfd" role="search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4 14 14" />
          </svg>
          <input ref={inputRef} value={q} placeholder="로그 안에서 찾기" aria-label="로그 안에서 찾기"
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); close(); }
              else if (e.key === 'Enter' && n) { e.preventDefault(); void go(cur + (e.shiftKey ? -1 : 1), n, query); }
            }} />
          <span className={`cnt${query && !n ? ' none' : ''}`}>{query ? (n ? `${cur + 1}/${n}${n >= 3000 ? '+' : ''}` : '없음') : ''}</span>
          <button type="button" aria-label="이전" title="이전 (Shift+Enter)" disabled={!n} onClick={() => void go(cur - 1, n, query)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 10 8 5.5l4.5 4.5" /></svg>
          </button>
          <button type="button" aria-label="다음" title="다음 (Enter)" disabled={!n} onClick={() => void go(cur + 1, n, query)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 6 8 10.5 12.5 6" /></svg>
          </button>
          <button type="button" aria-label="닫기" title="닫기 (Esc)" onClick={close}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
      )}
      {open && mode === 'plain' && box && (
        <div className="lfd-cur" style={{ left: box.left - 2, top: box.top - 1, width: box.width + 4, height: box.height + 2 }} />
      )}
    </>
  );
}
