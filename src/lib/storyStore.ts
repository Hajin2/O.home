'use client';
// STORY (포크) — 진지한 썰 백업. 주제로도, 커플링(자관)으로도 찾는다.
//
// 저장은 네 묶음으로 나눈다 (IF·댓글과 같은 이유 — 남의 문서를 고치지 않고도 글을 달 수 있게):
//   story_eps      에피소드 (본문 포함 — Firestore는 문서 개수로 읽기를 세므로 본문을 따로 떼면 오히려 읽기가 는다)
//   story_topics   주제 (이름·설명·카테고리·IF 연결)
//   story_cats     카테고리 (회원이 추가·수정)
//   story_comments 댓글
// 주제·카테고리는 회원 누구나 고칠 수 있게 editorUids에 회원 전원을 적는다.
// 에피소드는 쓴 사람 + 그 자관을 고칠 수 있는 회원(같이 자관을 굴리는 사람)이 고칠 수 있다.
// 새 파일로 따로 둔 이유: 원작 저장소 업데이트(Sync fork)와 충돌하지 않게.

export const STORY_KEY = 'ohome.story.v1';
export const STORY_TOPIC_KEY = 'ohome.storytopics.v1';
export const STORY_CAT_KEY = 'ohome.storycats.v1';
export const STORY_CMT_KEY = 'ohome.storycmts.v1';

export type StoryVis = 'public' | 'member' | 'private';
export type StoryKind = 'main' | 'if' | 'au';
export const KIND_LABEL: Record<StoryKind, string> = { main: '본편', if: 'IF', au: 'AU' };

export interface StoryStyle {
  fontId?: string;
  size?: number;            // 본문 글자 크기(px) — 기본 14
  lh?: number;              // 줄 간격 — 기본 1.9
  ls?: number;              // 자간(em) — 기본 0
  align?: 'left' | 'center' | 'justify';
  nameColor?: 'char' | 'ink';   // 대사 이름 색 — 캐릭터 색 / 글자색
}

export interface StoryCast { charId: string; role: 'main' | 'sub' }

export interface StoryEp {
  id: string;
  topicId: string;
  title: string;
  relId?: string;           // 커플링 = 등록된 자관
  couple?: string;          // 자관이 없는 조합 — 직접 입력한 이름
  worldId?: string;         // 세계관 게시판의 세계관
  cast: StoryCast[];
  era?: string;             // 작중 시점 (글자는 자유)
  kind: StoryKind;
  order: number;            // 자관 타임라인 안의 자리 (작중 순서) — 등록일과 무관
  keywords?: string[];
  body: string;
  style?: StoryStyle;
  author: string;
  authorId: string;
  editorUids?: string[];    // 서버 규칙이 보는 편집 회원 — 자관 편집 회원
  date: string;
  visibility: StoryVis;
}

export interface StoryTopic {
  id: string;
  name: string;
  desc?: string;
  catId?: string;
  ifQ?: string;             // 연결한 IF 질문 (질문 글 — IF 카드는 질문 글로 묶인다)
  authorId: string;
  editorUids?: string[];
  date: string;
  visibility: StoryVis;
}

export interface StoryCat {
  id: string;
  name: string;
  order: number;
  authorId: string;
  editorUids?: string[];
  date: string;
  visibility: StoryVis;
}

export interface StoryComment {
  id: string;
  epId: string;
  parentId?: string;
  text: string;
  author: string;
  authorId: string;
  date: string;
  visibility: StoryVis;
}

export const DEFAULT_CATS = ['기념일', '연애', '일상', 'IF / AU', '시리어스'];

/** 이름 비교용 — 띄어쓰기·기호를 빼고 본다 (화이트 데이 = 화이트데이) */
export const normKey = (s: string) => s.replace(/[《》「」『』"'“”‘’\s?!？！.,。…~·×xX\-_/]/g, '').toLowerCase();

/* ---------- 본문 → 조각 ---------- */
export type BodyPart =
  | { kind: 'para'; lines: string[] }
  | { kind: 'talk'; lines: { name: string; text: string }[] };

/** 「이름 : 대사」 한 줄인가 — 이름은 15자 이내, 문장부호 없이 */
const TALK = /^([^:：.,!?。…"“”()\[\]]{1,15}?)\s*[:：]\s*(.+)$/;
export function talkLine(line: string): { name: string; text: string } | null {
  const m = TALK.exec(line.trim());
  if (!m || /^https?$/i.test(m[1])) return null;
  return { name: m[1].trim(), text: m[2].trim() };
}

/** 본문을 문단 / 대사 묶음으로. 빈 줄은 문단 끝, 이어진 대사 줄은 한 상자 */
export function splitBody(body: string): BodyPart[] {
  const out: BodyPart[] = [];
  let cur: BodyPart | null = null;
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { cur = null; continue; }
    const t = talkLine(line);
    if (t) {
      if (cur?.kind !== 'talk') { cur = { kind: 'talk', lines: [] }; out.push(cur); }
      cur.lines.push(t);
    } else {
      if (cur?.kind !== 'para') { cur = { kind: 'para', lines: [] }; out.push(cur); }
      cur.lines.push(line);
    }
  }
  return out;
}

/* ---------- 머리줄 [키]: 값 ---------- */
export interface StoryHead {
  topic?: string; title?: string; couple?: string; era?: string; kind?: StoryKind;
  cast?: string[]; keywords?: string[]; cat?: string;
}
const HEAD_KEYS: Record<string, keyof StoryHead> = {
  주제: 'topic', 제목: 'title', 커플링: 'couple', 자관: 'couple', 시점: 'era', 작중시점: 'era',
  구분: 'kind', 등장: 'cast', 등장인물: 'cast', 조연: 'cast', 키워드: 'keywords', 태그: 'keywords', 카테고리: 'cat',
};
export function kindOf(s?: string): StoryKind | undefined {
  const v = (s ?? '').trim().toLowerCase();
  if (!v) return undefined;
  if (v.startsWith('if')) return 'if';
  if (v.startsWith('au')) return 'au';
  return 'main';
}
export const splitList = (s: string) => s.split(/[,，、/]|\s#|^#/).map(x => x.replace(/^#/, '').trim()).filter(Boolean);

/** 글 하나 — 맨 앞의 [키]: 값 줄은 칸으로, 나머지는 본문 */
export function parseStoryBlock(text: string): { head: StoryHead; body: string } {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const head: StoryHead = {};
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  for (; i < lines.length; i++) {
    const m = /^\s*\[\s*([^\]]+?)\s*\]\s*[:：]?\s*(.*)$/.exec(lines[i]);
    if (!m) break;
    const k = HEAD_KEYS[m[1].replace(/\s/g, '')];
    if (!k) break;
    const v = m[2].trim();
    if (k === 'cast') head.cast = [...(head.cast ?? []), ...splitList(v)];
    else if (k === 'keywords') head.keywords = splitList(v);
    else if (k === 'kind') head.kind = kindOf(v);
    else head[k] = v;
  }
  return { head, body: lines.slice(i).join('\n').replace(/^\n+|\s+$/g, '') };
}

/** 여러 편 — 「===」 줄로 나눈다 */
export function splitStoryBlocks(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split(/\n\s*={3,}\s*\n/).map(s => s.trim()).filter(Boolean);
}

/* ---------- 순서 ---------- */
/** 자관 타임라인 안에서 같은 구분(본편 / IF·AU)끼리 순서대로 */
export const sameLane = (a: StoryKind, b: StoryKind) => (a === 'main') === (b === 'main');
export function laneOf(eps: StoryEp[], relId: string | undefined, kind: StoryKind, exceptId?: string): StoryEp[] {
  if (!relId) return [];
  return eps.filter(e => e.relId === relId && sameLane(e.kind, kind) && e.id !== exceptId)
    .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date));
}
/** lane의 index 자리(그 앞)에 들어갈 순서 값 */
export function orderAt(lane: StoryEp[], index: number): number {
  const prev = lane[index - 1]?.order;
  const next = lane[index]?.order;
  if (prev === undefined && next === undefined) return 1000;
  if (prev === undefined) return next! - 1000;
  if (next === undefined) return prev + 1000;
  return (prev + next) / 2;
}

/* ---------- TXT 내보내기 ---------- */
export function epToText(e: StoryEp, o: { topic?: string; rel?: string; cast?: string[] }): string {
  const head = [
    o.topic && `[주제]: ${o.topic}`,
    `[제목]: ${e.title}`,
    (o.rel || e.couple) && `[커플링]: ${o.rel || e.couple}`,
    e.era && `[시점]: ${e.era}`,
    `[구분]: ${KIND_LABEL[e.kind]}`,
    o.cast?.length && `[등장]: ${o.cast.join(', ')}`,
    e.keywords?.length && `[키워드]: ${e.keywords.map(k => `#${k}`).join(' ')}`,
  ].filter(Boolean).join('\n');
  return `${head}\n\n${e.body.trim()}\n`;
}
export function downloadText(name: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'story'}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- 임시저장 (이 브라우저에만) ---------- */
export interface StoryDraft { key: string; at: string; title: string; data: Record<string, unknown> }
const DRAFT_KEY = 'ohome.storydraft.v1';
export function readDraft(key: string): StoryDraft | null {
  try {
    const all = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, StoryDraft>;
    return all[key] ?? null;
  } catch { return null; }
}
export function writeDraft(d: StoryDraft | null, key: string) {
  try {
    const all = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, StoryDraft>;
    if (d) all[key] = d; else delete all[key];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch { /* 저장 공간이 없거나 막혀 있으면 조용히 */ }
}

export const fmtDay = (iso: string) => iso.slice(0, 10).replace(/-/g, '.');
