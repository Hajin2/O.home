'use client';
// TALK (포크) — 대화 한 편 보기. 말풍선 / 캡처 탭 · 대화 검색 · 보는 사람 바꾸기 · 대화방 설정 · 댓글
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KInput } from '@/components/ui/Kit';
import { Modal, useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useIsMobile, ActionSheet, RoundBtn, type SheetItem } from '@/components/story/StoryParts';
import { downloadText } from '@/lib/storyStore';
import { TalkMsg, TalkImg, isGroup, otherOf, speakersOf, talkToText, fmtDay, talkBytes, TALK_MAX_BYTES } from '@/lib/talkStore';
import {
  useTalk, ChatView, TalkLightbox, TalkComments, MemberEditor, RoomState, TalkImgBox, roomLabel, uploadTalkImg, useFilePick, FAINT, LINE,
} from '@/components/talk/TalkParts';
import { TalkWrite } from '@/components/talk/TalkWrite';

export default function TalkViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ctx = useTalk();
  const toast = useToast();
  const del = useConfirmDelete();
  const mobile = useIsMobile();
  const talk = ctx.talkOf(id);
  const [tab, setTab] = useState<'chat' | 'caps'>('chat');
  const [flip, setFlip] = useState(false);
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [box, setBox] = useState<{ imgs: TalkImg[]; at: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [sheet, setSheet] = useState(false);
  const [fillFor, setFillFor] = useState<string | null>(null);

  const can = !!talk && ctx.canEdit(talk);
  const group = talk ? isGroup(talk) : false;
  const me = talk ? (flip && !group ? otherOf(talk) : talk.me) : undefined;

  /* 검색 */
  const k = q.trim().toLowerCase();
  const hits = useMemo(() => (talk && k ? talk.msgs.filter(m => m.text?.toLowerCase().includes(k)).map(m => m.id) : []), [talk, k]);
  useEffect(() => { setAt(0); }, [k]);
  const hitSet = useMemo(() => new Set(hits), [hits]);

  /* 그림 */
  const chatImgs = talk ? talk.msgs.filter((m): m is TalkMsg & { img: TalkImg } => m.kind === 'img' && !!m.img) : [];
  const openImg = (m: TalkMsg) => setBox({ imgs: chatImgs.map(x => x.img), at: Math.max(0, chatImgs.findIndex(x => x.id === m.id)) });
  const fill = useFilePick(async files => {
    if (!talk || !fillFor) return;
    try {
      const img = await uploadTalkImg(files[0]);
      ctx.setTalks(ctx.talks.map(t => (t.id === talk.id ? { ...t, msgs: t.msgs.map(m => (m.id === fillFor ? { ...m, img } : m)) } : t)));
      toast('사진을 넣었어요');
    } catch { toast('그림을 올리지 못했어요'); } finally { setFillFor(null); }
  }, false);

  if (!ctx.loaded) return <section className="page" />;
  if (!talk) {
    return (
      <section className="page">
        <p className="hint">대화를 찾을 수 없어요 — 지워졌거나 볼 수 없는 글이에요. <Link href="/talk">목록으로</Link></p>
      </section>
    );
  }

  const openRoom = () => { setRoom({ room: talk.room ?? '', mode: talk.mode ?? 'auto', me: talk.me ?? '', members: talk.members, carry: !!talk.carry }); setRoomOpen(true); };
  const saveRoom = () => {
    if (!room) return;
    const next = { ...talk, room: room.room.trim() || undefined, mode: room.mode, me: room.me, members: room.members, carry: room.carry || undefined };
    if (talkBytes(next) > TALK_MAX_BYTES) { toast('대화가 너무 길어요'); return; }
    ctx.setTalks(ctx.talks.map(t => (t.id === talk.id ? next : t)));
    setRoomOpen(false); setFlip(false);
    toast('대화방 설정을 바꿨어요');
  };
  const remove = () => del.ask(`「${talk.title}」를 삭제하시겠습니까?`, () => {
    ctx.setTalks(ctx.talks.filter(t => t.id !== talk.id));
    ctx.setCmts(ctx.cmts.filter(c => !(c.talkId === talk.id && (ctx.isAdmin || c.authorId === ctx.user?.id))));
    router.push('/talk');
  });
  const exportTxt = () => downloadText(talk.title, talkToText(talk));

  const tool: React.CSSProperties = { padding: '5px 11px', borderRadius: 999, border: `1px solid ${LINE}`, fontSize: 12, color: 'var(--sub)', background: 'transparent', whiteSpace: 'nowrap' };
  const tabBtn = (on: boolean): React.CSSProperties => ({ padding: '4px 12px', borderRadius: 999, fontSize: 12.5, border: 'none', ...(on ? { background: 'var(--ink)', color: 'var(--panel-solid, #fff)', fontWeight: 700 } : { background: 'color-mix(in srgb, var(--ink) 7%, transparent)', color: 'var(--ink)' }) });
  const items: SheetItem[] = [
    { label: '목록으로', href: '/talk' },
    ...(can ? [{ label: '대화방 설정 — 이름 · 프로필 · 자리', onClick: openRoom }, { label: '고치기 — 말풍선 · 캡처', onClick: () => setEditing(true) }] : []),
    { label: 'TXT로 저장 (카톡 형식)', onClick: exportTxt },
    ...(can ? [{ label: '삭제', onClick: remove, danger: true }] : []),
  ];
  const nCaps = talk.caps.length;
  const hasChat = talk.msgs.length > 0;
  const view = !hasChat && nCaps ? 'caps' : tab;

  return (
    <section className="page" style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
      {fill.el}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {/* 머리 */}
        <div style={{ padding: mobile ? '10px 12px' : '12px 16px', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Link href="/talk" aria-label="목록으로" style={{ fontSize: 20, color: 'var(--sub)', flex: 'none', padding: '0 4px' }}>‹</Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                <b style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomLabel({ ...talk, me })}</b>
                {group && <span style={{ fontSize: 13, color: FAINT, flex: 'none' }}>{speakersOf(talk).length}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {talk.title}
                {talk.relIds?.map(r => ctx.relOf(r)).filter(Boolean).map(r => <React.Fragment key={r!.id}> · <Link href={`/rels/${r!.slug ?? r!.id}`} style={{ color: 'var(--sub)' }}>{r!.name}</Link></React.Fragment>)}
              </div>
            </div>
            {mobile
              ? <RoundBtn label="더 보기" size={32} onClick={() => setSheet(true)}>⋯</RoundBtn>
              : (
                <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  {can && <button type="button" style={tool} onClick={openRoom}>대화방 설정</button>}
                  {can && <button type="button" style={tool} onClick={() => setEditing(true)}>고치기</button>}
                  <button type="button" style={tool} onClick={exportTxt}>⇩ TXT</button>
                  {can && <button type="button" style={tool} onClick={remove}>삭제</button>}
                </span>
              )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            {hasChat && <button type="button" style={tabBtn(view === 'chat')} onClick={() => setTab('chat')}>대화</button>}
            {nCaps > 0 && <button type="button" style={tabBtn(view === 'caps')} onClick={() => setTab('caps')}>캡처 {nCaps}</button>}
            {view === 'chat' && hasChat && (findOpen || !mobile ? (
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
                <KInput value={q} onChange={e => setQ(e.target.value)} placeholder="대화 검색" style={{ width: mobile ? 130 : 170, padding: '5px 10px' }}
                  onKeyDown={e => { if (e.key === 'Enter' && hits.length) setAt((at + 1) % hits.length); }} />
                {k && <span style={{ fontSize: 11.5, color: FAINT, whiteSpace: 'nowrap' }}>{hits.length ? `${at + 1}/${hits.length}` : '없음'}</span>}
                {hits.length > 1 && <button type="button" style={{ ...tool, padding: '3px 8px' }} onClick={() => setAt((at + 1) % hits.length)}>↓</button>}
              </span>
            ) : <button type="button" style={{ ...tool, marginLeft: 'auto' }} onClick={() => setFindOpen(true)}>⌕ 검색</button>)}
          </div>
        </div>

        {/* 본문 */}
        {view === 'chat' ? (
          <ChatView talk={talk} me={me} charOf={ctx.charOf} onOpenImg={openImg}
            onFillImg={can ? m => { setFillFor(m.id); fill.open(); } : undefined}
            hits={k ? hitSet : undefined} focus={k ? hits[at] : undefined} />
        ) : (
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 220px), 1fr))', gap: 10, background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
            {talk.caps.map((c, i) => (
              <div key={`${c.src}${i}`} style={{ display: 'flex', justifyContent: 'center' }}>
                <TalkImgBox img={c} max={260} onOpen={() => setBox({ imgs: talk.caps, at: i })} />
              </div>
            ))}
          </div>
        )}

        {/* 아래 줄 */}
        <div style={{ padding: mobile ? '10px 12px' : '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 12, color: FAINT, borderTop: `1px solid ${LINE}` }}>
          <span>{talk.author} · {fmtDay(talk.date)}{talk.visibility === 'private' ? ' · 나만 보기' : talk.visibility === 'public' ? ' · 전체 공개' : ''}</span>
          {view === 'chat' && !group && talk.members.length >= 2 && (
            <button type="button" onClick={() => setFlip(!flip)} style={{ ...tool, marginLeft: 'auto' }}>
              보는 사람: <b style={{ color: 'var(--ink)' }}>{talk.members.find(m => m.key === me)?.name ?? '없음'}</b> ⇄
            </button>
          )}
        </div>
        <div style={{ padding: mobile ? '0 12px 12px' : '0 16px 14px' }}><TalkComments ctx={ctx} talk={talk} /></div>
      </div>

      {box && <TalkLightbox imgs={box.imgs} at={box.at} onMove={i => setBox({ ...box, at: i })} onClose={() => setBox(null)} />}
      <ActionSheet open={sheet} title={talk.title} items={items} onClose={() => setSheet(false)} />
      <TalkWrite ctx={ctx} open={editing} onClose={() => setEditing(false)} edit={talk} />
      <Modal open={roomOpen} onClose={() => setRoomOpen(false)} title="대화방 설정" dirty
        actions={<><button className="btn btn-ghost" onClick={() => setRoomOpen(false)}>CANCEL</button><button className="btn btn-dark" onClick={saveRoom}>SAVE</button></>}>
        <style>{`.talk-room .btn{white-space:nowrap;flex:none}.mng-box:has(.talk-room){width:min(640px,96vw)}@media (max-width:720px){.mng-box:has(.talk-room){width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;padding:18px 14px}}`}</style>
        <div className="talk-room">
          {room && <MemberEditor ctx={ctx} st={room} set={p => setRoom({ ...room, ...p })} msgs={talk.msgs} relIds={talk.relIds ?? []} />}
        </div>
      </Modal>
      {del.element}
    </section>
  );
}
