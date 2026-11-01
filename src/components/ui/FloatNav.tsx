'use client';
// 떠 있는 이동 버튼 묶음 (포크) — 캐릭터·자관·로그 상세가 같이 쓴다.
// PC: 버튼이 세로로 늘 보인다 (예전 그대로).
// 폰(760px 이하): 버튼 넷이 아래 탭 버튼 칸을 가렸다 (사용자 제보) → 동그라미 하나(⋯)만 두고,
//   누르면 위로 펼쳐지고 다시 누르거나 버튼을 하나 고르면 접힌다.
//   페이지 끝에는 동그라미 하나만큼 빈 자리를 둬서 맨 아래까지 내리면 내용이 버튼 위로 올라온다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useState } from 'react';

const CSS = '.fnav{display:grid;gap:8px}.fnav-tog{display:none!important}.fnav-spacer{height:24px}'
  + '@media (max-width:760px){.fnav{right:14px!important;gap:7px}'
  + '.fnav>*{display:none!important}.fnav>.fnav-tog{display:grid!important}'
  + '.fnav[data-open="1"]>*{display:grid!important}'
  + '.fnav-spacer{height:calc(max(92px, calc(var(--bgm-h, 0px) + 16px)) + 50px)}}';

export const FLOAT_BTN: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, lineHeight: 1,
  background: 'var(--panel-solid, #fff)', color: 'var(--ink, #333)', border: '1px solid var(--line, rgba(0,0,0,.14))',
  boxShadow: 'var(--sh-dd, 0 4px 14px rgba(0,0,0,.16))', cursor: 'var(--cur-pointer, pointer)', padding: 0,
};

export function FloatNav({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="fnav-spacer" aria-hidden />
      <style>{CSS}</style>
      <div className="fnav" data-open={open ? '1' : '0'} style={{ position: 'fixed', zIndex: 30, ...style }}
        // 펼친 뒤 버튼 하나를 누르면 접는다 (펼치기 버튼 자신은 제외)
        onClickCapture={e => { if (!(e.target as HTMLElement).closest('.fnav-tog')) setOpen(false); }}>
        {children}
        <button type="button" className="fnav-tog" style={{ ...FLOAT_BTN, fontSize: open ? 15 : 18, background: open ? 'var(--ink, #333)' : FLOAT_BTN.background, color: open ? '#fff' : FLOAT_BTN.color }}
          onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? '이동 버튼 접기' : '이동 버튼 펼치기'} title={open ? '접기' : '이동'}>
          {open ? '✕' : '⋯'}
        </button>
      </div>
    </>
  );
}
