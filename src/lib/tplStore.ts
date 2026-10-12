'use client';
// 캐릭터 양식 저장소 — 관리자가 등록한 양식 목록 (세계관에 연결할 수 있음).
// 양식은 누구나 읽을 수 있어야(캐릭터 화면이 양식으로 그려지므로) 항상 전체공개로 저장하고,
// 쓰기는 서버 규칙에서 관리자만 허용한다.
// 새 파일로 따로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게.
import { useMemo } from 'react';
import { useRawList, type RawList } from './rawList';
import type { CharTab } from './charStore';
import { renderTpl, type TplCode } from './tplRender';

export const TPL_KEY = 'ohome.ctpl.v1';

export interface CharTemplate extends TplCode {
  id: string;
  worldId?: string;          // 연결한 세계관 — 그 세계관 캐릭터에서 목록 맨 위에
  visibility: 'public';
  date: string;
  tags?: string[];
}


export function useTemplates(): RawList<CharTemplate> {
  return useRawList<CharTemplate>(TPL_KEY, []);
}

/** 세계관 양식이 먼저, 그다음 공통 양식, 나머지 순 */
export function useTemplateChoices(worldId?: string) {
  const src = useTemplates();
  const sorted = useMemo(() => {
    const rank = (t: CharTemplate) => (worldId && t.worldId === worldId ? 0 : !t.worldId ? 1 : 2);
    return [...src.list].sort((a, b) => rank(a) - rank(b));
  }, [src.list, worldId]);
  return { ...src, sorted };
}

/** 탭의 표시용 HTML — 양식 탭이면 지금 양식으로 다시 그리고, 양식을 못 찾으면 저장해 둔 HTML */
export function tabHtmlOf(tab: CharTab, templates: CharTemplate[]): string {
  const t = tab.tpl;
  if (!t) return tab.html;
  const tpl = templates.find(x => x.id === t.id);
  const page = tpl?.pages[t.page];
  return page ? renderTpl(page.html, t.values) : tab.html;
}
