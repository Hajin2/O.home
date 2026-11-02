'use client';
// 자관 TIMELINE · QUESTIONS 이름 — 「형광펜」 (포크, 사용자 확정 · 가독성과 디자인 우선)
// 이름을 캐릭터 색 글자로 쓰면 아주 연한 색(흰색 등)은 이름이 사라졌다 (사용자 제보).
// → 이름 글자는 모두 짙은 회색으로 읽히게 하고, 캐릭터 색은 이름 아래 반투명 형광펜으로 은은하게.
// 같은 캐릭터가 연달아 말하면 이름은 한 번만. 아주 연한 색은 형광펜 아래 옅은 회색 선 + 말풍선 회색 테두리.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게 (globals.css를 고치지 않고 여기서 덮어쓴다).
import React from 'react';

export const SAY_CSS = [
  '.tl-say .who,.qa-ans .who{color:#4b5160}',
  '.say-name{display:inline-block;line-height:1.7;padding:0 4px;background:linear-gradient(transparent 55%,var(--hl) 55%,var(--hl) 88%,transparent 88%)}',
  '.pale .say-name{box-shadow:inset 0 -1px 0 rgba(0,0,0,.14)}',
  '.tl-say.pale .bub,.qa-ans.pale .bub{border-color:rgba(0,0,0,.12)}',
].join('');

export function SayStyle() { return <style>{SAY_CSS}</style>; }

/** 형광펜 이름 */
export function SayName({ children }: { children: React.ReactNode }) {
  return <span className="say-name">{children}</span>;
}
