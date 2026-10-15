// 캐릭터 양식 — 양식 코드 해석·검사·렌더 (화면과 무관한 순수 함수만 — 테스트하기 쉽게 따로 둔다)
//
// 양식 HTML 안의 표시 (머스태시 일부):
//   {{key}}            값 (HTML 이스케이프, 줄바꿈은 <br>)
//   {{key|blank}}      값이 비면 밑줄 빈칸
//   {{#key}}…{{/key}}  목록·묶음이면 항목마다 반복 / 값이 있으면 한 번
//   {{^key}}…{{/key}}  값이 비었을 때만
//   {{.}}              목록 안에서 현재 항목
//   {{@n}} {{@i}}      목록 안 순번 — 01·02… / 1·2…
//   {{key.count}}      목록·묶음의 개수
//   {{key.strong}}     상태 뱃지가 「강조」인지 (섹션 조건으로)
//
// 입력한 글 안의 서식: **굵게** · *기울임* · ~~취소선~~ (그 밖의 HTML은 글자 그대로 보인다)
// 새 파일로 따로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게.

export type TplFieldType = 'text' | 'long' | 'list' | 'group' | 'badge' | 'image' | 'heading';

export interface TplField {
  key: string;            // heading이면 생략 가능
  label: string;
  type: TplFieldType;
  page?: number;          // 입력 화면에서 어느 탭 아래 보일지 (0부터) — 없으면 0
  ph?: string;            // 입력칸 안내 글
  sub?: TplField[];       // group의 한 묶음 안 칸 (text·long·list·badge·image)
  extra?: boolean;        // group 전용 — 글 입력에서 「[아무 제목]: 내용」 줄을 이 묶음의 한 항목(title·text)으로 받는다
}

export interface TplPage { title: string; icon: string; html: string }

/** 관리자가 붙여 넣는 「양식 코드」 */
export interface TplCode {
  name: string;
  fields: TplField[];
  pages: TplPage[];
}

export interface BadgeValue { text: string; strong: boolean }
export type TplValue = string | string[] | BadgeValue | Record<string, unknown>[];
export type TplValues = Record<string, TplValue>;

/** 캐릭터 탭에 붙는 양식 정보 — 같은 양식에서 만든 탭들은 group이 같고 값을 똑같이 갖는다 */
export interface TabTpl {
  id: string;        // 양식 id
  page: number;      // 양식의 몇 번째 탭인지
  group: string;     // 한 번 「양식으로 추가」할 때 만든 묶음 id
  values: TplValues;
}

const SUB_TYPES: TplFieldType[] = ['text', 'long', 'list', 'badge', 'image'];
const TOP_TYPES: TplFieldType[] = ['text', 'long', 'list', 'group', 'badge', 'image', 'heading'];

/** 양식 코드 검사 — 문제 목록을 돌려준다(비면 통과) */
export function parseTplCode(raw: string): { code?: TplCode; errors: string[] } {
  const errors: string[] = [];
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return { errors: ['양식 코드를 읽을 수 없어요 — 받은 코드를 처음부터 끝까지 그대로 붙여 넣어 주세요'] }; }
  const o = obj as Partial<TplCode>;
  if (!o || typeof o !== 'object') return { errors: ['양식 코드 형식이 아니에요'] };
  if (typeof o.name !== 'string' || !o.name.trim()) errors.push('양식 이름(name)이 없어요');
  if (!Array.isArray(o.pages) || !o.pages.length) errors.push('탭(pages)이 하나 이상 있어야 해요');
  if (!Array.isArray(o.fields)) errors.push('입력칸 목록(fields)이 없어요');
  if (errors.length) return { errors };
  const keys = new Set<string>();
  const checkField = (f: TplField, allowed: TplFieldType[], where: string) => {
    if (!f || typeof f !== 'object' || !allowed.includes(f.type)) { errors.push(`${where}: 알 수 없는 칸 종류 「${f?.type}」`); return; }
    if (typeof f.label !== 'string') errors.push(`${where}: 이름(label)이 없어요`);
    if (f.type !== 'heading' && (typeof f.key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.key))) errors.push(`${where}: 키(key)는 영문·숫자·_ 만 쓸 수 있어요`);
    if (f.type === 'group') {
      if (!Array.isArray(f.sub) || !f.sub.length) errors.push(`${where}: 묶음(group)에는 sub 칸이 필요해요`);
      else f.sub.forEach((s, j) => checkField(s, SUB_TYPES, `${where} › ${j + 1}번째 칸`));
    }
  };
  o.fields!.forEach((f, i) => {
    checkField(f, TOP_TYPES, `${i + 1}번째 칸`);
    if (f?.type !== 'heading' && f?.key) {
      if (keys.has(f.key)) errors.push(`키 「${f.key}」가 두 번 쓰였어요`);
      keys.add(f.key);
    }
  });
  o.pages!.forEach((p, i) => {
    if (!p || typeof p.html !== 'string') errors.push(`${i + 1}번째 탭에 html이 없어요`);
    else {
      try { compile(p.html); } catch (e) { errors.push(`${i + 1}번째 탭: ${(e as Error).message}`); }
    }
  });
  if (errors.length) return { errors };
  return {
    code: {
      name: o.name!.trim(),
      fields: o.fields!,
      pages: o.pages!.map(p => ({ title: String(p.title ?? ''), icon: String(p.icon || '✦').slice(0, 2), html: p.html })),
    },
    errors,
  };
}

/* ---------- 렌더 ---------- */

type Node =
  | { t: 'text'; s: string }
  | { t: 'var'; name: string; filter?: string }
  | { t: 'sec'; name: string; inv: boolean; kids: Node[] };

const TAG = /\{\{\s*([#^/]?)\s*([^{}|]+?)\s*(?:\|\s*([a-z]+)\s*)?\}\}/g;
const cache = new Map<string, Node[]>();

function compile(src: string): Node[] {
  const hit = cache.get(src);
  if (hit) return hit;
  const root: Node[] = [];
  const stack: { name: string; kids: Node[] }[] = [{ name: '', kids: root }];
  let last = 0;
  let m: RegExpExecArray | null;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(src))) {
    const top = stack[stack.length - 1];
    if (m.index > last) top.kids.push({ t: 'text', s: src.slice(last, m.index) });
    last = TAG.lastIndex;
    const [, op, name, filter] = m;
    if (op === '#' || op === '^') {
      const sec: Node = { t: 'sec', name, inv: op === '^', kids: [] };
      top.kids.push(sec);
      stack.push({ name, kids: sec.kids });
    } else if (op === '/') {
      if (stack.length < 2 || top.name !== name) throw new Error(`{{/${name}}} 짝이 맞지 않아요`);
      stack.pop();
    } else top.kids.push({ t: 'var', name, filter });
  }
  if (stack.length > 1) throw new Error(`{{#${stack[stack.length - 1].name}}} 가 닫히지 않았어요`);
  if (last < src.length) root.push({ t: 'text', s: src.slice(last) });
  cache.set(src, root);
  return root;
}

interface Ctx { v: unknown; i?: number }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 입력한 글 → 안전한 HTML. 먼저 전부 이스케이프한 뒤 서식 기호만 태그로 바꾼다 */
export function fmtText(s: string): string {
  return esc(s)
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/\r?\n/g, '<br>');
}

function lookup(stack: Ctx[], name: string): unknown {
  if (name === '.') return stack[stack.length - 1].v;
  if (name === '@n' || name === '@i') {
    for (let k = stack.length - 1; k >= 0; k--) {
      const i = stack[k].i;
      if (i !== undefined) return name === '@n' ? String(i + 1).padStart(2, '0') : String(i + 1);
    }
    return '';
  }
  const [head, ...rest] = name.split('.');
  let cur: unknown;
  for (let k = stack.length - 1; k >= 0; k--) {
    const v = stack[k].v;
    if (v && typeof v === 'object' && !Array.isArray(v) && head in (v as object)) { cur = (v as Record<string, unknown>)[head]; break; }
  }
  for (const p of rest) {
    if (p === 'count' && Array.isArray(cur)) { cur = cur.filter(filled).length; continue; }
    cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
  }
  return cur;
}

/** 값이 채워져 있는가 — 빈 글·빈 목록·빈 뱃지는 비어 있음 */
export function filled(v: unknown): boolean {
  if (v == null || v === false) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  if (Array.isArray(v)) return v.some(filled);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('text' in o && 'strong' in o) return filled(o.text);
    return Object.values(o).some(filled);
  }
  return true;
}

function textOf(v: unknown): string {
  if (v == null || v === false) return '';
  if (typeof v === 'object' && !Array.isArray(v) && 'text' in (v as object)) return String((v as BadgeValue).text ?? '');
  if (Array.isArray(v)) return v.filter(filled).map(textOf).join(', ');
  return String(v);
}

export const BLANK = '<span style="display:inline-block;min-width:4em;border-bottom:1px solid var(--line, rgba(0,0,0,.14));height:1.1em;vertical-align:-2px"></span>';

function run(nodes: Node[], stack: Ctx[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.s;
    else if (n.t === 'var') {
      const s = textOf(lookup(stack, n.name)).trim();
      out += s ? fmtText(s) : (n.filter === 'blank' ? BLANK : '');
    } else {
      const v = lookup(stack, n.name);
      const has = filled(v);
      if (n.inv) { if (!has) out += run(n.kids, stack); continue; }
      if (!has) continue;
      if (Array.isArray(v)) {
        v.filter(filled).forEach((item, i) => { out += run(n.kids, [...stack, { v: item, i }]); });
      } else out += run(n.kids, [...stack, { v }]);
    }
  }
  return out;
}

/** 양식 탭 HTML + 값 → 완성 HTML (화면에 넣기 전 sanitize는 부르는 쪽에서) */
export function renderTpl(html: string, values: TplValues): string {
  try { return run(compile(html), [{ v: values }]); } catch { return ''; }
}

/** 칸 종류별 빈 값 */
export function emptyOf(f: TplField): TplValue {
  if (f.type === 'list') return [];
  if (f.type === 'group') return [];
  if (f.type === 'badge') return { text: '', strong: false };
  return '';
}

/* ---------- 글로 한 번에 입력 ---------- *
 * 형식 (칸 이름은 양식의 label 그대로):
 *   # 탭 제목 / ## 소제목     — 읽을 때는 무시 (묶음을 닫는 구분선 역할)
 *   이름: 권이안              — 한 줄 글
 *   능력 설명:                — 여러 줄 글은 다음 줄부터 이어서
 *   부작용:                   — 목록은 「- 」로 시작하는 줄마다 한 항목
 *   - 첫 항목
 *   현재 상태: 불안정 (강조)  — 상태 뱃지, 끝에 (강조)를 붙이면 강조
 *   [팀 내 평가]              — 묶음 하나 시작 (같은 이름을 또 쓰면 다음 묶음)
 *   평가자: 한시언 팀장
 *   [익명_현실_정보]          — 소제목(heading) 이름과 같으면 그 구역 시작 — 구역마다 같은 칸 이름(성별 등)을 따로 쓸 수 있다
 *   [착각계 포인트]: 내용     — 그 밖의 [제목]은 양식에 「기타 묶음(extra)」이 있으면 그 묶음 한 항목, 없으면 구분선
 */

const STRONG = /\s*\(강조\)\s*$/;

function scalarText(f: TplField, v: unknown): string[] {
  if (f.type === 'list') {
    const arr = Array.isArray(v) ? (v as unknown[]).map(x => String(x ?? '')).filter(x => x.trim()) : [];
    return [`${f.label}:`, ...arr.map(x => `- ${x.replace(/\n/g, '\n  ')}`)];
  }
  if (f.type === 'badge') {
    const b = (v && typeof v === 'object' ? v : { text: '', strong: false }) as BadgeValue;
    return [`${f.label}: ${b.text ?? ''}${b.strong && b.text ? ' (강조)' : ''}`];
  }
  const s = typeof v === 'string' ? v : '';
  if (f.type === 'long' || s.includes('\n')) return [`${f.label}:`, ...(s ? s.split('\n') : [])];
  return [`${f.label}: ${s}`];
}

/** 지금 값 → 글 */
export function valuesToText(code: Pick<TplCode, 'fields' | 'pages'>, values: TplValues): string {
  const out: string[] = [];
  code.pages.forEach((p, pi) => {
    out.push(`# ${p.title || `탭 ${pi + 1}`}`);
    for (const f of code.fields.filter(x => (x.page ?? 0) === pi)) {
      if (f.type === 'heading') { out.push('', `## ${f.label}`); continue; }
      if (f.type === 'image') continue;
      const v = values[f.key];
      if (f.type === 'group' && f.extra) {
        const items = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
        for (const it of items) out.push(`[${String(it.title ?? '')}]:`, ...String(it.text ?? '').split('\n'));
        if (items.length) out.push('');
        continue;
      }
      if (f.type === 'group') {
        const items = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
        if (!items.length) out.push(`[${f.label}]`, ...(f.sub ?? []).filter(s => s.type !== 'image').flatMap(s => scalarText(s, undefined)));
        for (const it of items) {
          out.push(`[${f.label}]`);
          for (const s of f.sub ?? []) if (s.type !== 'image') out.push(...scalarText(s, it[s.key]));
        }
        out.push('');
        continue;
      }
      out.push(...scalarText(f, v));
    }
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** 글 → 값. 글에 없는 칸은 지금 값을 그대로 둔다(이미지 등). 알아보지 못한 줄 수를 함께 돌려준다 */
export function parseValuesText(code: Pick<TplCode, 'fields'>, text: string, base: TplValues = {}): { values: TplValues; unknown: string[] } {
  const top = code.fields.filter(f => f.type !== 'heading' && f.type !== 'image');
  const byLabel = (list: TplField[], label: string) => list.find(f => f.label.trim() === label.trim());
  // 구역 — 소제목(heading)마다 그 아래 칸들. 같은 이름 칸이 여러 구역에 있으면 지금 구역 것을 먼저 고른다
  const sections: TplField[][] = [[]];
  const headingAt = new Map<string, number>();
  for (const f of code.fields) {
    if (f.type === 'heading') { sections.push([]); if (!headingAt.has(f.label.trim())) headingAt.set(f.label.trim(), sections.length - 1); }
    else if (f.type !== 'image') sections[sections.length - 1].push(f);
  }
  let section = -1;
  const topByLabel = (label: string) => (section >= 0 ? byLabel(sections[section], label) : undefined) ?? byLabel(top, label);
  const extraF = top.find(f => f.type === 'group' && f.extra);
  const values: TplValues = { ...base };
  // 글에 나온 칸만 덮어쓴다 — 처음 나올 때 비우고 채운다
  const touched = new Set<string>();
  const unknown: string[] = [];

  let group: { f: TplField; item: Record<string, unknown> } | null = null;
  let cur: { f: TplField; set: (v: unknown) => void; get: () => unknown } | null = null;

  const startField = (f: TplField, rest: string, holder: Record<string, unknown>, isTop: boolean) => {
    if (isTop && !touched.has(f.key)) { touched.add(f.key); holder[f.key] = emptyOf(f); }
    const set = (v: unknown) => { holder[f.key] = v; };
    const get = () => holder[f.key];
    cur = { f, set, get };
    if (f.type === 'badge') {
      const strong = STRONG.test(rest);
      set({ text: rest.replace(STRONG, '').trim(), strong });
      cur = null;
    } else if (f.type === 'list') {
      set(rest.trim() ? [rest.trim()] : []);
    } else set(rest.trim());
  };

  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) { group = null; cur = null; const at = headingAt.get(h[1].trim()); if (at !== undefined) section = at; continue; }
    const g = /^\[([^\]]+)\]\s*(?:[:：]\s?(.*))?$/.exec(line.trim());
    if (g && g[2] === undefined) {
      const at = headingAt.get(g[1].trim());
      if (at !== undefined) { section = at; group = null; cur = null; continue; }
    }
    if (g && !(g[2] === undefined && byLabel(top, g[1])?.type === 'group')) {
      // 양식에 없는 [제목] — 기타 묶음이 있으면 그 한 항목으로, 없으면 구분선 (앞 칸에 붙지 않게)
      group = null; cur = null;
      if (extraF) {
        if (!touched.has(extraF.key)) { touched.add(extraF.key); values[extraF.key] = []; }
        const item: Record<string, unknown> = { title: g[1].trim(), text: (g[2] ?? '').trim() };
        (values[extraF.key] as Record<string, unknown>[]).push(item);
        cur = { f: { key: 'text', label: '', type: 'long' }, set: v => { item.text = v; }, get: () => item.text };
      }
      continue;
    }
    if (g) {
      const f = byLabel(top, g[1]);
      if (f?.type === 'group') {
        if (!touched.has(f.key)) { touched.add(f.key); values[f.key] = []; }
        const item: Record<string, unknown> = Object.fromEntries((f.sub ?? []).map(s => [s.key, emptyOf(s)]));
        (values[f.key] as Record<string, unknown>[]).push(item);
        group = { f, item }; cur = null;
        continue;
      }
    }
    const m = /^([^:：\-·!•*][^:：]{0,40}?)\s*[:：]\s?(.*)$/.exec(line);
    if (m) {
      const sub = group ? byLabel(group.f.sub ?? [], m[1]) : undefined;
      if (sub && group) { startField(sub, m[2], group.item, false); continue; }
      const f = topByLabel(m[1]);
      if (f && f.type !== 'group') { group = null; startField(f, m[2], values as Record<string, unknown>, true); continue; }
    }
    if (!cur) { if (line.trim()) unknown.push(line.trim()); continue; }
    const c = cur as { f: TplField; set: (v: unknown) => void; get: () => unknown };
    if (c.f.type === 'list') {
      const arr = [...((c.get() as string[]) ?? [])];
      const b = /^\s*[-·!•*]\s+(.*)$/.exec(line);
      if (b) arr.push(b[1]);
      else if (line.trim() && arr.length) arr[arr.length - 1] += `\n${line.trim()}`;
      else if (line.trim()) arr.push(line.trim());
      c.set(arr);
    } else {
      const prev = String(c.get() ?? '');
      c.set(prev ? `${prev}\n${line}` : line);
    }
  }
  // 여러 줄 글 끝의 빈 줄 정리
  // 문서에서 붙여 넣을 때 생기는 빈 줄 여러 개는 한 줄(문단 구분)로
  const tidy = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/\s+$/, '').replace(/^\n+/, '').replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, '\n\n')
    : Array.isArray(v) ? v.map(tidy) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)])) : v);
  for (const k of touched) {
    values[k] = tidy(values[k]) as TplValue;
    // 칸을 하나도 안 채운 묶음은 버린다 (형식 안내용 빈 [묶음]을 그대로 둔 경우)
    if (code.fields.find(f => f.key === k)?.type === 'group') values[k] = (values[k] as Record<string, unknown>[]).filter(filled);
  }
  return { values, unknown };
}
