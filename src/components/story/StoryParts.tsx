'use client';
// STORY (포크) — 여러 화면이 같이 쓰는 조각: 데이터 묶음 · 본문 그리기 · 에피소드 펼친 화면(댓글 포함)
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { Character, CHAR_SEED, Relation, REL_SEED } from '@/lib/charStore';
import { useMembers } from '@/lib/members';
import { useFonts } from '@/lib/fontStore';
import { useVisibleWorlds } from '@/lib/worldStore';
import { pushNotif } from '@/lib/notifStore';
import {
  StoryEp, StoryTopic, StoryCat, StoryComment, StoryStyle, STORY_KEY, STORY_TOPIC_KEY, STORY_CAT_KEY, STORY_CMT_KEY,
  KIND_LABEL, splitBody, epToText, downloadText, fmtDay,
} from '@/lib/storyStore';
import { Face, guessChar, FAINT, LINE } from '@/components/ifs/IfParts';
import { KTextarea } from '@/components/ui/Kit';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export { FAINT, LINE };

/** STORY 데이터 한 묶음 — 화면마다 같은 목록을 쓴다 (목록 캐시 덕에 여러 번 불러도 한 번 읽기) */
export function useStory() {
  const { user, isAdmin } = useAuth();
  const [eps, setEps, l1] = useLocalList<StoryEp>(STORY_KEY, []);
  const [topics, setTopics, l2] = useLocalList<StoryTopic>(STORY_TOPIC_KEY, []);
  const [cats, setCats, l3] = useLocalList<StoryCat>(STORY_CAT_KEY, []);
  const [cmts, setCmts, l4] = useLocalList<StoryComment>(STORY_CMT_KEY, []);
  const [chars, , l5] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels, , l6] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const { visible: worlds } = useVisibleWorlds();
  const members = useMembers();
  const loaded = l1 && l2 && l3 && l4 && l5 && l6;

  return useMemo(() => {
    const charOf = (id?: string) => (id ? chars.find(c => c.id === id) : undefined);
    const relOf = (id?: string) => (id ? rels.find(r => r.id === id || r.slug === id) : undefined);
    const topicOf = (id?: string) => (id ? topics.find(t => t.id === id) : undefined);
    const catOf = (id?: string) => (id ? cats.find(c => c.id === id) : undefined);
    const worldName = (id?: string) => (id ? worlds.find(w => w.id === id)?.name : undefined);
    /** 자관의 세계관 — 멤버 캐릭터 소속 중 가장 많은 것 */
    const relWorld = (rel?: Relation) => {
      if (!rel) return undefined;
      const n = new Map<string, number>();
      rel.members.forEach(m => { const w = charOf(m.charId)?.worldId; if (w) n.set(w, (n.get(w) ?? 0) + 1); });
      return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    const coupleName = (e: StoryEp) => relOf(e.relId)?.name ?? e.couple ?? '';
    const canEditEp = (e: StoryEp) => isAdmin || (!!user && (e.authorId === user.id || !!e.editorUids?.includes(user.id)));
    const sortedCats = [...cats].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return {
      user, isAdmin, loaded, eps, setEps, topics, setTopics, cats: sortedCats, setCats, cmts, setCmts, chars, rels, worlds,
      memberIds: members.map(m => m.id),
      charOf, relOf, topicOf, catOf, worldName, relWorld, coupleName, canEditEp,
      canWrite: !!user,
    };
  }, [user, isAdmin, loaded, eps, setEps, topics, setTopics, cats, setCats, cmts, setCmts, chars, rels, worlds, members]);
}
export type StoryCtx = ReturnType<typeof useStory>;

/* ---------- 작은 조각 ---------- */
export function KindBadge({ kind }: { kind: StoryEp['kind'] }) {
  const main = kind === 'main';
  return (
    <span style={{
      flex: 'none', fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 4, lineHeight: 1.5,
      background: main ? 'var(--ink, #1d2025)' : 'transparent', color: main ? '#fff' : 'var(--sub, #5d636d)',
      border: main ? '1px solid var(--ink, #1d2025)' : `1px solid ${FAINT}`,
    }}>{KIND_LABEL[kind]}</span>
  );
}

export function Faces({ chars, size = 24, max = 4 }: { chars: (Character | undefined)[]; size?: number; max?: number }) {
  const list = chars.filter((c): c is Character => !!c).slice(0, max);
  return (
    <span style={{ display: 'inline-flex', flex: 'none' }}>
      {list.map((c, i) => (
        <span key={c.id} style={{ marginLeft: i ? -size * .28 : 0, borderRadius: '50%', boxShadow: '0 0 0 2px var(--panel-solid, #fff)', display: 'inline-flex' }}>
          <Face ch={c} name={c.name} size={size} />
        </span>
      ))}
    </span>
  );
}

/** 본문 글 모양 → CSS */
export function useBodyStyle(st?: StoryStyle): React.CSSProperties {
  const { familyOf } = useFonts();
  return {
    fontFamily: st?.fontId ? familyOf(st.fontId) : undefined,
    fontSize: st?.size ?? 14,
    lineHeight: st?.lh ?? 1.9,
    letterSpacing: st?.ls ? `${st.ls}em` : undefined,
    textAlign: st?.align ?? 'left',
  };
}

/**
 * 본문 — 문단과 「이름 : 대사」 상자. 등록 미리보기와 조회 화면이 같은 이 부품을 쓴다(모양이 어긋나지 않게).
 * clamp: 약 12줄을 넘으면 접고 「이어 읽기」
 */
export function StoryBody({ body, style, cast, clamp }: {
  body: string; style?: StoryStyle; cast: Character[]; clamp?: boolean;
}) {
  const css = useBodyStyle(style);
  const parts = useMemo(() => splitBody(body), [body]);
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [more, setMore] = useState(false);
  const size = Number(css.fontSize) || 14;
  const lh = Number(css.lineHeight) || 1.9;
  const maxH = Math.round(size * lh * 12);
  useLayoutEffect(() => {
    if (!clamp || !ref.current) return;
    setOver(ref.current.scrollHeight > maxH + size * lh * 2);
  }, [clamp, body, maxH, size, lh, css.fontFamily, css.letterSpacing]);
  const nameColor = (name: string) => {
    if (style?.nameColor === 'ink') return undefined;
    const id = guessChar(name, cast, []);
    return id ? cast.find(c => c.id === id)?.color : undefined;
  };
  const folded = clamp && over && !more;
  return (
    <div>
      <div ref={ref} className="story-body" style={{
        ...css, color: 'var(--ink, #24282e)', wordBreak: 'break-word', position: 'relative',
        maxHeight: folded ? maxH : undefined, overflow: folded ? 'hidden' : undefined,
        display: 'flex', flexDirection: 'column', gap: '.75em',
      }}>
        {parts.length === 0 && <span style={{ color: FAINT }}>…</span>}
        {parts.map((p, i) => p.kind === 'para' ? (
          <div key={i}>{p.lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{l}</React.Fragment>)}</div>
        ) : (
          <div key={i} style={{
            borderLeft: '3px solid var(--ink, #1d2025)', background: 'color-mix(in srgb, var(--ink, #1d2025) 5%, transparent)',
            borderRadius: '0 10px 10px 0', padding: '.6em 1em', display: 'flex', flexDirection: 'column', gap: '.2em',
            fontSize: '.96em', lineHeight: 1.7, textAlign: 'left',
          }}>
            {p.lines.map((l, j) => (
              <div key={j}><b style={{ color: nameColor(l.name) }}>{l.name}</b> : {l.text}</div>
            ))}
          </div>
        ))}
        {folded && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, background: 'linear-gradient(transparent, var(--panel-solid, #fbfbfc))' }} />}
      </div>
      {clamp && over && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setMore(!more)}>
          {more ? '▲ 본문 접기' : '이어 읽기 ▾'}
        </button>
      )}
    </div>
  );
}

/** 에피소드의 등장인물 + 자관 멤버 (대사 이름 색 찾기용) */
export function castChars(ctx: StoryCtx, e: StoryEp): Character[] {
  const ids = new Set([...e.cast.map(c => c.charId), ...(ctx.relOf(e.relId)?.members.map(m => m.charId) ?? [])]);
  return [...ids].map(id => ctx.charOf(id)).filter((c): c is Character => !!c);
}

export function exportEp(ctx: StoryCtx, e: StoryEp) {
  downloadText(e.title, epToText(e, {
    topic: ctx.topicOf(e.topicId)?.name, rel: ctx.relOf(e.relId)?.name,
    cast: e.cast.map(c => ctx.charOf(c.charId)?.name).filter((x): x is string => !!x),
  }));
}
export function exportMany(ctx: StoryCtx, name: string, list: StoryEp[]) {
  downloadText(name, list.map(e => epToText(e, {
    topic: ctx.topicOf(e.topicId)?.name, rel: ctx.relOf(e.relId)?.name,
    cast: e.cast.map(c => ctx.charOf(c.charId)?.name).filter((x): x is string => !!x),
  })).join('\n===\n\n'));
}

/* ---------- 폰 화면용 (포크 — 「폰에서 복잡하다」 정리) ---------- */
/** 폰 폭인가 (720px 이하) — PC 화면은 그대로 두고 폰에서만 버튼을 접는다 */
export function useIsMobile(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export interface SheetItem { label: React.ReactNode; onClick?: () => void; href?: string; danger?: boolean }
/** 아래에서 올라오는 메뉴 — ⋯ 버튼용 */
export function ActionSheet({ open, title, items, onClose }: { open: boolean; title?: React.ReactNode; items: SheetItem[]; onClose: () => void }) {
  if (!open || typeof document === 'undefined') return null;
  const row: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '14px 22px', fontSize: 14.5, borderTop: `1px solid ${LINE}`, background: 'transparent', color: 'var(--ink)' };
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(15,17,20,.45)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--panel-solid, #fbfbfc)', borderRadius: '18px 18px 0 0', padding: '10px 0 calc(14px + env(safe-area-inset-bottom))', boxShadow: '0 -10px 40px rgba(0,0,0,.25)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: LINE, margin: '0 auto 8px' }} />
        {title && <div style={{ padding: '0 22px 8px', fontSize: 12, color: FAINT }}>{title}</div>}
        {items.map((it, i) => it.href
          ? <Link key={i} href={it.href} onClick={onClose} style={{ ...row, color: it.danger ? 'var(--accent)' : 'var(--ink)' }}>{it.label}</Link>
          : <button key={i} type="button" style={{ ...row, color: it.danger ? 'var(--accent)' : 'var(--ink)' }} onClick={() => { onClose(); it.onClick?.(); }}>{it.label}</button>)}
      </div>
    </div>,
    document.body,
  );
}

/** 오른쪽 아래 ＋ (폰) — 맨 위로 버튼·BGM 바 위로 */
export function Fab({ onClick, label = '＋' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="새 에피소드"
      style={{
        position: 'fixed', right: 18, bottom: 'max(140px, calc(var(--bgm-h, 0px) + 64px))', zIndex: 31,
        width: 52, height: 52, borderRadius: '50%', background: 'var(--btn-dark, var(--ink))', color: 'var(--btn-dark-fg, #fff)',
        fontSize: 24, lineHeight: 1, display: 'grid', placeItems: 'center', boxShadow: '0 8px 22px rgba(0,0,0,.32)',
      }}>{label}</button>
  );
}

/** 동그란 아이콘 버튼 (⋯ ⌕) */
export function RoundBtn({ children, onClick, label, size = 34 }: { children: React.ReactNode; onClick: () => void; label: string; size?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{ width: size, height: size, flex: 'none', borderRadius: '50%', background: 'var(--panel-solid, #fff)', border: `1px solid ${LINE}`, color: 'var(--ink)', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 900, lineHeight: 1 }}>
      {children}
    </button>
  );
}

/* ---------- 에피소드 펼친 화면 ---------- */
export function EpView({ ctx, ep, onEdit, onDeleted, from }: {
  ctx: StoryCtx; ep: StoryEp; onEdit: (e: StoryEp) => void; onDeleted?: () => void;
  from: 'topic' | 'rel' | 'other';
}) {
  const del = useConfirmDelete();
  const rel = ctx.relOf(ep.relId);
  const topic = ctx.topicOf(ep.topicId);
  const cast = castChars(ctx, ep);
  const main = ep.cast.filter(c => c.role === 'main').map(c => ctx.charOf(c.charId)?.name).filter(Boolean);
  const sub = ep.cast.filter(c => c.role === 'sub').map(c => ctx.charOf(c.charId)?.name).filter(Boolean);
  const can = ctx.canEditEp(ep);
  const tool: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, border: `1px solid ${LINE}`, fontSize: 11.5, color: 'var(--sub, #5d636d)', cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap' };
  const remove = () => del.ask(`「${ep.title}」를 삭제하시겠습니까?`, () => {
    ctx.setEps(ctx.eps.filter(x => x.id !== ep.id));
    ctx.setCmts(ctx.cmts.filter(c => !(c.epId === ep.id && (ctx.isAdmin || c.authorId === ctx.user?.id))));
    onDeleted?.();
  });
  const mobile = useIsMobile();
  const [sheet, setSheet] = useState(false);
  const [showCast, setShowCast] = useState(false);
  const [cmtOpen, setCmtOpen] = useState(false);
  const nCmt = ctx.cmts.filter(c => c.epId === ep.id).length;
  if (mobile) {
    // 폰 — 본문 아래엔 「글쓴이 · 날짜 · 💬 · ⋯」 한 줄만. 버튼·등장인물은 ⋯ 메뉴로, 댓글은 💬을 눌러야 펼침
    const castAll = [...main, ...sub];
    const items: SheetItem[] = [
      ...(from !== 'rel' && rel ? [{ label: `${rel.name} 타임라인에서 보기`, href: `/story/rel/${rel.id}?ep=${ep.id}` }] : []),
      ...(from !== 'topic' && topic ? [{ label: `주제 「${topic.name}」에서 보기`, href: `/story/topic/${topic.id}?ep=${ep.id}` }] : []),
      ...(castAll.length ? [{ label: showCast ? '등장인물 숨기기' : `등장인물 보기 · ${castAll[0]}${castAll.length > 1 ? ` 외 ${castAll.length - 1}` : ''}`, onClick: () => setShowCast(!showCast) }] : []),
      { label: 'TXT로 저장', onClick: () => exportEp(ctx, ep) },
      ...(can ? [{ label: '수정', onClick: () => onEdit(ep) }, { label: '삭제', onClick: remove, danger: true }] : []),
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {showCast && castAll.length > 0 && (
          <div style={{ fontSize: 11.5, color: FAINT }}>
            등장 — <b style={{ color: 'var(--ink)' }}>{main.join(' · ')}</b>{sub.length > 0 && <> · {sub.join(' · ')} (조연)</>}
          </div>
        )}
        <StoryBody body={ep.body} style={ep.style} cast={cast} clamp />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: FAINT }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.author} · {ep.date.slice(5, 10).replace('-', '.')}</span>
          <button type="button" onClick={() => setCmtOpen(!cmtOpen)}
            style={{ marginLeft: 'auto', background: 'transparent', color: cmtOpen ? 'var(--ink)' : 'var(--sub)', fontWeight: cmtOpen ? 700 : 500, fontSize: 12.5, padding: '4px 2px' }}>
            💬 {nCmt}{cmtOpen ? ' ▴' : ''}
          </button>
          <RoundBtn label="더 보기" size={30} onClick={() => setSheet(true)}>⋯</RoundBtn>
        </div>
        {cmtOpen && <StoryComments ctx={ctx} ep={ep} bare />}
        <ActionSheet open={sheet} title={ep.title} items={items} onClose={() => setSheet(false)} />
        {del.element}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(main.length > 0 || sub.length > 0) && (
        <div style={{ fontSize: 11.5, color: FAINT }}>
          등장 — <b style={{ color: 'var(--ink)' }}>{main.join(' · ')}</b>{sub.length > 0 && <> · {sub.join(' · ')} (조연)</>}
        </div>
      )}
      <StoryBody body={ep.body} style={ep.style} cast={cast} clamp />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11.5, color: FAINT, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
        {ep.keywords?.length ? <span>{ep.keywords.map(k => `#${k}`).join(' ')}</span> : null}
        <span>{ep.author} · {fmtDay(ep.date)}{ep.visibility === 'private' ? ' · 나만 보기' : ep.visibility === 'public' ? ' · 전체 공개' : ''}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {from !== 'rel' && rel && <Link href={`/story/rel/${rel.id}?ep=${ep.id}`} style={tool}>이 커플링 타임라인에서 보기</Link>}
          {from !== 'topic' && topic && <Link href={`/story/topic/${topic.id}?ep=${ep.id}`} style={tool}>주제 「{topic.name}」</Link>}
          <button type="button" style={tool} onClick={() => exportEp(ctx, ep)}>⇩ TXT</button>
          {can && <button type="button" style={tool} onClick={() => onEdit(ep)}>수정</button>}
          {can && <button type="button" style={tool} onClick={remove}>삭제</button>}
        </span>
      </div>
      <StoryComments ctx={ctx} ep={ep} />
      {del.element}
    </div>
  );
}

/* ---------- 댓글 — 접혀서 한 줄, 누르면 펼침 ---------- */
function StoryComments({ ctx, ep, bare }: { ctx: StoryCtx; ep: StoryEp; bare?: boolean }) {
  const toast = useToast();
  const [openState, setOpen] = useState(false);
  const open = bare || openState;   // bare: 폰 — 💬을 눌러 이미 펼친 상태, 머리 줄 없이
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const list = ctx.cmts.filter(c => c.epId === ep.id).sort((a, b) => a.date.localeCompare(b.date));
  const roots = list.filter(c => !c.parentId);
  const kids = (id: string) => list.filter(c => c.parentId === id);
  const last = list[list.length - 1];
  const href = `/story/topic/${ep.topicId}?ep=${ep.id}`;

  const add = () => {
    const user = ctx.user;
    if (!user) { toast('댓글은 로그인 후 달 수 있어요'); return; }
    const t = text.trim();
    if (!t) return;
    const c: StoryComment = {
      id: newId(), epId: ep.id, parentId: replyTo ?? undefined, text: t, author: user.nickname, authorId: user.id,
      date: new Date().toISOString(), visibility: ep.visibility === 'public' ? 'public' : 'member',
    };
    ctx.setCmts([...ctx.cmts, c]);
    // 알림 — 글쓴이에게, 답글이면 그 댓글 주인에게도 (본인 제외)
    const sent = new Set<string>([user.id]);
    const send = (to: string | undefined, title: string) => {
      if (!to || sent.has(to)) return;
      sent.add(to);
      pushNotif({ type: 'comment', toUserId: to, href, title, body: `${c.author} — ${t.slice(0, 50)}` });
    };
    send(ep.authorId, `STORY 「${ep.title}」에 새 댓글`);
    if (replyTo) send(list.find(x => x.id === replyTo)?.authorId, '내 STORY 댓글에 답글이 달렸습니다');
    setText(''); setReplyTo(null);
  };
  const remove = (c: StoryComment) => {
    ctx.setCmts(ctx.cmts.filter(x => !(x.id === c.id || (x.parentId === c.id && (ctx.isAdmin || x.authorId === ctx.user?.id)))));
  };
  const Row = ({ c, depth }: { c: StoryComment; depth: number }) => (
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
    <div style={bare ? { borderTop: `1px solid ${LINE}`, paddingTop: 4 } : { background: 'color-mix(in srgb, var(--ink, #1d2025) 4%, transparent)', borderRadius: 10, padding: '10px 14px' }}>
      {!bare && <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, minWidth: 0 }}>
        <b style={{ flex: 'none' }}>댓글 {list.length} {open ? '▴' : '▾'}</b>
        {!open && last && <span style={{ color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{last.author}: {last.text}</span>}
      </div>}
      {bare && list.length === 0 && <p className="hint" style={{ margin: '6px 0' }}>아직 댓글이 없어요</p>}
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

/** 본문 첫머리 한 줄 (목록용) — 대사 이름표는 떼고 */
export function excerpt(body: string, n = 80): string {
  const flat = splitBody(body).flatMap(p => (p.kind === 'para' ? p.lines : p.lines.map(l => l.text))).join(' ');
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

export const toTop = () => (document.getElementById('appMain') ?? window).scrollTo({ top: 0, behavior: 'smooth' });
