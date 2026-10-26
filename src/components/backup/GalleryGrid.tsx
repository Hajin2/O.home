'use client';
// 갤러리 「갤러리」 보기 — 벽돌형 (포크 · 친구 요청).
// 어느 글로 올렸는지와 상관없이 그림 한 장이 한 칸. 누르면 크게 보기(좌우로 넘기기)에서
// 「이 그림이 있는 글 보기」로 그 글에 갈 수 있다. 올린 단위로 모아보기는 「리스트」 보기.
//
// 최적화
//   · 목록 칸은 작은 미리보기(lib/galleryThumb)를 쓴다 — 크게 보기에서만 원본
//   · 원본 크기를 알면 그림이 오기 전에 칸 높이를 미리 잡는다 (덜컥거림 없음)
//   · 화면 밖 그림은 보일 때 받는다 (loading=lazy) · 한 페이지 40장
//   · 크게 보기는 앞뒤 한 장씩만 미리 받는다
// 새 파일로 따로 둔 이유: 원작 저장소 업데이트(Sync fork)와 충돌하지 않게.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { fmtDate } from '@/lib/postStore';
import { useBlobUrl } from '@/lib/blobStore';
import type { BackupPost } from '@/lib/galleryStore';
import { Pager } from '@/components/ui/Kit';

export const GRID_PER = 40;
const LONG_RATIO = 2.2;      // 세로/가로가 이보다 길면 칸 높이를 자르고 「↕ 긴 그림」
const FOLD_LABEL: Record<string, string> = { spoiler: '스포일러', adult: '수위 주의' };

export interface Shot {
  key: string; post: BackupPost; idx: number; total: number;
  src?: string; thumb?: string; ph?: string; w?: number; h?: number;
}

/** 글 목록 → 그림 한 장씩 (글 순서 · 글 안 순서 그대로) */
export function shotsOf(posts: BackupPost[]): Shot[] {
  return posts.flatMap((p): Shot[] => {
    if (!p.images.length) return p.phList.map((ph, i) => ({ key: `${p.id}:${i}`, post: p, idx: i, total: p.phList.length, ph }));
    return p.images.map((src, i) => {
      const t = p.thumbs?.[i];
      return { key: `${p.id}:${i}`, post: p, idx: i, total: p.images.length, src, thumb: t?.t, w: t?.w, h: t?.h };
    });
  });
}

/** 컨테이너 폭에 맞춘 열 수 — 폰 2 · 태블릿 3 · PC 4 */
function useCols(el: HTMLDivElement | null): number {
  const [n, setN] = useState(4);
  useEffect(() => {
    if (!el) return;
    const on = () => { const w = el.clientWidth; setN(w < 560 ? 2 : w < 860 ? 3 : 4); };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return n;
}

function Tile({ s, eager, folded, onOpen, onUnveil }: {
  s: Shot; eager: boolean; folded: boolean; onOpen: () => void; onUnveil: () => void;
}) {
  const url = useBlobUrl(s.thumb ?? s.src);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(s.w && s.h ? { w: s.w, h: s.h } : null);
  const ratio = nat ? nat.h / nat.w : 1.25;
  const long = ratio > LONG_RATIO;
  const label = `${s.post.title}${s.total > 1 ? ` ${s.idx + 1}/${s.total}` : ''}`;
  return (
    <div className="gg-tile" onClick={folded ? onUnveil : onOpen}
      style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', cursor: 'var(--cur-pointer, pointer)', background: 'color-mix(in srgb, var(--ink, #1d2025) 7%, transparent)', aspectRatio: `1 / ${Math.min(ratio, LONG_RATIO)}` }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} loading={eager ? 'eager' : 'lazy'} decoding="async"
          onLoad={e => { if (!nat) { const im = e.currentTarget; setNat({ w: im.naturalWidth, h: im.naturalHeight }); } }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block', filter: folded ? 'blur(18px)' : undefined, transform: folded ? 'scale(1.1)' : undefined }} />
      ) : s.ph ? <div className={`ph ${s.ph}`} style={{ width: '100%', height: '100%' }} /> : null}
      {long && !folded && (
        <>
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, background: 'linear-gradient(transparent, rgba(0,0,0,.45))', pointerEvents: 'none' }} />
          <span className="gg-badge" style={{ right: 8, top: 8 }}>↕ 긴 그림</span>
        </>
      )}
      {folded ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#fff', fontSize: 12, textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
          <div><b>{s.post.fold!.type === 'custom' ? (s.post.fold!.label || '접힘') : FOLD_LABEL[s.post.fold!.type]}</b><br />눌러서 보기</div>
        </div>
      ) : (
        <span className="gg-badge gg-cap" style={{ left: 8, bottom: 8 }}>{label}</span>
      )}
    </div>
  );
}

export function GalleryGrid({ posts }: { posts: BackupPost[] }) {
  // 상자가 그려진 뒤에 폭을 잰다 — 처음엔 그림이 없어 상자가 없을 수 있다 (콜백 ref)
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const cols = useCols(box);
  const all = useMemo(() => shotsOf(posts), [posts]);
  const [page, setPage] = useState(1);
  const [unveiled, setUnveiled] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<number | null>(null);
  const pages = Math.max(1, Math.ceil(all.length / GRID_PER));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * GRID_PER;
  const shown = all.slice(start, start + GRID_PER);
  const sig = posts.map(p => p.id).join();
  useEffect(() => { setPage(1); }, [sig]);

  // 열 나누기 — 키를 아는 그림은 가장 짧은 열에, 모르면 차례로 (왼→오가 최신 순서로 읽히게)
  const columns = useMemo(() => {
    const out: { s: Shot; i: number }[][] = Array.from({ length: cols }, () => []);
    const hgt = new Array(cols).fill(0);
    shown.forEach((s, i) => {
      const r = s.w && s.h ? Math.min(s.h / s.w, LONG_RATIO) : 1.25;
      let c = 0;
      for (let k = 1; k < cols; k++) if (hgt[k] < hgt[c] - 0.01) c = k;
      out[c].push({ s, i });
      hgt[c] += r;
    });
    return out;
  }, [shown, cols]);

  const goPage = (n: number) => { setPage(n); (document.getElementById('appMain') ?? window).scrollTo({ top: 0, behavior: 'smooth' }); };
  if (!all.length) return null;
  return (
    <div ref={setBox}>
      <style>{`
        .gg-badge{position:absolute;padding:2px 8px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff;font-size:10.5px;max-width:calc(100% - 16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}
        .gg-tile .gg-cap{opacity:0;transition:opacity .15s}
        .gg-tile:hover .gg-cap{opacity:1}
        @media (hover:none){.gg-tile .gg-cap{display:none}}
      `}</style>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {col.map(({ s, i }) => (
              <Tile key={s.key} s={s} eager={i < cols * 2} folded={!!s.post.fold && !unveiled[s.post.id]}
                onOpen={() => setOpen(start + i)} onUnveil={() => setUnveiled(u => ({ ...u, [s.post.id]: true }))} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <Pager page={cur} total={pages} onChange={goPage} />
      </div>
      {open !== null && all[open] && (
        <Viewer shots={all} at={open} folded={!!all[open].post.fold && !unveiled[all[open].post.id]}
          onUnveil={() => setUnveiled(u => ({ ...u, [all[open].post.id]: true }))} onMove={i => { setOpen(i); const p = Math.floor(i / GRID_PER) + 1; if (p !== cur) setPage(p); }} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/* ---------- 크게 보기 ---------- */
function Viewer({ shots, at, folded, onUnveil, onMove, onClose }: {
  shots: Shot[]; at: number; folded: boolean; onUnveil: () => void; onMove: (i: number) => void; onClose: () => void;
}) {
  const router = useRouter();
  const s = shots[at];
  // 접힌 그림은 원본을 받지 않는다 — 미리보기를 흐리게만
  const url = useBlobUrl(folded ? undefined : s.src);
  const thumb = useBlobUrl(s.thumb);
  const prev = () => onMove((at - 1 + shots.length) % shots.length);
  const next = () => onMove((at + 1) % shots.length);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  // 앞뒤 한 장씩 미리 받기 — 넘길 때 바로 뜨게 (그 이상은 받지 않는다)
  const pre1 = useBlobUrl(shots[(at + 1) % shots.length]?.src);
  const pre2 = useBlobUrl(shots[(at - 1 + shots.length) % shots.length]?.src);
  useEffect(() => { [pre1, pre2].forEach(u => { if (u) { const im = new Image(); im.src = u; } }); }, [pre1, pre2]);
  if (typeof document === 'undefined') return null;
  const nav: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 18, display: 'grid', placeItems: 'center', zIndex: 2 };
  return createPortal(
    <div onClick={onClose}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) { if (dx > 0) prev(); else next(); }
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(12,13,16,.94)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', fontSize: 13, flex: 'none' }}>
        <span style={{ opacity: .7 }}>{at + 1} / {shots.length}</span>
        <button type="button" onClick={onClose} aria-label="닫기" style={{ marginLeft: 'auto', color: '#fff', fontSize: 22, background: 'transparent', opacity: .85 }}>✕</button>
      </div>
      <div className="gg-stage" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0 70px', position: 'relative' }}>
        {shots.length > 1 && <button type="button" aria-label="이전" onClick={e => { e.stopPropagation(); prev(); }} className="gg-nav" style={{ ...nav, position: 'fixed', left: 18 }}>◁</button>}
        {/* 원본이 오기 전엔 미리보기를 먼저 깔아 둔다 */}
        {(url || thumb) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url ?? thumb} alt={s.post.title} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', margin: 'auto', display: 'block', filter: folded ? 'blur(24px)' : undefined, ...(s.w && s.h && s.h / s.w > LONG_RATIO && !folded ? {} : { maxHeight: '100%', objectFit: 'contain' }) }} />
        )}
        {folded && (
          <button type="button" onClick={e => { e.stopPropagation(); onUnveil(); }}
            style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', padding: '12px 20px', borderRadius: 10, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 13 }}>
            <b>{s.post.fold!.type === 'custom' ? (s.post.fold!.label || '접힘') : FOLD_LABEL[s.post.fold!.type]}</b> — 눌러서 보기
          </button>
        )}
        {shots.length > 1 && <button type="button" aria-label="다음" onClick={e => { e.stopPropagation(); next(); }} className="gg-nav" style={{ ...nav, position: 'fixed', right: 18 }}>▷</button>}
      </div>
      <div onClick={e => e.stopPropagation()} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', fontSize: 13 }}>
        {s.post.category && <span style={{ padding: '2px 10px', borderRadius: 999, background: 'rgba(255,255,255,.15)' }}>{s.post.category}</span>}
        <b>{s.post.title}{s.total > 1 ? ` · ${s.idx + 1}/${s.total}` : ''}</b>
        <span style={{ opacity: .6 }}>{fmtDate(s.post.madeDate ? s.post.madeDate + 'T00:00:00' : s.post.date)} · {s.post.author}</span>
        <button type="button" onClick={() => { onClose(); router.push(`/gallery/${s.post.id}`); }}
          style={{ padding: '7px 14px', borderRadius: 8, background: '#fff', color: '#1d2025', fontWeight: 700, fontSize: 12.5 }}>이 그림이 있는 글 보기 ›</button>
      </div>
      <style>{`@media (max-width:620px){.gg-nav{display:none!important}.gg-stage{padding:0!important}}`}</style>
    </div>,
    document.body,
  );
}
