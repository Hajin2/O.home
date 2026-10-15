'use client';
// 캐릭터 상세의 떠 있는 이동 버튼 — 맨 위로 · 이전 캐릭터 · 다음 캐릭터 · 목록 (자관 상세 RelNav와 같은 모양)
// 이전/다음은 캐릭터 목록과 같은 기준: 같은 섹션(목록)의 내 캐릭터, 목록 순서 그대로,
// 비공개는 관리자만 (지금 보고 있는 캐릭터는 늘 포함). 세계관·태그 거르기는 따르지 않는다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { charPath, type Character } from '@/lib/charStore';
import { inSection, MAIN_SEC } from '@/lib/sectionStore';

const btn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, lineHeight: 1,
  background: 'var(--panel-solid, #fff)', color: 'var(--ink, #333)', border: '1px solid var(--line, rgba(0,0,0,.14))',
  boxShadow: 'var(--sh-dd, 0 4px 14px rgba(0,0,0,.16))', cursor: 'var(--cur-pointer, pointer)', padding: 0,
};

export function CharNav({ chars, cur, listHref }: { chars: Character[]; cur: Character; listHref: string }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  const { prev, next } = useMemo(() => {
    const sec = cur.secId ?? MAIN_SEC;
    const seq = chars
      .filter(c => inSection(c.secId, sec))
      .filter(c => c.id === cur.id || (c.own && (isAdmin || c.visibility === 'public')));
    const i = seq.findIndex(c => c.id === cur.id);
    return { prev: i > 0 ? seq[i - 1] : undefined, next: i >= 0 && i < seq.length - 1 ? seq[i + 1] : undefined };
  }, [chars, cur, isAdmin]);

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
    <div style={{ position: 'fixed', right: 22, bottom: 'max(92px, calc(var(--bgm-h, 0px) + 16px))', display: 'grid', gap: 8, zIndex: 30 }}>
      {scrolled && <button type="button" style={btn} onClick={top} title="맨 위로" aria-label="맨 위로">↑</button>}
      <button type="button" style={{ ...btn, ...off(!!prev) }} disabled={!prev} title={prev ? `이전 캐릭터 · ${prev.name}` : '이전 캐릭터 없음'}
        aria-label="이전 캐릭터" onClick={() => prev && router.push(charPath(prev))}>‹</button>
      <button type="button" style={{ ...btn, ...off(!!next) }} disabled={!next} title={next ? `다음 캐릭터 · ${next.name}` : '다음 캐릭터 없음'}
        aria-label="다음 캐릭터" onClick={() => next && router.push(charPath(next))}>›</button>
      <button type="button" style={{ ...btn, fontSize: 13 }} onClick={() => router.push(listHref)} title="목록으로" aria-label="목록으로">☰</button>
    </div>
  );
}
