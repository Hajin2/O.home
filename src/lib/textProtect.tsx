'use client';
// 글 복사 방지 (포크 기능) — 「이미지 저장 방지」와 같은 방식으로, 체크한 영역에서 방문자의
// 글 드래그 선택 · 복사(Ctrl+C·우클릭 복사) · 잘라내기 · 전체 선택(Ctrl+A)을 막는다. 관리자 계정은 제외.
// 로그 본문은 사이트와 분리된 상자(iframe) 안에 그려지므로 그 안에도 같은 차단을 넣는다(TEXT_PROTECT_IFRAME).
// 완전한 차단은 웹 특성상 불가능 — 개발자 도구·페이지 저장·화면 캡처는 못 막는다(손쉬운 복사를 막는 수준).
//
// 설정은 메뉴 설정(ohome.menuset.v1) 안에 textProtect로 함께 저장한다 — 원작 SETTING_KEYS를 건드리지 않으려고
// (이 키는 이미 서버에 저장되는 키라 방문자에게도 그대로 전달된다).
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth';
import { useMenuSettings, type MenuSettings } from './menuStore';
import { KCheck } from '@/components/ui/Kit';

export type TextProtectArea = 'trpg' | 'board' | 'chars' | 'rels' | 'worlds' | 'tchar';
export const TEXT_PROTECT_AREAS: { key: TextProtectArea; label: string; paths: string[] }[] = [
  { key: 'trpg', label: '로그 백업', paths: ['/trpg'] },
  { key: 'board', label: '게시판 (갤러리·로드비 포함)', paths: ['/board', '/gallery', '/loadb'] },
  { key: 'chars', label: '자캐 (캐릭터)', paths: ['/chars'] },
  { key: 'rels', label: '자관', paths: ['/rels'] },
  { key: 'worlds', label: '세계관', paths: ['/worlds'] },
  { key: 'tchar', label: 'TRPG 캐릭터', paths: ['/tchars'] },
];

type WithText = MenuSettings & { textProtect?: TextProtectArea[] };

export function textProtectAreaFor(pathname: string): TextProtectArea | null {
  for (const a of TEXT_PROTECT_AREAS) {
    if (a.paths.some(p => pathname === p || pathname.startsWith(p + '/'))) return a.key;
  }
  return null;
}

/** 지금 이 페이지에서 글 복사 방지가 켜져 있는가 (방문자 기준 — 관리자는 늘 false) */
export function useTextProtectActive(): boolean {
  const pathname = usePathname();
  const [ms] = useMenuSettings();
  const { isAdmin } = useAuth();
  const area = textProtectAreaFor(pathname ?? '');
  return !isAdmin && !!area && ((ms as WithText).textProtect ?? []).includes(area);
}

/** 입력칸·편집 영역은 막지 않는다 (댓글·검색·방명록 쓰기 등) */
const editable = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

const CSS = `.txt-protect-on body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.txt-protect-on input,.txt-protect-on textarea,.txt-protect-on select,.txt-protect-on [contenteditable=""],.txt-protect-on [contenteditable="true"]{-webkit-user-select:text;user-select:text}`;

/** 레이아웃에 한 번 — 보호 영역이면 html에 txt-protect-on을 붙이고 복사·선택을 막는다 */
export function TextProtect() {
  const active = useTextProtectActive();
  useEffect(() => {
    if (!active) return;
    const stop = (e: Event) => { if (!editable(e.target) && !editable(document.activeElement)) e.preventDefault(); };
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (!/^[acx]$/i.test(e.key)) return;
      if (editable(e.target)) return;
      e.preventDefault();
    };
    const sel = (e: Event) => { if (!editable(e.target)) e.preventDefault(); };
    document.addEventListener('copy', stop, true);
    document.addEventListener('cut', stop, true);
    document.addEventListener('selectstart', sel, true);
    document.addEventListener('keydown', key, true);
    document.documentElement.classList.add('txt-protect-on');
    try { window.getSelection()?.removeAllRanges(); } catch { /* 무시 */ }
    return () => {
      document.removeEventListener('copy', stop, true);
      document.removeEventListener('cut', stop, true);
      document.removeEventListener('selectstart', sel, true);
      document.removeEventListener('keydown', key, true);
      document.documentElement.classList.remove('txt-protect-on');
    };
  }, [active]);
  return active ? <style>{CSS}</style> : null;
}

/** 로그 상자(iframe) 안에 넣는 차단 — 상자는 사이트와 분리돼 있어 바깥 차단이 닿지 않는다 */
export const TEXT_PROTECT_IFRAME = `<style>html,body,body *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
input,textarea,[contenteditable]{-webkit-user-select:text!important;user-select:text!important}</style><script>(function(){
function ed(t){try{return !!(t&&t.closest&&t.closest('input,textarea,select,[contenteditable]'));}catch(e){return false;}}
function stop(e){if(!ed(e.target))e.preventDefault();}
['copy','cut','selectstart','contextmenu','dragstart'].forEach(function(t){document.addEventListener(t,stop,true);});
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&/^[acxsp]$/i.test(e.key)&&!ed(e.target))e.preventDefault();},true);
})();</scr${''}ipt>`;

/** 환경설정 > 메뉴 관리 > 권한 — 「이미지 저장 방지」 아래에 붙는 체크 칸 */
export function TextProtectOptions() {
  const [ms, patch] = useMenuSettings();
  const cur = (ms as WithText).textProtect ?? [];
  const set = (k: TextProtectArea, v: boolean) =>
    patch({ textProtect: v ? [...cur.filter(x => x !== k), k] : cur.filter(x => x !== k) } as unknown as Partial<MenuSettings>);
  return (
    <div style={{ marginTop: 18 }}>
      <b style={{ fontSize: 13 }}>글 복사 방지</b>
      <div className="d" style={{ marginTop: 4 }}>
        체크한 영역에서 글 드래그 선택·복사·전체 선택(Ctrl+A)을 막습니다 — 로그 본문 포함 · 관리자 계정은 제외 · 즉시 반영
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        {TEXT_PROTECT_AREAS.map(a => (
          <KCheck key={a.key} label={a.label} checked={cur.includes(a.key)} onChange={v => set(a.key, v)} />
        ))}
      </div>
    </div>
  );
}
