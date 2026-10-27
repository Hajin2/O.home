'use client';
// TALK (포크) — 카톡 썰 보관함. 카톡 대화를 말풍선으로 남기고 자관에 묶는다.
//
// 저장은 두 묶음 (STORY와 같은 이유 — 남의 문서를 고치지 않고 댓글을 달 수 있게):
//   talk_posts     대화 한 편 (참여자 · 말풍선 · 캡처 이미지를 한 문서에 — 문서 수로 읽기를 세므로 나누지 않는다)
//   talk_comments  댓글
// 대화 한 편은 Firestore 문서 한 개(최대 1MB)에 들어가야 해서, 너무 긴 대화는 저장 전에 나눠 달라고 한다.
// 새 파일로 따로 둔 이유: 원작 저장소 업데이트(Sync fork)와 충돌하지 않게.

export const TALK_KEY = 'ohome.talk.v1';
export const TALK_CMT_KEY = 'ohome.talkcmts.v1';

export type TalkVis = 'public' | 'member' | 'private';

/** 올린 그림 — src 원본, t 목록·말풍선용 작은 사본(galleryThumb), w·h 원본 크기 */
export interface TalkImg { src: string; t?: string; w?: number; h?: number }

/** 대화 참여자. key는 이 대화 안에서만 쓰는 이름표 (말풍선이 가리킨다) */
export interface TalkMember {
  key: string;
  charId?: string;          // 연결한 캐릭터 (없으면 등록 안 된 사람 — 이름만)
  name: string;             // 카톡에 보이는 이름 (저장명 · 별명 · 이모지)
  av?: 'char' | 'img' | 'text';   // 프로필 — 캐릭터 그림 / 올린 그림 / 이모지·글자 (없으면 캐릭터 그림, 캐릭터도 없으면 글자)
  avImg?: string;
  avText?: string;
}

export type TalkMsgKind = 'text' | 'img' | 'date' | 'info';
export interface TalkMsg {
  id: string;
  kind: TalkMsgKind;
  who?: string;             // 말한 사람 (text · img)
  text?: string;            // text · date · info
  img?: TalkImg;            // img — 비어 있으면 「사진」 자리 (내보내기 파일엔 사진이 글자로만 남는다)
  time?: string;            // 「오전 3:02」 — 비워도 된다
}

export type TalkMode = 'auto' | 'dm' | 'group';

export interface TalkPost {
  id: string;
  title: string;
  room?: string;            // 방 이름 (제목줄) — 비우면 개인톡은 상대 이름, 단톡은 참여자 이름들
  relIds: string[];         // 연결한 자관 (여러 개 가능 — 그 자관 페이지마다 뜬다)
  members: TalkMember[];
  msgs: TalkMsg[];
  caps: TalkImg[];          // 캡처 이미지 (말풍선과 따로 모아 보기)
  me?: string;              // 오른쪽(나)에 설 사람의 key — '' 이면 모두 왼쪽
  mode: TalkMode;
  carry?: boolean;          // 이 자관의 다음 TALK에도 이 이름·프로필을 미리 채운다
  author: string;
  authorId: string;
  editorUids?: string[];    // 서버 규칙이 보는 편집 회원 — 연결한 자관의 편집 회원
  date: string;
  visibility: TalkVis;
}

export interface TalkComment {
  id: string;
  talkId: string;
  parentId?: string;
  text: string;
  author: string;
  authorId: string;
  date: string;
  visibility: TalkVis;
}

/** 대화 한 편의 최대 크기 — Firestore 문서 한도(1MB)보다 넉넉히 작게 */
export const TALK_MAX_BYTES = 900_000;
export const talkBytes = (p: TalkPost) => new Blob([JSON.stringify(p)]).size;

let seq = 0;
export const msgId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ---------- 누가 말했나 · 개인톡/단톡 · 오른쪽 ---------- */
/** 실제로 말한 사람 key (말풍선 순서대로) — 한 마디도 안 한 사람은 어디에도 안 뜬다 */
export function speakersOf(p: Pick<TalkPost, 'msgs'>): string[] {
  const out: string[] = [];
  for (const m of p.msgs) if (m.who && (m.kind === 'text' || m.kind === 'img') && !out.includes(m.who)) out.push(m.who);
  return out;
}
export function isGroup(p: Pick<TalkPost, 'msgs' | 'mode'>): boolean {
  if (p.mode === 'dm') return false;
  if (p.mode === 'group') return true;
  return speakersOf(p).length >= 3;
}
/** 개인톡의 자리 바꾸기 — 말한 두 사람(없으면 참여자 앞 두 명) 중 지금 「나」가 아닌 쪽 */
export function otherOf(p: Pick<TalkPost, 'msgs' | 'members' | 'me'>): string | undefined {
  const sp = speakersOf(p);
  const two = sp.length >= 2 ? sp.slice(0, 2) : p.members.slice(0, 2).map(m => m.key);
  return two.find(k => k !== p.me) ?? two[0];
}

/* ---------- 카톡 「대화 내보내기」 읽기 ---------- */
const WEEK = '일월화수목금토';
export const dayLine = (y: number, mo: number, d: number) => `${y}년 ${mo}월 ${d}일 ${WEEK[new Date(y, mo - 1, d).getDay()]}요일`;
const ampm = (h: number, mi: string) => `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${mi}`;

const RX = {
  pcMsg: /^\[(.+?)\] \[(오전|오후) (\d{1,2}:\d{2})\] ?(.*)$/,
  pcDay: /^-{3,}\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일.*?-{3,}\s*$/,
  day: /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일\s*$/,
  andMsg: /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}:\d{2}),\s?(.*)$/,
  iosMsg: /^(\d{4})\. ?(\d{1,2})\. ?(\d{1,2})\.? (오전|오후) (\d{1,2}:\d{2}),\s?(.*)$/,
  csv: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::\d{2})?,"((?:[^"]|"")*)","((?:[^"]|"")*)"?$/,
  head: /(님과 카카오톡 대화|카카오톡 대화$|^저장한 날짜\s*:|^Date,User,Message$|^Talk_\d)/,
  sys: /님이 (들어왔습니다|나갔습니다|.*초대했습니다|.*내보냈습니다)\.?$|^채팅방 관리자가|^메시지가 삭제되었습니다/,
};
/** 사진 자리 — 「사진」 「사진 3장」 「동영상」 */
const PHOTO = /^(사진|동영상)(?: (\d+)장)?$/;

export interface ParsedTalk { msgs: TalkMsg[]; names: string[]; kakao: boolean; first?: string; last?: string }

/** 글 → 말풍선. 카톡 내보내기(PC · 안드로이드 · 아이폰 · 맥)를 알아보고, 아니면 「이름 : 대사」 줄로 읽는다 */
export function parseTalk(raw: string): ParsedTalk {
  const lines = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const kakao = lines.some(l => RX.pcMsg.test(l) || RX.andMsg.test(l) || RX.iosMsg.test(l) || RX.csv.test(l));
  return kakao ? parseKakao(lines) : parseTyped(lines);
}

function parseKakao(lines: string[]): ParsedTalk {
  const msgs: TalkMsg[] = [];
  const names: string[] = [];
  let curDay = '';
  let first: string | undefined, last: string | undefined;
  let open = null as TalkMsg | null;   // 다음 줄이 이어 붙을 말풍선
  const setDay = (y: number, mo: number, d: number) => {
    const s = dayLine(y, mo, d);
    if (s !== curDay) { curDay = s; msgs.push({ id: msgId(), kind: 'date', text: s }); }
    const iso = `${y}.${String(mo).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
    first = first ?? iso; last = iso;
  };
  const say = (name: string, time: string, text: string) => {
    name = name.trim();
    if (!names.includes(name)) names.push(name);
    const ph = PHOTO.exec(text.trim());
    if (ph) {
      const n = Math.min(30, Number(ph[2] ?? 1));
      for (let i = 0; i < n; i++) msgs.push({ id: msgId(), kind: 'img', who: name, time });
      open = null;
      return;
    }
    open = { id: msgId(), kind: 'text', who: name, text, time };
    msgs.push(open);
  };
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    let m: RegExpExecArray | null;
    if (!line.trim()) { if (open) open.text += '\n'; continue; }
    if (RX.head.test(line.trim()) && !open) continue;
    if ((m = RX.pcDay.exec(line)) || (m = RX.day.exec(line))) { setDay(+m[1], +m[2], +m[3]); open = null; continue; }
    if ((m = RX.pcMsg.exec(line))) { say(m[1], `${m[2]} ${m[3]}`, m[4]); continue; }
    if ((m = RX.andMsg.exec(line)) || (m = RX.iosMsg.exec(line))) {
      setDay(+m[1], +m[2], +m[3]);
      const time = `${m[4]} ${m[5]}`;
      const sp = / : /.exec(m[6]);
      if (sp) say(m[6].slice(0, sp.index), time, m[6].slice(sp.index + 3));
      else { msgs.push({ id: msgId(), kind: 'info', text: m[6] }); open = null; }
      continue;
    }
    if ((m = RX.csv.exec(line))) {
      setDay(+m[1], +m[2], +m[3]);
      say(m[6].replace(/""/g, '"'), ampm(+m[4], m[5]), m[7].replace(/""/g, '"'));
      continue;
    }
    if (RX.sys.test(line.trim())) { msgs.push({ id: msgId(), kind: 'info', text: line.trim() }); open = null; continue; }
    if (open) open.text = `${open.text}\n${line}`;   // 여러 줄 메시지
  }
  return { msgs: tidy(msgs), names, kakao: true, first, last };
}

/** 직접 쓴 대화 — 「이름 : 대사」 / 「이름: 대사」, [사진], — 날짜 —, (안내) */
function parseTyped(lines: string[]): ParsedTalk {
  const msgs: TalkMsg[] = [];
  const names: string[] = [];
  let open = null as TalkMsg | null;
  let lastWho: string | undefined;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { open = null; continue; }
    let m: RegExpExecArray | null;
    if ((m = /^[—–-]{1,3}\s*(.+?)\s*[—–-]{1,3}$/.exec(line))) { msgs.push({ id: msgId(), kind: 'date', text: m[1] }); open = null; continue; }
    if ((m = /^\((.+)\)$/.exec(line)) && !/[:：]/.test(m[1])) { msgs.push({ id: msgId(), kind: 'info', text: m[1] }); open = null; continue; }
    if (/^\[(사진|이미지|그림)\]$/.test(line) && lastWho) { msgs.push({ id: msgId(), kind: 'img', who: lastWho }); open = null; continue; }
    if ((m = /^([^:：\[\]()]{1,20}?)\s*[:：]\s?(.*)$/.exec(line)) && !/^https?$/i.test(m[1])) {
      const name = m[1].trim();
      if (!names.includes(name)) names.push(name);
      lastWho = name;
      if (/^\[?(사진|이미지|그림)\]?$/.test(m[2].trim())) { msgs.push({ id: msgId(), kind: 'img', who: name }); open = null; continue; }
      open = { id: msgId(), kind: 'text', who: name, text: m[2] };
      msgs.push(open);
      continue;
    }
    if (open) open.text = `${open.text}\n${line}`;
    else if (lastWho) { open = { id: msgId(), kind: 'text', who: lastWho, text: line }; msgs.push(open); }
  }
  return { msgs: tidy(msgs), names, kakao: false };
}

const tidy = (msgs: TalkMsg[]) => msgs.map(m => (m.kind === 'text' ? { ...m, text: (m.text ?? '').replace(/\n+$/, '') } : m))
  .filter(m => m.kind !== 'text' || (m.text ?? '').trim() !== '');

/* ---------- 내보내기 (카톡 PC 형식) ---------- */
export function talkToText(p: TalkPost): string {
  const name = (k?: string) => p.members.find(x => x.key === k)?.name ?? k ?? '';
  const out = [`${p.room || p.title} 님과 카카오톡 대화`, `저장한 날짜 : ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, ''];
  for (const m of p.msgs) {
    if (m.kind === 'date') out.push(`--------------- ${m.text} ---------------`);
    else if (m.kind === 'info') out.push(m.text ?? '');
    else out.push(`[${name(m.who)}] [${m.time || '오전 12:00'}] ${m.kind === 'img' ? '사진' : m.text}`);
  }
  return out.join('\n') + '\n';
}

export const fmtDay = (iso: string) => iso.slice(0, 10).replace(/-/g, '.');
