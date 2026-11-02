'use client';
// 자관 TIMELINE · QUESTIONS 말풍선 — 「말풍선 띠」 (포크, 사용자 확정 F-2)
// 이름을 캐릭터 색으로 쓰면 아주 연한 색(흰색 등)은 이름이 사라졌다 (사용자 제보).
// 색을 바꾸면 포인트 색의 의미가 없어지므로 → 이름은 차분한 짙은 회색, 캐릭터 색은 말풍선 바깥쪽 얇은 띠로 그대로.
// 같은 캐릭터가 연달아 말하면 이름은 한 번, 띠는 하나로 이어진다. 아주 연한 색은 띠·말풍선에 옅은 회색 윤곽.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게 (globals.css를 고치지 않고 여기서 덮어쓴다).
import React from 'react';

export const SAY_CSS = [
  '.tl-say .who,.qa-ans .who{color:#4b5160}',
  '.say-line{display:flex;align-items:stretch;gap:6px}',
  '.tl-say.r .say-line,.qa-ans.r .say-line{flex-direction:row-reverse}',
  '.timeline.multi .qa-ans .say-line{justify-content:center}',
  '.say-bar{flex:none;width:3px;border-radius:3px;background:var(--bar,#5d636d)}',
  // 다음 말풍선도 같은 캐릭터면 띠를 아래 간격만큼 늘려 이어 붙인다
  '.tl-say.cont .say-bar{margin-bottom:-7px;border-bottom-left-radius:0;border-bottom-right-radius:0}',
  '.qa-ans.cont .say-bar{margin-bottom:-14px;border-bottom-left-radius:0;border-bottom-right-radius:0}',
  '.tl-say.cont+.tl-say .say-bar,.qa-ans.cont+.qa-ans .say-bar{border-top-left-radius:0;border-top-right-radius:0}',
  // 다인관 답변은 말풍선마다 가운데 정렬이라 폭이 달라 띠 위치가 어긋난다 → 이어 붙이지 않고 말풍선마다 따로
  '.timeline.multi .qa-ans.cont .say-bar,.timeline.multi .qa-ans.cont+.qa-ans .say-bar{margin-bottom:0;border-radius:3px}',
  '.pale .say-bar{box-shadow:0 0 0 1px rgba(0,0,0,.14)}',
  '.tl-say.pale .bub,.qa-ans.pale .bub{border-color:rgba(0,0,0,.12)}',
].join('');

export function SayStyle() { return <style>{SAY_CSS}</style>; }

/** 띠 + 말풍선 한 줄 */
export function SayLine({ children }: { children: React.ReactNode }) {
  return <div className="say-line"><i className="say-bar" aria-hidden />{children}</div>;
}
