'use client';
// 자관 상세의 떠 있는 이동 버튼 — 맨 위로 · 이전 자관 · 다음 자관 · 목록 (로그 상세의 LogNav와 같은 모양)
// 이전/다음은 자관 목록 순서 그대로, 이 사람이 열 수 있는 자관만.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { relPath, type Relation } from '@/lib/charStore';

const btn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, lineHeight: 1,
  background: 'var(--panel-solid, #fff)', color: 'var(--ink, #333)', border: '1px solid var(--line, rgba(0,0,0,.14))',
  boxShadow: 'var(--sh-dd, 0 4px 14px rgba(0,0,0,.16))', cursor: 'var(--cur-pointer, pointer)', padding: 0,
};

export function RelNav({ rels, cur, listHref = '/rels' }: { rels: Relation[]; cur: Relation; listHref?: string }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  const { prev, next } = useMemo(() => {
    // 목록과 같은 기준 — 나만보기는 관리자만, 멤버공개는 로그인한 사람만 (지금 보고 있는 자관은 늘 포함)
    const seq = rels.filter(r => r.id === cur.id || isAdmin || r.visibility === 'public' || (r.visibility === 'member' && !!user));
    const i = seq.findIndex(r => r.id === cur.id);
    return { prev: i > 0 ? seq[i - 1] : undefined, next: i >= 0 && i < seq.length - 1 ? seq[i + 1] : undefined };
  }, [rels, cur, user, isAdmin]);

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
      {scrolled && <button type="button" style={btn} onClick={top} title="맨 위로" aria-label="맨 위로">↑</button>}
      <button type="button" style={{ ...btn, ...off(!!prev) }} disabled={!prev} title={prev ? `이전 자관 · ${prev.name}` : '이전 자관 없음'}
        aria-label="이전 자관" onClick={() => prev && router.push(relPath(prev))}>‹</button>
      <button type="button" style={{ ...btn, ...off(!!next) }} disabled={!next} title={next ? `다음 자관 · ${next.name}` : '다음 자관 없음'}
        aria-label="다음 자관" onClick={() => next && router.push(relPath(next))}>›</button>
      <button type="button" style={{ ...btn, fontSize: 13 }} onClick={() => router.push(listHref)} title="자관 목록으로" aria-label="자관 목록으로">☰</button>
    </div>
  );
}
