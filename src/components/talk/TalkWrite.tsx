'use client';
// TALK (포크) — 올리기 · 고치기. 탭 넷: 파일 불러오기 / 붙여넣기 / 직접 쓰기 / 캡처 이미지
// 파일·붙여넣기는 읽어서 「직접 쓰기」 화면으로 넘긴다 — 거기서 말풍선을 고치고 사진을 채운다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '@/lib/postStore';
import { relEditorUids } from '@/lib/charAccess';
import {
  TalkPost, TalkMsg, TalkImg, TalkMember, TalkVis, parseTalk, msgId, dayLine, speakersOf, talkBytes, TALK_MAX_BYTES,
} from '@/lib/talkStore';
import { Modal } from '@/components/ui/Modal';
import { KInput, KTextarea, KSelect } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { guessChar } from '@/components/ifs/IfParts';
import { useIsMobile } from '@/components/story/StoryParts';
import {
  ChatView, MemberEditor, RoomState, TalkAvatar, TalkImgBox, membersFromRels, uploadTalkImg, useFilePick, FAINT, LINE, type TalkCtx,
} from './TalkParts';

type Tab = 'file' | 'paste' | 'direct' | 'caps';
interface Form extends RoomState { title: string; relIds: string[]; vis: TalkVis; msgs: TalkMsg[]; caps: TalkImg[] }

/** 저장명이 캐릭터 이름을 품고 있으면 (「산타 대장」 → 산타) — 자관 멤버 먼저, 하나로 정해질 때만 */
function guessByPart(name: string, chars: TalkCtx['chars'], prefer: string[]): string {
  const n = name.replace(/\s/g, '');
  for (const pool of [chars.filter(c => prefer.includes(c.id)), chars]) {
    const hit = pool.filter(c => c.name.trim().length >= 2 && n.includes(c.name.replace(/\s/g, '')));
    if (hit.length === 1) return hit[0].id;
  }
  return '';
}

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--sub, #5d636d)' };
const FIELD: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };

export function TalkWrite({ ctx, open, onClose, edit, initRel, onSaved }: {
  ctx: TalkCtx; open: boolean; onClose: () => void; edit?: TalkPost | null; initRel?: string; onSaved?: (t: TalkPost) => void;
}) {
  const toast = useToast();
  const mobile = useIsMobile();
  const blank = (): Form => {
    const relIds = initRel ? [initRel] : [];
    const members = membersFromRels(ctx, relIds);
    return { title: '', relIds, vis: 'member', room: '', mode: 'auto', me: members[1]?.key ?? '', members, carry: false, msgs: [], caps: [] };
  };
  const [f, setF] = useState<Form>(blank);
  const [tab, setTab] = useState<Tab>('file');
  const [roomOpen, setRoomOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [pending, setPending] = useState<{ msgs: TalkMsg[]; members: TalkMember[]; me: string } | null>(null);
  const [busy, setBusy] = useState(0);
  // 직접 쓰기
  const [sel, setSel] = useState<string | null>(null);
  const [who, setWho] = useState('');
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [lineKind, setLineKind] = useState<'date' | 'info' | null>(null);
  const [lineText, setLineText] = useState('');
  const [editText, setEditText] = useState<string | null>(null);
  const [fillFor, setFillFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setF({
        title: edit.title, relIds: edit.relIds ?? [], vis: edit.visibility, room: edit.room ?? '', mode: edit.mode ?? 'auto',
        me: edit.me ?? '', members: edit.members, carry: !!edit.carry, msgs: edit.msgs, caps: edit.caps ?? [],
      });
      setTab('direct');
    } else { setF(blank()); setTab('file'); }
    setRoomOpen(false); setPaste(''); setPending(null); setSel(null); setText(''); setTime(''); setLineKind(null); setEditText(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit?.id]);

  const set = (p: Partial<Form>) => setF(prev => ({ ...prev, ...p }));
  const memberOf = (k?: string) => f.members.find(m => m.key === k);
  const speaker = memberOf(who) ? who : (f.members.find(m => m.key !== f.me)?.key ?? f.members[0]?.key ?? '');
  const prefer = useMemo(() => f.relIds.flatMap(id => ctx.relOf(id)?.members.map(m => m.charId) ?? []), [f.relIds, ctx]);

  /* ---------- 자관 ---------- */
  const toggleRel = (id: string) => {
    if (f.relIds.includes(id)) { set({ relIds: f.relIds.filter(x => x !== id) }); return; }
    const relIds = [...f.relIds, id];
    const members = membersFromRels(ctx, relIds, f.members);
    // 처음 고른 자관이면 두 번째 사람을 오른쪽(나)으로 — 대화방 설정에서 바로 바꿀 수 있다
    set({ relIds, members, ...(!f.me && !f.msgs.length && members[1] ? { me: members[1].key } : {}) });
  };

  /* ---------- 파일 · 붙여넣기 ---------- */
  const readText = (raw: string) => {
    const r = parseTalk(raw);
    if (!r.msgs.some(m => m.kind === 'text' || m.kind === 'img')) { toast('대화를 찾지 못했어요 — 카톡 내보내기 파일이나 「이름 : 대사」 줄인지 확인해 주세요'); return; }
    const members = [...f.members];
    const keyOf = new Map<string, string>();
    for (const name of r.names) {
      let m = members.find(x => x.name === name || ctx.charOf(x.charId)?.name === name);
      if (!m) {
        const cid = guessChar(name, ctx.chars, prefer) || guessByPart(name, ctx.chars, prefer);
        m = cid ? members.find(x => x.charId === cid) : undefined;
        if (m) m.name = name;   // 카톡 저장명을 보이는 이름으로
        else { m = { key: `k${newId().slice(-6)}`, ...(cid ? { charId: cid } : {}), name }; members.push(m); }
      }
      keyOf.set(name, m.key);
    }
    const msgs = r.msgs.map(m => (m.who ? { ...m, who: keyOf.get(m.who) ?? m.who } : m));
    const sp = speakersOf({ msgs });
    const me = f.me && sp.includes(f.me) ? f.me : (sp[1] ?? '');
    const next = { msgs, members, me };
    if (f.msgs.length) setPending(next);
    else applyImport(next, 'replace');
  };
  const applyImport = (p: { msgs: TalkMsg[]; members: TalkMember[]; me: string }, how: 'replace' | 'append') => {
    set({ msgs: how === 'replace' ? p.msgs : [...f.msgs, ...p.msgs], members: p.members, me: f.me && how === 'append' ? f.me : p.me });
    setPending(null);
    setTab('direct');
    setRoomOpen(true);
    toast(`${p.msgs.filter(m => m.kind === 'text' || m.kind === 'img').length}줄을 읽었어요 — 이름이 캐릭터에 맞게 연결됐는지 확인해 주세요`);
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    try { readText(await file.text()); } catch { toast('파일을 읽지 못했어요'); }
  };

  /* ---------- 직접 쓰기 ---------- */
  // 고른 말풍선이 있으면 그 다음에, 없으면 맨 끝에 (그림 올리기를 기다리는 동안 바뀐 내용도 살리도록 prev 기준)
  const insertAt = (items: TalkMsg[]) => {
    const after = sel;
    setF(prev => {
      const i = after ? prev.msgs.findIndex(m => m.id === after) : -1;
      return { ...prev, msgs: i < 0 ? [...prev.msgs, ...items] : [...prev.msgs.slice(0, i + 1), ...items, ...prev.msgs.slice(i + 1)] };
    });
    if (after) setSel(items[items.length - 1].id);
  };
  const send = () => {
    const t = text.replace(/\s+$/, '');
    if (!t.trim()) return;
    if (!speaker) { toast('먼저 말할 사람을 넣어 주세요 — 대화방 설정에서 사람 추가'); return; }
    insertAt([{ id: msgId(), kind: 'text', who: speaker, text: t, ...(time.trim() ? { time: time.trim() } : {}) }]);
    setText('');
  };
  const addLine = () => {
    const t = lineText.trim();
    if (!t || !lineKind) return;
    insertAt([{ id: msgId(), kind: lineKind, text: t }]);
    setLineKind(null); setLineText('');
  };
  const photos = useFilePick(async files => {
    setBusy(b => b + files.length);
    try {
      const imgs: TalkImg[] = [];
      for (const fl of files) { imgs.push(await uploadTalkImg(fl)); setBusy(b => b - 1); }
      if (fillFor) {
        const target = fillFor;
        const [first, ...rest] = imgs;
        setF(prev => {
          const i = prev.msgs.findIndex(m => m.id === target);
          if (i < 0) return prev;
          const base = prev.msgs[i];
          const msgs = prev.msgs.map(m => (m.id === target ? { ...m, img: first } : m));
          const extra = rest.map(img => ({ id: msgId(), kind: 'img' as const, who: base.who, img, ...(base.time ? { time: base.time } : {}) }));
          return { ...prev, msgs: [...msgs.slice(0, i + 1), ...extra, ...msgs.slice(i + 1)] };
        });
        setFillFor(null);
      } else {
        if (!speaker) { toast('먼저 말할 사람을 넣어 주세요'); return; }
        insertAt(imgs.map(img => ({ id: msgId(), kind: 'img' as const, who: speaker, img, ...(time.trim() ? { time: time.trim() } : {}) })));
      }
    } catch { toast('그림을 올리지 못했어요'); } finally { setBusy(0); }
  });
  const caps = useFilePick(files => { uploadCaps(files); });

  const patchMsg = (id: string, p: Partial<TalkMsg>) => set({ msgs: f.msgs.map(m => (m.id === id ? { ...m, ...p } : m)) });
  const move = (id: string, d: -1 | 1) => {
    const i = f.msgs.findIndex(m => m.id === id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= f.msgs.length) return;
    const msgs = [...f.msgs];
    [msgs[i], msgs[j]] = [msgs[j], msgs[i]];
    set({ msgs });
  };
  const removeMsg = (id: string) => { set({ msgs: f.msgs.filter(m => m.id !== id) }); setSel(null); };

  const toolBtn: React.CSSProperties = { padding: '4px 10px', borderRadius: 999, border: `1px solid ${LINE}`, background: 'var(--panel-solid, #fff)', color: 'var(--ink)', fontSize: 12, whiteSpace: 'nowrap' };
  const toolbar = (m: TalkMsg) => (
    <div onClick={e => e.stopPropagation()} style={{ margin: '6px 0 10px', padding: 8, borderRadius: 10, background: 'var(--panel-solid, #fff)', boxShadow: '0 4px 14px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--ink)' }}>
      {editText !== null ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <KTextarea rows={2} value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1 }} autoFocus />
          <button type="button" className="btn btn-dark" onClick={() => { patchMsg(m.id, { text: editText }); setEditText(null); }}>고치기</button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditText(null)}>취소</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {m.kind !== 'img' && <button type="button" style={toolBtn} onClick={() => setEditText(m.text ?? '')}>고치기</button>}
          {m.kind === 'img' && <button type="button" style={toolBtn} onClick={() => { setFillFor(m.id); photos.open(); }}>{m.img ? '그림 바꾸기' : '그림 넣기'}</button>}
          <button type="button" style={toolBtn} onClick={() => move(m.id, -1)}>↑ 위로</button>
          <button type="button" style={toolBtn} onClick={() => move(m.id, 1)}>↓ 아래로</button>
          <button type="button" style={{ ...toolBtn, color: 'var(--accent)' }} onClick={() => removeMsg(m.id)}>지우기</button>
          <button type="button" style={{ ...toolBtn, marginLeft: 'auto' }} onClick={() => setSel(null)}>닫기</button>
        </div>
      )}
      {(m.kind === 'text' || m.kind === 'img') && editText === null && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: FAINT }}>
          말한 사람
          {f.members.map(x => (
            <button key={x.key} type="button" onClick={() => patchMsg(m.id, { who: x.key })}
              style={{ ...toolBtn, padding: '2px 9px 2px 3px', display: 'inline-flex', alignItems: 'center', gap: 5, ...(m.who === x.key ? { borderColor: '#4a5bd8', fontWeight: 800 } : {}) }}>
              <TalkAvatar m={x} ch={ctx.charOf(x.charId)} size={20} />{x.name}
            </button>
          ))}
          <span style={{ marginLeft: 6 }}>시간</span>
          <KInput value={m.time ?? ''} onChange={e => patchMsg(m.id, { time: e.target.value || undefined })} placeholder="오전 3:02" style={{ width: 96, padding: '4px 8px' }} />
        </div>
      )}
    </div>
  );

  /* ---------- 저장 ---------- */
  const save = () => {
    const user = ctx.user;
    if (!user) { toast('로그인 후 올릴 수 있어요'); return; }
    if (busy > 0) { toast('그림을 올리는 중이에요 — 끝나면 다시 눌러 주세요'); return; }
    const said = f.msgs.some(m => m.kind === 'text' || m.kind === 'img');
    if (!said && !f.caps.length) { toast('대화나 캡처를 하나 이상 넣어 주세요'); return; }
    const firstDay = f.msgs.find(m => m.kind === 'date')?.text;
    const title = f.title.trim() || f.room.trim() || firstDay || '제목 없는 대화';
    const editors = new Set<string>();
    f.relIds.forEach(id => { const r = ctx.relOf(id); if (r) relEditorUids(r, ctx.chars).forEach(u => editors.add(u)); });
    const post: TalkPost = {
      id: edit?.id ?? newId(), title, room: f.room.trim() || undefined, relIds: f.relIds, members: f.members, msgs: f.msgs, caps: f.caps,
      me: f.me, mode: f.mode, carry: f.carry || undefined,
      author: edit?.author ?? user.nickname, authorId: edit?.authorId ?? user.id, editorUids: [...editors].sort(),
      date: edit?.date ?? new Date().toISOString(), visibility: f.vis,
    };
    const bytes = talkBytes(post);
    if (bytes > TALK_MAX_BYTES) {
      toast(`대화가 너무 길어요 (${Math.round(bytes / 1000)}KB) — 날짜 줄 기준으로 두 편으로 나눠 올려 주세요`);
      return;
    }
    ctx.setTalks(edit ? ctx.talks.map(t => (t.id === edit.id ? post : t)) : [post, ...ctx.talks]);
    toast(edit ? '고쳤어요' : '올렸어요');
    onSaved?.(post);
    onClose();
  };

  const tabs: [Tab, string][] = [['file', '파일 불러오기'], ['paste', '붙여넣기'], ['direct', '직접 쓰기'], ['caps', `캡처 이미지${f.caps.length ? ` ${f.caps.length}` : ''}`]];
  const relOpts = [...ctx.rels].sort((a, b) => a.name.localeCompare(b.name)).filter(r => !f.relIds.includes(r.id));
  const nSaid = f.msgs.filter(m => m.kind === 'text' || m.kind === 'img').length;

  return (
    <Modal open={open} onClose={onClose} title={edit ? 'TALK 고치기' : 'TALK 올리기'} dirty
      actions={<>
        {busy > 0 && <span style={{ fontSize: 11.5, color: FAINT, marginRight: 'auto' }}>그림 올리는 중 · {busy}</span>}
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button className="btn btn-dark" onClick={save}>{edit ? 'SAVE' : '올리기'}</button>
      </>}>
      <style>{`
        .mng-box:has(.talk-write){width:min(900px,96vw);max-height:92vh}
        .talk-write,.talk-write>*{min-width:0;max-width:100%}
        .talk-write .grid3{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,.8fr);gap:12px 14px}
        .talk-write .tabs{display:flex;gap:2px;border-bottom:1px solid ${LINE};overflow-x:auto;scrollbar-width:none}
        .talk-write .tabs::-webkit-scrollbar{display:none}
        .talk-write .tabs button{flex:none;padding:8px 12px;font-size:13px;background:transparent;color:var(--sub);border-bottom:2.5px solid transparent;white-space:nowrap}
        .talk-write .tabs button.on{color:var(--ink);font-weight:800;border-bottom-color:var(--ink)}
        @media (max-width:720px){
          .talk-write .grid3{grid-template-columns:1fr}
          .mng-box:has(.talk-write){width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;padding:18px 14px}
        }
      `}</style>
      <div className="talk-write" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid3">
          <div style={FIELD}>
            <span style={LBL}>제목</span>
            <KInput value={f.title} onChange={e => set({ title: e.target.value })} placeholder="새벽 3시 호출" />
          </div>
          <div style={FIELD}>
            <span style={LBL}>자관 <span style={{ fontWeight: 400, color: FAINT }}>— 여러 개 가능 · 자관 페이지에 떠요</span></span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {f.relIds.map(id => (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px 4px 11px', borderRadius: 999, background: 'color-mix(in srgb, var(--ink, #1d2025) 8%, transparent)', fontSize: 12.5 }}>
                  {ctx.relOf(id)?.name ?? '?'}
                  <button type="button" aria-label="빼기" onClick={() => toggleRel(id)} style={{ background: 'transparent', color: FAINT, padding: '0 4px', fontSize: 12 }}>✕</button>
                </span>
              ))}
              {relOpts.length > 0 && (
                <KSelect value="" onChange={v => v && toggleRel(v)} minWidth={150} maxWidth={260}
                  options={[{ value: '', label: <span style={{ color: FAINT }}>{f.relIds.length ? '＋ 자관 더하기' : '자관 고르기'}</span> }, ...relOpts.map(r => ({ value: r.id, label: r.name }))]} />
              )}
            </div>
          </div>
          <div style={FIELD}>
            <span style={LBL}>공개 범위</span>
            <KSelect value={f.vis} onChange={v => set({ vis: v as TalkVis })} minWidth={130}
              options={[{ value: 'member', label: '회원만' }, { value: 'public', label: '전체 공개' }, { value: 'private', label: '나만 보기' }]} />
          </div>
        </div>

        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12 }}>
          <button type="button" onClick={() => setRoomOpen(!roomOpen)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', color: 'var(--ink)', textAlign: 'left' }}>
            <b style={{ fontSize: 13, flex: 'none', whiteSpace: 'nowrap' }}>대화방 설정</b>
            <span style={{ display: 'inline-flex' }}>
              {f.members.slice(0, 5).map((m, i) => <span key={m.key} style={{ marginLeft: i ? -6 : 0, display: 'inline-flex', borderRadius: 9, boxShadow: '0 0 0 2px var(--panel-solid, #fff)' }}><TalkAvatar m={m} ch={ctx.charOf(m.charId)} size={22} /></span>)}
            </span>
            <span style={{ fontSize: 12, color: FAINT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              참여자 {f.members.length} · 이름 · 프로필 · 오른쪽(나){f.me ? ` = ${memberOf(f.me)?.name ?? ''}` : ''}
            </span>
            <span style={{ marginLeft: 'auto', color: FAINT }}>{roomOpen ? '▴' : '▾'}</span>
          </button>
          {roomOpen && (
            <div style={{ padding: '0 12px 12px' }}>
              <MemberEditor ctx={ctx} st={f} set={set} msgs={f.msgs} relIds={f.relIds} />
            </div>
          )}
        </div>

        <div>
          <div className="tabs">
            {tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {pending && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, #e9b949 16%, transparent)', fontSize: 12.5 }}>
              <b>이미 쓴 대화가 있어요</b><span style={{ color: FAINT }}>새로 읽은 {pending.msgs.length}줄을</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-dark" onClick={() => applyImport(pending, 'append')}>뒤에 붙이기</button>
                <button type="button" className="btn btn-ghost" onClick={() => applyImport(pending, 'replace')}>바꾸기</button>
                <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>취소</button>
              </span>
            </div>
          )}

          {tab === 'file' && (
            <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input ref={fileRef} type="file" accept=".txt,.csv,text/plain" style={{ display: 'none' }} onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              <div onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
                style={{ border: `2px dashed ${LINE}`, borderRadius: 12, padding: '26px 16px', textAlign: 'center', fontSize: 13, color: FAINT, cursor: 'pointer' }}>
                <b style={{ display: 'block', color: 'var(--ink)', marginBottom: 4 }}>카톡 「대화 내보내기」 .txt 파일을 끌어다 놓거나 누르기</b>
                PC · 안드로이드 · 아이폰 · 맥 형식 모두 · 사진은 「사진」 자리로 남아서 나중에 채울 수 있어요
              </div>
              <p className="hint" style={{ margin: 0 }}>카톡 대화방 → 설정(≡) → 「대화 내용 내보내기」 → 텍스트만 보내기. 읽은 뒤 「직접 쓰기」 화면에서 고칠 수 있어요.</p>
            </div>
          )}

          {tab === 'paste' && (
            <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <KTextarea rows={10} value={paste} onChange={e => setPaste(e.target.value)}
                placeholder={'카톡에서 복사한 대화를 그대로 붙여 넣거나,\n직접 이렇게 써도 돼요:\n\n— 12월 3일 —\n산타 : 야\n산타 : 추워. 와.\n루돌프 : 지금요…?\n산타 : [사진]\n(중간 생략)'} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: FAINT }}>「이름 : 대사」 · [사진] · — 날짜 — · (안내 줄)</span>
                <button type="button" className="btn btn-dark" style={{ marginLeft: 'auto' }} onClick={() => readText(paste)}>읽어서 말풍선으로</button>
              </div>
            </div>
          )}

          {tab === 'direct' && (
            <div style={{ paddingTop: 12 }}>
              {photos.el}
              <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${LINE}` }}>
                <div style={{ maxHeight: mobile ? '46dvh' : 420, overflowY: 'auto' }}>
                  <ChatView talk={f} me={f.me} charOf={ctx.charOf} selected={sel ?? undefined}
                    onSelect={m => { setSel(sel === m.id ? null : m.id); setEditText(null); }} after={toolbar}
                    onFillImg={m => { setFillFor(m.id); photos.open(); }}
                    empty={<>아래 입력창에 말할 사람을 고르고 써 보세요<br />파일·붙여넣기로 읽어 온 대화도 여기서 고쳐요</>} />
                </div>
                <div style={{ padding: '8px 10px', borderTop: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--panel-solid, #fff)' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {f.members.map(x => (
                      <button key={x.key} type="button" onClick={() => setWho(x.key)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px 2px 3px', borderRadius: 999, fontSize: 12.5, background: 'transparent', color: 'var(--ink)',
                          border: speaker === x.key ? '2px solid #4a5bd8' : `1px solid ${LINE}`, fontWeight: speaker === x.key ? 800 : 500 }}>
                        <TalkAvatar m={x} ch={ctx.charOf(x.charId)} size={22} />{x.name}{f.me === x.key && <span style={{ fontSize: 10, color: '#4a5bd8' }}>나</span>}
                      </button>
                    ))}
                    {f.members.length === 0 && <span style={{ fontSize: 12, color: FAINT }}>말할 사람이 없어요 — 위 「대화방 설정」에서 사람을 넣어 주세요</span>}
                    <KInput value={time} onChange={e => setTime(e.target.value)} placeholder="시간 (선택)" style={{ width: 104, marginLeft: 'auto', padding: '5px 9px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                    <KTextarea rows={1} value={text} onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                      placeholder={sel ? '고른 말풍선 다음에 들어가요 · Enter 보내기' : '메시지 입력 · Enter 보내기 · Shift+Enter 줄바꿈'} style={{ flex: 1, minHeight: 40, padding: '9px 12px' }} />
                    <button type="button" className="btn btn-dark" onClick={send} style={{ height: 40 }}>보내기</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" style={toolBtn} onClick={() => { setFillFor(null); photos.open(); }}>＋ 사진</button>
                    <button type="button" style={toolBtn} onClick={() => { setLineKind('date'); setLineText(dayLine(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())); }}>＋ 날짜 줄</button>
                    <button type="button" style={toolBtn} onClick={() => { setLineKind('info'); setLineText('중간 생략'); }}>＋ 안내 줄</button>
                    <span style={{ fontSize: 11.5, color: FAINT, marginLeft: 'auto' }}>말풍선을 누르면 고치기 · 지우기 · 옮기기 · 말한 사람 바꾸기 · {nSaid}줄</span>
                  </div>
                  {lineKind && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <KInput value={lineText} onChange={e => setLineText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLine(); }} autoFocus
                        placeholder={lineKind === 'date' ? '2025년 12월 3일 수요일' : '중간 생략 · 입장 · 나감'} />
                      <button type="button" className="btn btn-dark" onClick={addLine}>{lineKind === 'date' ? '날짜 줄 넣기' : '안내 줄 넣기'}</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setLineKind(null)}>취소</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'caps' && (
            <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {caps.el}
              <div onClick={caps.open} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const fs = [...e.dataTransfer.files].filter(x => x.type.startsWith('image/')); if (fs.length) uploadCaps(fs); }}
                style={{ border: `2px dashed ${LINE}`, borderRadius: 12, padding: '22px 16px', textAlign: 'center', fontSize: 13, color: FAINT, cursor: 'pointer' }}>
                <b style={{ display: 'block', color: 'var(--ink)', marginBottom: 4 }}>캡처 이미지를 끌어다 놓거나 누르기 · 여러 장</b>
                대화 화면의 「캡처」 탭에 순서대로 모여요 · 긴 캡처도 그대로
              </div>
              {f.caps.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                  {f.caps.map((c, i) => (
                    <div key={`${c.src}${i}`} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${LINE}` }}>
                      <div style={{ height: 130, display: 'flex', justifyContent: 'center', background: '#eef1f5' }}><TalkImgBox img={c} max={130} /></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: 12 }}>
                        <span>
                          <button type="button" style={{ background: 'transparent', color: FAINT, padding: '0 4px' }} onClick={() => { if (i) { const a = [...f.caps]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ caps: a }); } }}>‹</button>
                          {i + 1}
                          <button type="button" style={{ background: 'transparent', color: FAINT, padding: '0 4px' }} onClick={() => { if (i < f.caps.length - 1) { const a = [...f.caps]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set({ caps: a }); } }}>›</button>
                        </span>
                        <button type="button" style={{ background: 'transparent', color: 'var(--accent)', padding: '0 4px' }} onClick={() => set({ caps: f.caps.filter((_, j) => j !== i) })}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );

  async function uploadCaps(files: File[]) {
    setBusy(b => b + files.length);
    try {
      const imgs: TalkImg[] = [];
      for (const fl of files) { imgs.push(await uploadTalkImg(fl)); setBusy(b => b - 1); }
      setF(prev => ({ ...prev, caps: [...prev.caps, ...imgs] }));
    } catch { toast('그림을 올리지 못했어요'); } finally { setBusy(0); }
  }
}
