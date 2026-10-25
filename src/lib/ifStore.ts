'use client';
// IF 썰 (포크) — 「만약 ○○한다면?」 질문과 캐릭터들의 반응.
//
// 질문(IfPost)과 반응(IfReaction)을 따로 저장한다 — 댓글·자관 문답과 같은 이유:
// 반응을 질문 문서 안에 두면 남의 질문에 반응을 달 때마다 그 질문을 수정해야 해서
// 「수정은 작성자·관리자만」 규칙에 막힌다. 따로 두면 반응마다 자기 authorId를 갖는다.
// 새 파일로 따로 둔 이유: 원작 저장소 업데이트(Sync fork)와 충돌하지 않게.

export const IF_KEY = 'ohome.ifs.v1';
export const IF_REACT_KEY = 'ohome.ifreacts.v1';

export interface IfPost {
  id: string;
  title: string;          // 「누군가 번호를 물어본다!」
  situation?: string;     // 상황 한 줄 — 「A : 너무 제 취향이라 그런데 번호 좀…」
  tags?: string[];
  author: string;
  authorId: string;
  date: string;
  visibility: 'public';
}

export interface IfReaction {
  id: string;
  ifId: string;
  name: string;           // 보이는 이름 — 캐릭터 이름 또는 별명(찬·양쏘…)
  charId?: string;        // 등록된 캐릭터와 이름이 같으면 연결 → 사진·테마색
  group?: string;         // 묶음 이름 — 자관 이름 등 (<#찬박도태>)
  relId?: string;         // 묶음이 등록된 자관이면 연결
  text: string;           // 반응 — (괄호)는 지문으로 표시
  author: string;
  authorId: string;
  date: string;
  order: number;          // 붙여넣은 순서
  visibility: 'public';
}

export const IF_SEED: IfPost[] = [
  {
    id: 'if-demo-1', title: '누군가 번호를 물어본다!',
    situation: 'A : 너무 제 취향이라 그런데 번호 좀 주실 수 있을까요?ㅠㅠ',
    author: '관리자', authorId: 'admin', date: '2026-10-25T22:00:00.000Z', visibility: 'public',
  },
];
export const IF_REACT_SEED: IfReaction[] = [
  ['키이라', '무시'], ['은우', '아앗 ㅎㅎ; 죄송합니다~'], ['찬', 'ㅎㅎ (재현이 번호 줌)'],
  ['진우', '남자친구 있습니다.'], ['태영', '하핰 저 마음에 들어요? 어디가? 근데 죄송해요 ㅠㅠ 전 그쪽이 마음에 안 들어용'],
].map(([name, text], i) => ({
  id: `if-demo-r${i}`, ifId: 'if-demo-1', name, text, author: '관리자', authorId: 'admin',
  date: '2026-10-25T22:00:00.000Z', order: i, visibility: 'public' as const,
}));

/** 질문 하나의 반응 — 붙여넣은 순서, 같으면 단 시각 */
export function reactionsFor(rows: IfReaction[], ifId: string): IfReaction[] {
  return rows.filter(r => r.ifId === ifId)
    .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date));
}

/** 반응 글 → 대사/지문 조각. (괄호) 안은 지문 */
export function splitAction(text: string): { kind: 'say' | 'act'; s: string }[] {
  const out: { kind: 'say' | 'act'; s: string }[] = [];
  const re = /[(（]([^()（）]*)[)）]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: 'say', s: text.slice(last, m.index) });
    out.push({ kind: 'act', s: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ kind: 'say', s: text.slice(last) });
  return out.map(p => ({ ...p, s: p.s.trim() })).filter(p => p.s);
}

/**
 * 한 번에 붙여넣기 — 한 줄에 「이름: 반응」. 이름 없이 이어지는 줄은 앞 반응에 붙는다.
 *   <#찬박도태>  또는  [찬박도태]   → 다음 줄들을 그 묶음으로 (자관 이름이면 자관에 연결)
 *   <#>  또는  []                    → 묶음 끝
 *   《누군가 번호를 물어본다!》     → 무시 (질문 제목을 같이 붙여 넣어도 괜찮게)
 */
export function parseReactions(text: string): { name: string; text: string; group?: string }[] {
  const out: { name: string; text: string; group?: string }[] = [];
  let group: string | undefined;
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const g = /^(?:<#\s*([^>]*)>|\[\s*([^\]]*)\])$/.exec(line);
    if (g) { const v = (g[1] ?? g[2] ?? '').trim(); group = v || undefined; continue; }
    if (/^《.*》$/.test(line)) continue;
    const m = /^([^:：]{1,24}?)\s*[:：]\s*(.*)$/.exec(line);
    if (m && !/^https?$/i.test(m[1])) { out.push({ name: m[1].trim(), text: m[2].trim(), group }); continue; }
    if (out.length) out[out.length - 1].text += (out[out.length - 1].text ? '\n' : '') + line;
  }
  return out.filter(r => r.name);
}

/** 이름 → 고정 색 (사진 없는 반응의 동그라미) */
export function nameColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 55%)`;
}
