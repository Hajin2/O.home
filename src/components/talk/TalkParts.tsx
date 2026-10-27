'use client';
// TALK (포크) — 여러 화면이 같이 쓰는 조각: 데이터 묶음 · 프로필 · 말풍선 화면 · 크게 보기 · 댓글 · 대화방 설정
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { Character, CHAR_SEED, Relation, REL_SEED } from '@/lib/charStore';
import { useRawList } from '@/lib/rawList';
import { useBlobUrl, putBlob } from '@/lib/blobStore';
import { makeThumb } from '@/lib/galleryThumb';
import { pushNotif } from '@/lib/notifStore';
import { nameColor } from '@/lib/ifStore';
import {
  TalkPost, TalkComment, TalkMember, TalkMsg, TalkImg, TALK_KEY, TALK_CMT_KEY,
  speakersOf, isGroup, otherOf, fmtDay,
} from '@/lib/talkStore';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { CharPicker, FAINT, LINE } from '@/components/ifs/IfParts';
import { KInput, KTextarea } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';

export { FAINT, LINE };

/** 카톡 느낌 색 — 화면 테마와 상관없이 고정 (말풍선 안 글자도 늘 짙게) */
export const TK = { bg: '#b9c9d8', mine: '#fee77a', theirs: '#ffffff', ink: '#1f2328', time: '#4d5966', name: '#36414d', pill: 'rgba(0,0,0,.16)' };

/** TALK 데이터 한 묶음 */
export function useTalk() {
  const { user, isAdmin } = useAuth();
  const [talks, setTalks, l1] = useLocalList<TalkPost>(TALK_KEY, []);
  const [cmts, setCmts, l2] = useLocalList<TalkComment>(TALK_CMT_KEY, []);
  const [chars, , l3] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels, , l4] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const loaded = l1 && l2 && l3 && l4;
  return useMemo(() => {
    const charOf = (id?: string) => (id ? chars.find(c => c.id === id) : undefined);
    const relOf = (id?: string) => (id ? rels.find(r => r.id === id || r.slug === id) : undefined);
    const talkOf = (id?: string) => (id ? talks.find(t => t.id === id) : undefined);
    const canEdit = (t: TalkPost) => isAdmin || (!!user && (t.authorId === user.id || !!t.editorUids?.includes(user.id)));
    return { user, isAdmin, loaded, talks, setTalks, cmts, setCmts, chars, rels, charOf, relOf, talkOf, canEdit, canWrite: !!user };
  }, [user, isAdmin, loaded, talks, setTalks, cmts, setCmts, chars, rels]);
}
export type TalkCtx = ReturnType<typeof useTalk>;

/** 그림 올리기 — 원본 + 작은 사본(말풍선·목록용) */
export async function uploadTalkImg(file: Blob): Promise<TalkImg> {
  const src = await putBlob(file);
  const th = await makeThumb(file).catch(() => null);
  return { src, ...(th?.t ? { t: th.t } : {}), ...(th ? { w: th.w, h: th.h } : {}) };
}

/** 숨은 파일 고르기 — 버튼에서 open() 으로 연다 */
export function useFilePick(onFiles: (files: File[]) => void, multiple = true) {
  const ref = useRef<HTMLInputElement>(null);
  const el = (
    <input ref={ref} type="file" accept="image/*" multiple={multiple} style={{ display: 'none' }}
      onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) onFiles(fs); }} />
  );
  return { el, open: () => ref.current?.click() };
}

/* ---------- 프로필 ---------- */
export function TalkAvatar({ m, ch, size = 36 }: { m?: TalkMember; ch?: Character; size?: number }) {
  const r = Math.round(size * .38);
  const box: React.CSSProperties = { position: 'relative', flex: 'none', width: size, height: size, borderRadius: r, overflow: 'hidden' };
  const img = useBlobUrl(m?.av === 'img' ? m.avImg : undefined);
  const label = m?.name || ch?.name || '?';
  if (m?.av === 'img' && img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <span style={box}><img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></span>;
  }
  if (m?.av === 'text' && m.avText) {
    return <span style={{ ...box, background: '#eef3f8', display: 'grid', placeItems: 'center', fontSize: size * .5, lineHeight: 1 }}>{m.avText}</span>;
  }
  if (ch?.thumbId) return <span style={box}><CroppedBlobImg fileRef={ch.thumbId} crop={ch.thumbCrop} /></span>;
  return (
    <span style={{ ...box, background: ch?.color || nameColor(label), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * .42 }}>
      {[...label][0]}
    </span>
  );
}

/* ---------- 말풍선 속 그림 ---------- */
export function TalkImgBox({ img, onOpen, onFill, max = 220 }: { img?: TalkImg; onOpen?: () => void; onFill?: () => void; max?: number }) {
  const url = useBlobUrl(img ? img.t || img.src : undefined);
  if (!img) {
    return (
      <div onClick={onFill} style={{
        width: Math.min(max, 170), height: 92, borderRadius: 12, border: '2px dashed #8ea3b7', background: 'rgba(255,255,255,.55)',
        display: 'grid', placeItems: 'center', textAlign: 'center', color: '#4d6074', fontSize: 12, lineHeight: 1.5, cursor: onFill ? 'pointer' : 'default',
      }}>
        <span>사진{onFill && <><br /><b style={{ color: '#4a5bd8' }}>눌러서 그림 넣기</b></>}</span>
      </div>
    );
  }
  const ratio = img.w && img.h ? img.h / img.w : .75;
  const w = Math.min(max, img.w ?? max);
  const h = Math.min(Math.round(w * ratio), 320);
  return (
    <div onClick={onOpen} style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', background: '#dfe6ee', cursor: onOpen ? 'zoom-in' : 'default' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />}
    </div>
  );
}

/* ---------- 말풍선 화면 ---------- */
export interface ChatProps {
  talk: Pick<TalkPost, 'members' | 'msgs' | 'me' | 'mode'>;
  me?: string;                                  // 지금 오른쪽에 설 사람 (보는 사람 바꾸기 반영)
  charOf: (id?: string) => Character | undefined;
  onOpenImg?: (m: TalkMsg) => void;
  onFillImg?: (m: TalkMsg) => void;             // 빈 「사진」 자리 채우기 (고칠 수 있는 사람만)
  selected?: string;
  onSelect?: (m: TalkMsg) => void;              // 쓰기 화면 — 말풍선을 눌러 고르기
  after?: (m: TalkMsg) => React.ReactNode;      // 고른 말풍선 아래 도구
  hits?: Set<string>;                           // 검색에 걸린 말풍선
  focus?: string;
  empty?: React.ReactNode;
}

export function ChatView({ talk, me, charOf, onOpenImg, onFillImg, selected, onSelect, after, hits, focus, empty }: ChatProps) {
  const memberOf = (k?: string) => talk.members.find(x => x.key === k);
  const group = isGroup(talk);
  const msgs = talk.msgs;
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => { focusRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [focus]);
  const said = (m?: TalkMsg) => !!m && (m.kind === 'text' || m.kind === 'img');
  return (
    <div style={{ background: TK.bg, color: TK.ink, padding: '8px 12px 14px', display: 'flex', flexDirection: 'column' }}>
      {msgs.length === 0 && <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: TK.time }}>{empty ?? '아직 대화가 없어요'}</div>}
      {msgs.map((m, i) => {
        const prev = msgs[i - 1];
        const next = msgs[i + 1];
        const sel = selected === m.id;
        const hit = hits?.has(m.id);
        const wrap = (node: React.ReactNode) => (
          <div key={m.id} ref={focus === m.id ? focusRef : undefined}>
            <div onClick={onSelect ? () => onSelect(m) : undefined} style={{
              cursor: onSelect ? 'pointer' : undefined, borderRadius: 10,
              outline: sel ? '2px solid #4a5bd8' : hit ? '2px solid #f0b429' : 'none', outlineOffset: 2,
              background: focus === m.id ? 'rgba(255,255,255,.25)' : undefined,
            }}>{node}</div>
            {sel && after?.(m)}
          </div>
        );
        if (m.kind === 'date') {
          return wrap(<div style={{ textAlign: 'center', margin: '12px 0' }}>
            <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 999, background: TK.pill, color: '#fff', fontSize: 11.5 }}>{m.text}</span>
          </div>);
        }
        if (m.kind === 'info') {
          return wrap(<div style={{ textAlign: 'center', fontSize: 11.5, color: '#43505d', margin: '8px 0', whiteSpace: 'pre-wrap' }}>{m.text}</div>);
        }
        const mine = !!m.who && m.who === me;
        const start = !said(prev) || prev!.who !== m.who;
        const end = !said(next) || next!.who !== m.who || (next!.time ?? '') !== (m.time ?? '');
        const mem = memberOf(m.who);
        const ch = charOf(mem?.charId);
        const bubble = m.kind === 'img'
          ? <TalkImgBox img={m.img} onOpen={m.img && onOpenImg ? () => onOpenImg(m) : undefined} onFill={!m.img && onFillImg ? () => onFillImg(m) : undefined} />
          : <span style={{
            display: 'inline-block', maxWidth: '100%', padding: '7px 11px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            borderRadius: mine ? `14px ${start ? 4 : 14}px 14px 14px` : `${start ? 4 : 14}px 14px 14px 14px`,
            background: mine ? TK.mine : TK.theirs, color: TK.ink,
          }}>{m.text}</span>;
        const time = end && m.time ? <span style={{ flex: 'none', fontSize: 10.5, color: TK.time, whiteSpace: 'nowrap' }}>{m.time}</span> : null;
        if (mine) {
          return wrap(
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 5, marginTop: start ? 8 : 4, paddingLeft: 52 }}>
              {time}<div style={{ minWidth: 0, maxWidth: 'min(440px, 100%)', display: 'flex', justifyContent: 'flex-end' }}>{bubble}</div>
            </div>,
          );
        }
        return wrap(
          <div style={{ display: 'flex', gap: 8, marginTop: start ? 8 : 4, paddingRight: 40 }}>
            <span style={{ width: 38, flex: 'none' }}>{start && <TalkAvatar m={mem} ch={ch} size={38} />}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              {start && <div style={{ fontSize: 12, color: TK.name, marginBottom: 3 }}>{mem?.name ?? m.who}</div>}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
                <div style={{ minWidth: 0, maxWidth: 'min(440px, 100%)' }}>{bubble}</div>{time}
              </div>
            </div>
          </div>,
        );
      })}
    </div>
  );
}

/** 제목줄 이름 — 방 이름 > (개인톡) 상대 이름 > (단톡) 말한 사람들 */
export function roomLabel(t: Pick<TalkPost, 'room' | 'title' | 'members' | 'msgs' | 'me' | 'mode'>): string {
  if (t.room?.trim()) return t.room.trim();
  const sp = speakersOf(t);
  const name = (k: string) => t.members.find(m => m.key === k)?.name ?? k;
  if (!isGroup(t)) { const o = sp.find(k => k !== t.me) ?? sp[0]; return o ? name(o) : t.title; }
  return sp.map(name).join(', ');
}

/** 목록 한 줄의 마지막 대사 */
export function lastLine(t: TalkPost): string {
  for (let i = t.msgs.length - 1; i >= 0; i--) {
    const m = t.msgs[i];
    if (m.kind === 'text' || m.kind === 'img') {
      const who = t.members.find(x => x.key === m.who)?.name ?? m.who ?? '';
      return `${who}: ${m.kind === 'img' ? '사진' : (m.text ?? '').replace(/\s+/g, ' ')}`;
    }
  }
  return t.caps.length ? `캡처 ${t.caps.length}장` : '';
}

export const kindLabel = (t: TalkPost) => {
  const chat = t.msgs.some(m => m.kind === 'text' || m.kind === 'img');
  return chat && t.caps.length ? '글+캡처' : chat ? '글' : t.caps.length ? '캡처' : '';
};
export const lineCount = (t: TalkPost) => t.msgs.filter(m => m.kind === 'text' || m.kind === 'img').length;

/** 말한 사람 얼굴 겹쳐 놓기 */
export function TalkFaces({ ctx, t, size = 30, max = 3 }: { ctx: Pick<TalkCtx, 'charOf'>; t: TalkPost; size?: number; max?: number }) {
  const sp = speakersOf(t);
  const keys = (sp.length ? sp : t.members.map(m => m.key)).slice(0, max);
  return (
    <span style={{ display: 'inline-flex', flex: 'none' }}>
      {keys.map((k, i) => {
        const m = t.members.find(x => x.key === k);
        return (
          <span key={k} style={{ marginLeft: i ? -size * .3 : 0, borderRadius: Math.round(size * .42), boxShadow: '0 0 0 2px var(--panel-solid, #fff)', display: 'inline-flex' }}>
            <TalkAvatar m={m} ch={ctx.charOf(m?.charId)} size={size} />
          </span>
        );
      })}
    </span>
  );
}

/** 대화 첫머리 미리보기 (자관 페이지 카드) — 왼쪽 하나, 오른쪽 하나 */
export function MiniChat({ t }: { t: TalkPost }) {
  const said = t.msgs.filter(m => m.kind === 'text');
  const a = said.find(m => m.who !== t.me);
  const b = said.find(m => m.who === t.me);
  const cut = (s?: string) => (s ?? '').replace(/\s+/g, ' ').slice(0, 24);
  return (
    <div style={{ background: TK.bg, padding: '8px 10px', height: 66, overflow: 'hidden', color: TK.ink, fontSize: 12 }}>
      {a && <div><span style={{ display: 'inline-block', maxWidth: '85%', padding: '4px 9px', borderRadius: '4px 12px 12px 12px', background: TK.theirs, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cut(a.text)}</span></div>}
      {b && <div style={{ textAlign: 'right', marginTop: 4 }}><span style={{ display: 'inline-block', maxWidth: '85%', padding: '4px 9px', borderRadius: '12px 4px 12px 12px', background: TK.mine, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cut(b.text)}</span></div>}
      {!a && !b && <div style={{ textAlign: 'center', color: TK.time, paddingTop: 16 }}>캡처 {t.caps.length}장</div>}
    </div>
  );
}

/* ---------- 크게 보기 ---------- */
export function TalkLightbox({ imgs, at, onMove, onClose }: { imgs: TalkImg[]; at: number; onMove: (i: number) => void; onClose: () => void }) {
  const img = imgs[at];
  const url = useBlobUrl(img?.src);
  const thumb = useBlobUrl(img?.t);
  const prev = () => onMove((at - 1 + imgs.length) % imgs.length);
  const next = () => onMove((at + 1) % imgs.length);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  if (!img || typeof document === 'undefined') return null;
  const nav: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 18, display: 'grid', placeItems: 'center', zIndex: 2 };
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(10,12,15,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { const s = touch.current; touch.current = null; if (s == null) return; const d = e.changedTouches[0].clientX - s; if (Math.abs(d) > 50) { if (d > 0) prev(); else next(); } }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '94vw', maxHeight: '88vh', overflow: 'auto' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {(url || thumb) && <img src={url || thumb} alt="" style={{ display: 'block', maxWidth: '94vw', maxHeight: '88vh', objectFit: 'contain' }} />}
      </div>
      {imgs.length > 1 && <button type="button" aria-label="이전" style={{ ...nav, left: 14 }} onClick={e => { e.stopPropagation(); prev(); }}>‹</button>}
      {imgs.length > 1 && <button type="button" aria-label="다음" style={{ ...nav, right: 14 }} onClick={e => { e.stopPropagation(); next(); }}>›</button>}
      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', color: 'rgba(255,255,255,.8)', fontSize: 12.5, pointerEvents: 'none' }}>{at + 1} / {imgs.length}</div>
      <button type="button" aria-label="닫기" onClick={onClose} style={{ position: 'absolute', top: 10, right: 14, background: 'transparent', color: '#fff', fontSize: 22, padding: 6 }}>✕</button>
    </div>,
    document.body,
  );
}

/* ---------- 댓글 ---------- */
export function TalkComments({ ctx, talk }: { ctx: TalkCtx; talk: TalkPost }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const list = ctx.cmts.filter(c => c.talkId === talk.id).sort((a, b) => a.date.localeCompare(b.date));
  const roots = list.filter(c => !c.parentId);
  const kids = (id: string) => list.filter(c => c.parentId === id);
  const last = list[list.length - 1];
  const add = () => {
    const user = ctx.user;
    if (!user) { toast('댓글은 로그인 후 달 수 있어요'); return; }
    const t = text.trim();
    if (!t) return;
    const c: TalkComment = {
      id: newId(), talkId: talk.id, parentId: replyTo ?? undefined, text: t, author: user.nickname, authorId: user.id,
      date: new Date().toISOString(), visibility: talk.visibility === 'public' ? 'public' : 'member',
    };
    ctx.setCmts([...ctx.cmts, c]);
    const sent = new Set<string>([user.id]);
    const send = (to: string | undefined, title: string) => {
      if (!to || sent.has(to)) return;
      sent.add(to);
      pushNotif({ type: 'comment', toUserId: to, href: `/talk/${talk.id}`, title, body: `${c.author} — ${t.slice(0, 50)}` });
    };
    send(talk.authorId, `TALK 「${talk.title}」에 새 댓글`);
    if (replyTo) send(list.find(x => x.id === replyTo)?.authorId, '내 TALK 댓글에 답글이 달렸습니다');
    setText(''); setReplyTo(null);
  };
  const remove = (c: TalkComment) => {
    ctx.setCmts(ctx.cmts.filter(x => !(x.id === c.id || (x.parentId === c.id && (ctx.isAdmin || x.authorId === ctx.user?.id)))));
  };
  const Row = ({ c, depth }: { c: TalkComment; depth: number }) => (
    <div style={{ padding: '6px 0', paddingLeft: depth ? 18 : 0, fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <b>{depth ? '↳ ' : ''}{c.author}</b>
        <span style={{ fontSize: 11, color: FAINT }}>{fmtDay(c.date)}</span>
        {ctx.user && depth === 0 && <span className="fx" style={{ fontSize: 11, color: FAINT, cursor: 'pointer' }} onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>{replyTo === c.id ? '답글 취소' : '답글'}</span>}
        {(ctx.isAdmin || c.authorId === ctx.user?.id) && <span className="fx" style={{ fontSize: 11, color: FAINT, cursor: 'pointer' }} onClick={() => remove(c)}>삭제</span>}
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
    </div>
  );
  return (
    <div style={{ background: 'color-mix(in srgb, var(--ink, #1d2025) 4%, transparent)', borderRadius: 10, padding: '10px 14px' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, minWidth: 0 }}>
        <b style={{ flex: 'none' }}>댓글 {list.length} {open ? '▴' : '▾'}</b>
        {!open && last && <span style={{ color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{last.author}: {last.text}</span>}
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          {roots.map(c => (
            <React.Fragment key={c.id}>
              <Row c={c} depth={0} />
              {kids(c.id).map(k => <Row key={k.id} c={k} depth={1} />)}
            </React.Fragment>
          ))}
          {ctx.user ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-end' }}>
              <KTextarea rows={1} placeholder={replyTo ? '답글 달기' : '댓글 달기'} value={text}
                onChange={e => setText(e.target.value)} style={{ flex: 1, minHeight: 42, padding: '10px 13px', lineHeight: 1.6 }} />
              <button type="button" className="btn btn-dark" onClick={add} style={{ height: 42, flex: 'none', justifyContent: 'center' }}>ADD</button>
            </div>
          ) : <p className="hint">댓글은 로그인 후 달 수 있어요</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- 대화방 설정 (참여자 · 이름 · 프로필 · 오른쪽) ---------- */
export interface RoomState { room: string; mode: TalkPost['mode']; me: string; members: TalkMember[]; carry: boolean }

export function MemberEditor({ ctx, st, set, msgs, relIds }: {
  ctx: Pick<TalkCtx, 'chars' | 'charOf' | 'relOf'>;
  st: RoomState; set: (p: Partial<RoomState>) => void; msgs: TalkMsg[]; relIds: string[];
}) {
  const toast = useToast();
  const speakers = speakersOf({ msgs });
  const group = isGroup({ msgs, mode: st.mode });
  const [adding, setAdding] = useState(false);
  const [extra, setExtra] = useState('');
  const [picking, setPicking] = useState<string | null>(null);   // 캐릭터 고르는 중인 참여자
  const [upFor, setUpFor] = useState<string | null>(null);
  const pick = useFilePick(async files => {
    const key = upFor;
    if (!key) return;
    try {
      const ref = await putBlob(files[0]);
      setMem(key, { av: 'img', avImg: ref });
    } catch { toast('그림을 올리지 못했어요'); }
  }, false);
  const prefer = useMemo(() => relIds.flatMap(id => ctx.relOf(id)?.members.map(m => m.charId) ?? []), [relIds, ctx]);
  const setMem = (key: string, p: Partial<TalkMember>) => set({ members: st.members.map(m => (m.key === key ? { ...m, ...p } : m)) });
  const remove = (key: string) => set({ members: st.members.filter(m => m.key !== key), me: st.me === key ? '' : st.me });
  const swap = () => {
    const o = otherOf({ msgs, members: st.members, me: st.me });
    if (o) set({ me: o });
  };
  const addChar = (id: string) => {
    const c = ctx.charOf(id);
    if (!c || st.members.some(m => m.charId === id)) return;
    set({ members: [...st.members, { key: `k${newId().slice(-6)}`, charId: id, name: c.name }] });
    setAdding(false);
  };
  const addName = () => {
    const n = extra.trim();
    if (!n) return;
    set({ members: [...st.members, { key: `k${newId().slice(-6)}`, name: n }] });
    setExtra(''); setAdding(false);
  };
  const chip = (on: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 999, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap',
    background: on ? 'var(--ink, #1d2025)' : 'color-mix(in srgb, var(--ink, #1d2025) 7%, transparent)', color: on ? 'var(--panel-solid, #fff)' : 'var(--ink)',
  });
  const twoRows = !group && st.members.length >= 2;
  const firstTwo = st.members.slice(0, 2).map(m => m.key);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pick.el}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', fontSize: 12, fontWeight: 700, color: 'var(--sub)' }}>
          방 이름 <span style={{ fontWeight: 400, color: FAINT }}>— 비우면 개인톡은 상대 이름, 단톡은 참여자 이름</span>
          <KInput value={st.room} onChange={e => set({ room: e.target.value })} placeholder="방 이름 (선택)" />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--sub)' }}>
          <span>방 종류 <span style={{ fontWeight: 400, color: FAINT }}>— 지금 {group ? '단톡' : '개인톡'}</span></span>
          <div className="mini-seg">
            {([['auto', '자동'], ['dm', '개인톡'], ['group', '단톡']] as const).map(([v, l]) => (
              <button key={v} type="button" className={st.mode === v ? 'on' : ''} onClick={() => set({ mode: v })}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: '2px 12px' }}>
        {st.members.length === 0 && <div style={{ padding: '12px 0', fontSize: 12.5, color: FAINT }}>참여자가 없어요 — 자관을 고르거나 아래 ＋ 사람 추가로 넣어 주세요</div>}
        {st.members.map((m, i) => {
          const ch = ctx.charOf(m.charId);
          const silent = !speakers.includes(m.key);
          const isMe = st.me === m.key;
          return (
            <React.Fragment key={m.key}>
              {twoRows && i === 1 && firstTwo.includes(m.key) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                  <span style={{ flex: 1, height: 1, background: LINE }} />
                  <button type="button" onClick={swap} style={{ padding: '5px 14px', borderRadius: 999, border: '1.5px solid #4a5bd8', color: '#4a5bd8', background: 'color-mix(in srgb, #4a5bd8 8%, transparent)', fontSize: 12.5, fontWeight: 800 }}>⇅ 왼쪽 · 오른쪽 바꾸기</button>
                  <span style={{ flex: 1, height: 1, background: LINE }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i && !(twoRows && i === 1) ? `1px solid ${LINE}` : 'none', opacity: silent ? .6 : 1 }}>
                <TalkAvatar m={m} ch={ch} size={48} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: FAINT }}>
                    <span>캐릭터</span>
                    <button type="button" onClick={() => setPicking(picking === m.key ? null : m.key)}
                      style={{ padding: '1px 9px', borderRadius: 999, border: `1px solid ${LINE}`, background: 'transparent', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
                      {ch ? ch.name : '연결 안 함'} ▾
                    </button>
                    {silent && <span>· 대화 없음</span>}
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {group ? (
                        <button type="button" onClick={() => set({ me: isMe ? '' : m.key })}
                          style={{ padding: '3px 11px', borderRadius: 999, fontSize: 12, fontWeight: 800, ...(isMe ? { background: '#4a5bd8', color: '#fff' } : { border: `1.5px solid ${LINE}`, color: 'var(--sub)', background: 'transparent' }) }}>
                          {isMe ? '● 나' : '○ 나로 하기'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: isMe ? 800 : 500, color: isMe ? '#4a5bd8' : FAINT }}>{isMe ? '오른쪽(나)' : '왼쪽'}</span>
                      )}
                      {silent && <button type="button" aria-label="빼기" onClick={() => remove(m.key)} style={{ background: 'transparent', color: FAINT, fontSize: 13, padding: '2px 4px' }}>✕</button>}
                    </span>
                  </div>
                  {picking === m.key && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <CharPicker chars={ctx.chars} prefer={prefer} value={m.charId ?? ''}
                        onChange={id => { const c = ctx.charOf(id); setMem(m.key, { charId: id || undefined, ...(c && (!m.name || m.name === ctx.charOf(m.charId)?.name) ? { name: c.name } : {}) }); setPicking(null); }} />
                    </div>
                  )}
                  <KInput value={m.name} onChange={e => setMem(m.key, { name: e.target.value })} placeholder="카톡에 보이는 이름 — 별명 · 이모지도 돼요" />
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={chip(!m.av || m.av === 'char')} onClick={() => setMem(m.key, { av: 'char' })}>{ch ? '캐릭터 그림' : '글자'}</span>
                    <span style={chip(m.av === 'img')} onClick={() => { setUpFor(m.key); pick.open(); }}>{m.av === 'img' ? '다른 그림 ✓ (바꾸기)' : '다른 그림 올리기'}</span>
                    <span style={chip(m.av === 'text')} onClick={() => setMem(m.key, { av: 'text', avText: m.avText || '🙂' })}>이모지·글자</span>
                    {m.av === 'text' && (
                      <KInput value={m.avText ?? ''} maxLength={4} onChange={e => setMem(m.key, { avText: e.target.value })} style={{ width: 70 }} />
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {group && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${LINE}` }}>
            <span style={{ flex: 1, fontSize: 12.5, color: FAINT }}>아무도 내가 아닌 대화 (구경하는 입장)</span>
            <button type="button" onClick={() => set({ me: '' })}
              style={{ padding: '3px 11px', borderRadius: 999, fontSize: 12, fontWeight: 800, ...(!st.me ? { background: '#4a5bd8', color: '#fff' } : { border: `1.5px solid ${LINE}`, color: 'var(--sub)', background: 'transparent' }) }}>
              {!st.me ? '● 모두 왼쪽' : '○ 모두 왼쪽'}
            </button>
          </div>
        )}
      </div>

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: `1px dashed ${LINE}`, borderRadius: 12 }}>
          <span style={{ fontSize: 12, color: FAINT }}>캐릭터 고르기 (★ 연결한 자관 멤버)</span>
          <CharPicker chars={ctx.chars.filter(c => !st.members.some(m => m.charId === c.id))} prefer={prefer} value="" onChange={id => id && addChar(id)} />
          <div style={{ display: 'flex', gap: 6 }}>
            <KInput value={extra} onChange={e => setExtra(e.target.value)} placeholder="등록 안 된 사람 — 이름만 (예: 엄마)" onKeyDown={e => { if (e.key === 'Enter') addName(); }} />
            <button type="button" className="btn btn-ghost" onClick={addName}>이름으로 추가</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>닫기</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          style={{ padding: 9, borderRadius: 10, border: `1.5px dashed ${LINE}`, background: 'transparent', fontSize: 12.5, color: 'var(--sub)' }}>＋ 사람 추가</button>
      )}
      {relIds.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={st.carry} onChange={e => set({ carry: e.target.checked })} />
          이 자관의 다음 TALK에도 이 이름 · 프로필 쓰기
        </label>
      )}
      <p className="hint" style={{ margin: 0 }}>
        {group ? '「나」는 한 명만 — 누른 사람이 오른쪽으로 가고, 원래 나였던 사람은 왼쪽으로 가요.' : '버튼 하나로 두 사람 자리가 바뀌어요. 바꾼 자리는 글에 저장돼요.'}
        {' '}한 마디도 안 한 사람은 대화 화면에 뜨지 않아요.
      </p>
    </div>
  );
}

/** 새 대화의 참여자 — 자관 멤버로 채우고, 「다음 TALK에도」를 켠 같은 자관 글이 있으면 그 이름·프로필을 가져온다 */
export function membersFromRels(ctx: Pick<TalkCtx, 'relOf' | 'charOf' | 'talks'>, relIds: string[], have: TalkMember[] = []): TalkMember[] {
  const out = [...have];
  const carry = ctx.talks.filter(t => t.carry && t.relIds.some(id => relIds.includes(id))).sort((a, b) => b.date.localeCompare(a.date));
  for (const id of relIds) {
    for (const rm of ctx.relOf(id)?.members ?? []) {
      if (out.some(m => m.charId === rm.charId)) continue;
      const c = ctx.charOf(rm.charId);
      if (!c) continue;
      const prev = carry.flatMap(t => t.members).find(m => m.charId === c.id);
      out.push({ key: `k${newId().slice(-6)}`, charId: c.id, name: prev?.name || c.name, ...(prev?.av ? { av: prev.av, avImg: prev.avImg, avText: prev.avText } : {}) });
    }
  }
  return out;
}

/* ---------- 자관 페이지 칸 ---------- */
export function RelTalkPanel({ rel }: { rel: Relation }) {
  const talks = useRawList<TalkPost>(TALK_KEY, []);
  const rows = useMemo(() => talks.list.filter(t => t.relIds?.includes(rel.id)).sort((a, b) => b.date.localeCompare(a.date)), [talks.list, rel.id]);
  if (!talks.loaded || rows.length === 0) return null;
  return (
    <div className="panel widget" style={{ marginTop: 16, maxWidth: 1010, marginLeft: 'auto', marginRight: 'auto' }}>
      <h4>
        <span>TALK <span style={{ letterSpacing: 0, color: FAINT, marginLeft: 6 }}>이 자관의 카톡 썰 · {rows.length}</span></span>
        <Link className="more" href={`/talk?rel=${rel.id}`}>전체 보기 ›</Link>
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
        {rows.slice(0, 4).map(t => (
          <Link key={t.id} href={`/talk/${t.id}`} style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', color: 'inherit', display: 'block' }}>
            <MiniChat t={t} />
            <div style={{ padding: '7px 10px', fontSize: 12.5, display: 'flex', gap: 8 }}>
              <b style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</b>
              <span style={{ color: FAINT, flex: 'none' }}>{t.date.slice(5, 10).replace('-', '.')}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const toTop = () => (document.getElementById('appMain') ?? window).scrollTo({ top: 0, behavior: 'smooth' });
