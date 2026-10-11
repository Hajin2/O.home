'use client';
// 위젯 공유 (포크 기능) — AI 채팅 플랫폼(케이브덕 · 티팟 …)에서 만든 위젯을 「작동 예시」와 함께 소개한다.
// 가져가기는 각 플랫폼의 공유 링크로 — 홈페이지는 어떻게 작동하는지 보여 주는 곳.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import { useMemo } from 'react';
import { useRawList, type RawList } from './rawList';
import { useCanSee } from './worldStore';
import type { Visibility } from './charStore';
import type { CropValue } from '@/components/ui/CropEditor';

export const WIDGET_KEY = 'ohome.widgets.v1';

export type WidgetPlatform = 'caveduck' | 'teapot' | 'etc';
export type WidgetMode = 'simple' | 'live';
export const PLATFORM_LABEL: Record<WidgetPlatform, string> = { caveduck: '케이브덕', teapot: '티팟', etc: '기타' };
export const PLATFORMS: WidgetPlatform[] = ['caveduck', 'teapot', 'etc'];
/** 플랫폼 뱃지·썸네일 바탕색 */
export const PLATFORM_TINT: Record<WidgetPlatform, string> = {
  caveduck: 'linear-gradient(135deg,#ffe9a8,#ffc76b)',
  teapot: 'linear-gradient(135deg,#d8f0e4,#9fd6bd)',
  etc: 'linear-gradient(135deg,#e6e8ee,#c9cdd6)',
};

/** 케이브덕 상태값 — 위젯 HTML의 {{key}} 자리에 들어간다. example은 홈페이지 미리보기용 예시 값 */
export interface CaveState { key: string; instruction: string; example?: string }

/** 티팟 Props — 편집기 기준 string / number / boolean 만 */
export type TeapotPropType = 'string' | 'number' | 'boolean';
export interface TeapotProp { name: string; type: TeapotPropType; example: string; description?: string }

export interface Widget {
  id: string;
  title: string;
  platform: WidgetPlatform;
  shareUrl?: string;          // 플랫폼 공유 링크 — 「가져가기」 버튼
  sub?: string;               // 한 줄 소개
  note?: string;              // 사용법·설명 (여러 줄)
  tags?: string[];
  imgId?: string;             // 목록 썸네일 (선택 — 없으면 플랫폼 색 바탕)
  crop?: CropValue;
  visibility: Visibility;
  showCode?: boolean;         // 코드·상태값을 방문자에게도 보여 줄지 (관리자는 항상 봄)
  /** 등록 방식 — 'simple': 공유 링크 + 스크린샷/GIF만 (위젯 코드 없이) · 'live': 코드를 붙여 넣어 작동 예시까지.
   *  없으면(예전 데이터) 'live' */
  mode?: WidgetMode;
  date: string;
  // 케이브덕
  states?: CaveState[];
  html?: string;
  userName?: string;          // 미리보기에서 {{user}} 자리 (기본 「유저」)
  charName?: string;          // 미리보기에서 {{char}} 자리 (기본 「캐릭터」)
  // 티팟
  componentName?: string;
  displayName?: string;
  description?: string;       // AI가 언제 부를지
  jsx?: string;
  props?: TeapotProp[];
  // 기타 플랫폼 — HTML 그대로
  previewHeight?: number;     // 작동 예시 상자 높이 고정 (비우면 내용에 맞춤)
}

export const WIDGET_SEED: Widget[] = [];
export const widgetPath = (w: { id: string }) => `/widgets/${w.id}`;
/** 작동 예시를 띄울 위젯인가 — 「작동 예시까지」로 등록했고 코드가 있을 때만 */
export const isLive = (w: Pick<Widget, 'mode' | 'platform' | 'html' | 'jsx'>) =>
  (w.mode ?? 'live') === 'live' && !!(w.platform === 'teapot' ? w.jsx?.trim() : w.html?.trim());

export function useWidgetList(): RawList<Widget> {
  return useRawList<Widget>(WIDGET_KEY, WIDGET_SEED);
}

export function useVisibleWidgets(): RawList<Widget> & { visible: Widget[] } {
  const src = useWidgetList();
  const canSee = useCanSee();
  const visible = useMemo(() => src.list.filter(w => canSee(w.visibility)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src.list, canSee]);
  return { ...src, visible };
}

/* ---------- 케이브덕 편집 화면 「통째로 복사」 붙여넣기 → 상태값·지시사항·HTML 나누기 ----------
   케이브덕 위젯 편집 화면을 전체 선택해 복사하면 대략 이런 모양이 된다:
     상태값 \n 1 \n 지시사항 \n 턴수 \n\n 상태값 \n 2 \n 지시사항 \n …  \n 정보 추가 \n 위젯 콘텐츠 \n\n 작성 \n <div …> … </div> \n 미리보기 …
   (첫 항목은 「상태값 \n\n 1 \n 지시사항」처럼 빈 줄이 끼기도 한다) */
export function parseCaveduckCopy(text: string): { states: CaveState[]; html: string } {
  const lines = text.replace(/\r/g, '').split('\n');
  const states: CaveState[] = [];
  let i = 0;
  const nextNonEmpty = (j: number) => { while (j < lines.length && !lines[j].trim()) j++; return j; };
  // 상태값 블록들
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '위젯 콘텐츠' || t === '정보 추가') break;
    if (t !== '상태값') continue;
    const k = nextNonEmpty(i + 1);
    if (k >= lines.length) break;
    const key = lines[k].trim();
    let j = nextNonEmpty(k + 1);
    if (lines[j]?.trim() !== '지시사항') continue;
    j = nextNonEmpty(j + 1);
    const ins: string[] = [];
    while (j < lines.length && !['상태값', '정보 추가', '위젯 콘텐츠'].includes(lines[j].trim())) {
      if (lines[j].trim()) ins.push(lines[j].trim());
      j++;
    }
    if (key && !states.some(s => s.key === key)) states.push({ key, instruction: ins.join(' ') });
    i = j - 1;
  }
  // HTML — 「위젯 콘텐츠」 뒤 첫 '<'부터, 「미리보기」 줄 전까지
  let html = '';
  const start = lines.findIndex((l, n) => n >= i && l.trim().startsWith('<'));
  if (start >= 0) {
    let end = lines.findIndex((l, n) => n > start && l.trim() === '미리보기');
    if (end < 0) end = lines.length;
    html = lines.slice(start, end).join('\n').trim();
    // 편집 화면을 복사하면 콘텐츠가 두 번 붙어 오기도 한다 — 같은 덩어리 반복이면 하나만
    const head = html.split('\n')[0];
    const again = head ? html.indexOf(head, head.length) : -1;
    if (again > 0 && html.slice(0, again).trim() === html.slice(again).trim()) html = html.slice(0, again).trim();
  }
  if (!html) {
    // 위치를 못 찾았으면 가장 큰 <div …> … </div> 덩어리라도
    const m = text.match(/<div[\s\S]*<\/div>/);
    if (m) html = m[0];
  }
  return { states, html };
}

/** 위젯 HTML 안에 쓰인 {{키}} 목록 (등장 순서) */
export function placeholdersOf(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}
