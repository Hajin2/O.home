'use client';
// 캐릭터 상세 배치 (포크 기능) — 캐릭터마다(AU마다) 그림과 오른쪽 정보의 너비 비율을 고른다.
//   · 기본: 지금처럼 그림 크게 · 정보 380px
//   · 반반: 그림과 정보를 같은 너비로
//   · 정보 넓게: 그림은 좁은 세로 띠, 정보를 크게
//   · 정보만: 그림을 숨기고 정보만 넓게 (정보 안에 그림을 직접 꾸며 둔 캐릭터용)
// 상세 페이지 머리의 「LAYOUT」 버튼(관리자·편집 권한)으로 바로 바꾸고, 바로 저장된다.
// AU를 보는 중이면 그 AU에만 저장 · AU에서 안 고르면 원본 캐릭터의 배치를 따른다.
// 휴대폰(960px 이하)은 원래처럼 위아래로 쌓인다 — 「정보만」이면 그림만 숨긴다.
// 값은 캐릭터 정보 안 detailLayout(AU는 auProfiles[키].detailLayout) — 원작 타입을 건드리지 않으려고 여기서 읽고 쓴다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게 (원작 상세 페이지에는 몇 줄만).
import React, { useEffect, useRef, useState } from 'react';
import type { Character } from '@/lib/charStore';

export type DetailLayout = 'default' | 'half' | 'wide' | 'info';

const OPTIONS: { v: DetailLayout; label: string; d: string }[] = [
  { v: 'default', label: '기본', d: '그림 크게 · 정보 좁게' },
  { v: 'half', label: '반반', d: '그림과 정보를 같은 너비로' },
  { v: 'wide', label: '정보 넓게', d: '그림은 좁은 띠 · 정보 크게' },
  { v: 'info', label: '정보만', d: '그림을 숨기고 정보만' },
];

type WithLayout = { detailLayout?: DetailLayout };
const valid = (v: unknown): v is DetailLayout => OPTIONS.some(o => o.v === v);

/** 원본 캐릭터에 저장된 배치 */
const baseOf = (ch: Character): DetailLayout | undefined => {
  const v = (ch as Character & WithLayout).detailLayout;
  return valid(v) ? v : undefined;
};
/** 그 AU에 따로 저장된 배치 (없으면 undefined = 원본 따르기) */
const auOf = (ch: Character, auKey?: string | null): DetailLayout | undefined => {
  if (!auKey) return undefined;
  const v = (ch.auProfiles?.[auKey] as WithLayout | undefined)?.detailLayout;
  return valid(v) ? v : undefined;
};

/** 지금 화면에 쓸 배치 */
export function detailLayoutOf(ch: Character | undefined, auKey?: string | null): DetailLayout {
  if (!ch) return 'default';
  return auOf(ch, auKey) ?? baseOf(ch) ?? 'default';
}

/** 저장한 캐릭터 목록을 돌려준다 — value가 undefined면 (AU에서) 원본 따르기 */
function withLayout(chars: Character[], id: string, auKey: string | null | undefined, value: DetailLayout | undefined): Character[] {
  return chars.map(x => {
    if (x.id !== id) return x;
    if (!auKey) return { ...x, detailLayout: value === 'default' ? undefined : value } as Character;
    const prof = { ...(x.auProfiles?.[auKey] ?? {}) } as Record<string, unknown>;
    if (value === undefined) delete prof.detailLayout; else prof.detailLayout = value;
    return { ...x, auProfiles: { ...x.auProfiles, [auKey]: prof } } as Character;
  });
}

export const DETAIL_LAYOUT_CSS = `
@media (min-width:961px){
  .profile-wrap.lay-half{grid-template-columns:64px minmax(0,1fr) minmax(0,1fr)}
  .profile-wrap.lay-wide{grid-template-columns:64px minmax(180px,24%) minmax(0,1fr)}
  .profile-wrap.lay-info{grid-template-columns:64px minmax(0,1fr)}
  .profile-wrap.lay-info .profile-info{max-width:none}
}
.profile-wrap.lay-info .profile-center{display:none}
.dlay{position:relative;display:inline-block}
.dlay-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:80;width:230px;padding:6px;border-radius:12px;
  background:var(--panel-solid,#fff);color:var(--ink,#222);border:1px solid var(--line);box-shadow:var(--sh-dd,0 8px 24px rgba(0,0,0,.2));text-align:left}
.dlay-pop .h{font-size:10px;letter-spacing:.14em;color:var(--faint);padding:5px 9px 7px}
.dlay-pop button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:inherit;text-align:left;
  padding:7px 9px;border-radius:8px;cursor:var(--cur-pointer,pointer)}
.dlay-pop button:hover{background:rgba(127,127,127,.12)}
.dlay-pop button.on{background:rgba(127,127,127,.16)}
.dlay-pop button b{display:block;font-size:12.5px;font-weight:600}
.dlay-pop button small{display:block;font-size:10.5px;color:var(--faint);margin-top:1px}
.dlay-pop .ic{flex-shrink:0;display:grid;grid-auto-flow:column;gap:2px;width:34px;height:22px}
.dlay-pop .ic i{display:block;border-radius:2px;background:currentColor;opacity:.22}
.dlay-pop .ic i.a{opacity:.55}
.dlay-pop hr{border:0;border-top:1px solid var(--line);margin:5px 4px}
`;

/** 작은 그림 — 그림(진하게)과 정보(옅게) 비율 */
function Icon({ v }: { v: DetailLayout | 'inherit' }) {
  const cols: Record<string, string> = { default: '3fr 2fr', half: '1fr 1fr', wide: '1fr 3fr', info: '1fr', inherit: '1fr' };
  return (
    <span className="ic" style={{ gridTemplateColumns: cols[v] }}>
      {v === 'info' || v === 'inherit' ? <i style={v === 'inherit' ? { opacity: .1 } : undefined} /> : (<><i className="a" /><i /></>)}
    </span>
  );
}

/** 상세 머리의 「LAYOUT」 버튼 — 고르면 바로 저장 */
export function DetailLayoutButton({ ch, auKey, chars, setChars }: {
  ch: Character; auKey?: string | null; chars: Character[]; setChars: (next: Character[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open]);

  const auVal = auOf(ch, auKey);
  const cur: DetailLayout | 'inherit' = auKey ? (auVal ?? 'inherit') : (baseOf(ch) ?? 'default');
  const pick = (v: DetailLayout | undefined) => { setChars(withLayout(chars, ch.id, auKey, v)); setOpen(false); };

  return (
    <div className="dlay" ref={ref}>
      <button className="btn btn-dark" title="상세 배치 — 그림과 정보의 너비" aria-expanded={open} onClick={() => setOpen(o => !o)}>LAYOUT</button>
      {open && (
        <div className="dlay-pop" role="menu">
          <div className="h">{auKey ? '이 AU의 상세 배치' : '상세 배치'}</div>
          {auKey && (
            <>
              <button type="button" role="menuitemradio" aria-checked={cur === 'inherit'} className={cur === 'inherit' ? 'on' : ''} onClick={() => pick(undefined)}>
                <Icon v="inherit" />
                <span><b>원본 따르기</b><small>원본: {OPTIONS.find(o => o.v === (baseOf(ch) ?? 'default'))?.label}</small></span>
              </button>
              <hr />
            </>
          )}
          {OPTIONS.map(o => (
            <button key={o.v} type="button" role="menuitemradio" aria-checked={cur === o.v} className={cur === o.v ? 'on' : ''} onClick={() => pick(o.v)}>
              <Icon v={o.v} />
              <span><b>{o.label}</b><small>{o.d}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
