'use client';
// 캐릭터 목록의 세계관 탭 (포크 기능) — 「전체 · 세계관A · 세계관B · … · 미지정」
// 캐릭터의 「소속 세계관」(worldId)으로 나눈다. 탭 순서는 세계관 목록의 순서(ORDER로 정한 것) 그대로.
// 고른 탭은 주소(?world=)에 남아 새로고침·링크 공유에도 유지된다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Character } from '@/lib/charStore';
import { useVisibleWorlds } from '@/lib/worldStore';

export const NO_WORLD = '_none';   // 「미지정」 탭 값

/** 세계관 탭 — base: 이 사람이 볼 수 있는 캐릭터 전체(세계관·태그로 거르기 전).
 *  onTabChange: 탭이 바뀔 때 함께 할 일(예: 태그 선택 풀기 — 다른 세계관엔 없는 태그가 남지 않게) */
export function useWorldTabs(base: Character[], onTabChange?: () => void) {
  const worlds = useVisibleWorlds();
  const [tab, setTabState] = useState('');   // '' = 전체
  const first = useRef(true);

  // 처음 열 때 주소에서 읽는다
  useEffect(() => {
    try {
      const w = new URLSearchParams(window.location.search).get('world');
      if (w) setTabState(w);
    } catch { /* 무시 */ }
  }, []);
  // 바뀌면 주소에 반영 (기록을 쌓지 않고 교체)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try {
      const url = new URL(window.location.href);
      if (tab) url.searchParams.set('world', tab); else url.searchParams.delete('world');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch { /* 무시 */ }
  }, [tab]);

  const setTab = useCallback((v: string) => {
    if (v !== tab) onTabChange?.();
    setTabState(v);
  }, [tab, onTabChange]);

  // 이 사람에게 보이는 세계관만 — 안 보이는 세계관에 속한 캐릭터는 「미지정」으로 묶는다
  const ids = useMemo(() => new Set(worlds.visible.map(w => w.id)), [worlds.visible]);
  const keyOf = useCallback((c: Character) => (c.worldId && ids.has(c.worldId) ? c.worldId : NO_WORLD), [ids]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    base.forEach(c => { const k = keyOf(c); m[k] = (m[k] ?? 0) + 1; });
    return m;
  }, [base, keyOf]);

  const match = useCallback((c: Character) => !tab || keyOf(c) === tab, [tab, keyOf]);

  // 캐릭터가 있는 세계관만 탭으로 (지금 고른 탭은 비어도 남겨 둔다 — 갑자기 사라지지 않게)
  const tabs = worlds.visible.filter(w => (counts[w.id] ?? 0) > 0 || w.id === tab);
  const showNone = (counts[NO_WORLD] ?? 0) > 0 || tab === NO_WORLD;
  // 세계관이 하나도 안 쓰였으면 탭 줄 자체를 그리지 않는다 (예전 화면 그대로)
  const hidden = tabs.length === 0;

  const btn = (v: string, label: string, n: number) => (
    <button key={v || 'all'} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>
      {label}<small>{n}</small>
    </button>
  );

  const element = hidden ? null : (
    <div className="wtabs" role="tablist" aria-label="세계관">
      {/* 색은 페이지 제목·설명 색 변수를 따른다 — 밝은/어두운 테마 어디서나 보이게 */}
      <style>{`
        .wtabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin-bottom:14px;overflow-x:auto;scrollbar-width:none}
        .wtabs::-webkit-scrollbar{display:none}
        .wtabs>button{flex-shrink:0;white-space:nowrap;font-family:var(--serif);letter-spacing:.14em;font-size:calc(14px*var(--fs,1));
          color:var(--page-desc,var(--faint));padding:6px 14px 11px;border-bottom:2px solid transparent;margin-bottom:-1px;transition:.15s;opacity:.85}
        .wtabs>button:hover{opacity:1;color:var(--page-title,var(--ink))}
        .wtabs>button.on{opacity:1;color:var(--page-title,var(--ink));border-bottom-color:var(--page-title,var(--ink))}
        .wtabs>button small{font-family:var(--sans,inherit);letter-spacing:0;font-size:11px;margin-left:6px;opacity:.7}
      `}</style>
      {btn('', '전체', base.length)}
      {tabs.map(w => btn(w.id, w.name, counts[w.id] ?? 0))}
      {showNone && btn(NO_WORLD, '미지정', counts[NO_WORLD] ?? 0)}
    </div>
  );

  return { tab, setTab, match, element };
}

/** 일부만 보이는 상태(세계관 탭·태그·검색)에서 순서를 바꿨을 때 — 보이던 항목들이 원래 차지하던
 *  자리 안에서만 순서를 바꾼다. (원작 mergeOrder는 보이는 것들을 전체 맨 앞으로 몰아서, 탭 하나에서
 *  정렬하면 그 세계관 캐릭터들이 「전체」 탭 맨 앞으로 몰려 버렸다) */
export function mergeInPlace<T extends { id: string }>(all: T[], reorderedShown: T[]): T[] {
  const shownIds = new Set(reorderedShown.map(x => x.id));
  let k = 0;
  return all.map(x => (shownIds.has(x.id) ? reorderedShown[k++] ?? x : x));
}

