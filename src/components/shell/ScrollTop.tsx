'use client';
// 맨 위로 버튼 (포크 기능) — 사이트 어디서든 아래로 꽤 내려가면 오른쪽 아래에 ↑ 버튼이 뜬다.
//   · 스크롤은 페이지 전체가 아니라 #appMain 안에서 일어난다 → 그 영역을 지켜본다
//   · 자기 이동 버튼 줄에 이미 ↑가 있는 로그 상세(LogNav)·자관 상세(RelNav)·캐릭터 상세(CharNav)와
//     스크롤 개념이 다른 역극·메모 보드·관계도에서는 띄우지 않는다
//   · BGM 플레이어(PC 오른쪽 아래 알약 · 휴대폰 아래 전폭 바)를 가리지 않는 높이
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게 (원작 layout에는 한 줄만).
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const SHOW_AFTER = 600;   // 이만큼(px) 내려가면 보인다

// 띄우지 않는 곳 — 자기 ↑ 버튼이 있거나 스크롤 개념이 다른 화면
const SKIP = [
  /^\/trpg\/(?!new$)[^/]+$/,   // 로그 상세 (LogNav)
  /^\/rels\/(?!new$|map$)[^/]+$/,   // 자관 상세 (RelNav)
  /^\/chars\/(?!new$)[^/]+$/,   // 캐릭터 상세 (CharNav)
  /^\/rp(\/|$)/, /^\/memo(\/|$)/, /^\/rels\/map$/,
];

const CSS = `
.sctop{position:fixed;right:22px;bottom:max(92px, calc(var(--bgm-h,0px) + 16px));z-index:30;width:38px;height:38px;border-radius:50%;
  display:grid;place-items:center;padding:0;background:var(--panel-solid,#fff);color:var(--ink,#333);
  border:1px solid var(--line,rgba(0,0,0,.14));box-shadow:var(--sh-dd,0 4px 14px rgba(0,0,0,.16));cursor:var(--cur-pointer,pointer);
  animation:sctop-in .18s ease}
.sctop:hover{transform:translateY(-1px)}
.sctop svg{width:15px;height:15px}
@keyframes sctop-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (max-width:960px){.sctop{right:14px}}
@media (prefers-reduced-motion:reduce){.sctop{animation:none}}
`;

export function ScrollTopButton() {
  const path = usePathname() ?? '/';
  const skip = SKIP.some(r => r.test(path));
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    if (skip) return;
    const el = document.getElementById('appMain');
    if (!el) return;
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; setShow(el.scrollTop > SHOW_AFTER); });
    };
    on();
    el.addEventListener('scroll', on, { passive: true });
    return () => { el.removeEventListener('scroll', on); if (raf) cancelAnimationFrame(raf); };
  }, [path, skip]);

  if (skip || !show) return null;
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="sctop" title="맨 위로" aria-label="맨 위로"
        onClick={() => document.getElementById('appMain')?.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 13V3.5M3.5 8 8 3.5 12.5 8" />
        </svg>
      </button>
    </>
  );
}
