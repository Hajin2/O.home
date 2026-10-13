'use client';
// TRPG 로그 상세의 떠 있는 이동 버튼 — 맨 위로 · 이전 로그 · 다음 로그 · 목록
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { TrpgLog } from '@/lib/galleryStore';
import { inSection, MAIN_SEC } from '@/lib/sectionStore';

const btn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, lineHeight: 1,
  background: 'var(--panel-solid, #fff)', color: 'var(--ink, #333)', border: '1px solid var(--line, rgba(0,0,0,.14))',
  boxShadow: 'var(--sh-dd, 0 4px 14px rgba(0,0,0,.16))', cursor: 'var(--cur-pointer, pointer)', padding: 0,
};

/** extra: 맨 위에 붙일 버튼 (책갈피 — LogBookmarks) */
export function LogNav({ logs, cur, listHref, extra }: { logs: TrpgLog[]; cur: TrpgLog; listHref: string; extra?: React.ReactNode }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // 같은 갤러리(섹션)에서 이 사람이 볼 수 있는 로그 — 번호 순으로 이전/다음
  const { prev, next } = useMemo(() => {
    const sec = cur.secId ?? MAIN_SEC;
    const seq = logs
      .filter(x => inSection(x.secId, sec))
      .filter(x => isAdmin || (!x.listHidden && (x.visibility === 'public' || (x.visibility === 'member' && !!user))) || x.id === cur.id)
      .sort((a, b) => (a.no - b.no) || (a.date ?? '').localeCompare(b.date ?? ''));
    const i = seq.findIndex(x => x.id === cur.id);
    return { prev: i > 0 ? seq[i - 1] : undefined, next: i >= 0 && i < seq.length - 1 ? seq[i + 1] : undefined };
  }, [logs, cur, user, isAdmin]);

  // 스크롤은 페이지 전체가 아니라 #appMain 안에서 일어난다
  useEffect(() => {
    const el = document.getElementById('appMain');
    if (!el) return;
    const on = () => setScrolled(el.scrollTop > 300);
    on();
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);

  const top = () => document.getElementById('appMain')?.scrollTo({ top: 0, behavior: 'smooth' });
  const off = (on: boolean): React.CSSProperties => (on ? {} : { opacity: .35, cursor: 'default' });

  return (
    <div style={{ position: 'fixed', right: 22, bottom: 92, display: 'grid', gap: 8, zIndex: 30 }}>
      {extra}
      {scrolled && <button type="button" style={btn} onClick={top} title="맨 위로" aria-label="맨 위로">↑</button>}
      <button type="button" style={{ ...btn, ...off(!!prev) }} disabled={!prev} title={prev ? `이전 로그 · ${prev.title}` : '이전 로그 없음'}
        aria-label="이전 로그" onClick={() => prev && router.push(`/trpg/${prev.id}`)}>‹</button>
      <button type="button" style={{ ...btn, ...off(!!next) }} disabled={!next} title={next ? `다음 로그 · ${next.title}` : '다음 로그 없음'}
        aria-label="다음 로그" onClick={() => next && router.push(`/trpg/${next.id}`)}>›</button>
      <button type="button" style={{ ...btn, fontSize: 13 }} onClick={() => router.push(listHref)} title="목록으로" aria-label="목록으로">☰</button>
    </div>
  );
}
