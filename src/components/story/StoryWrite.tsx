'use client';
// STORY (포크) — 에피소드 등록·수정 창.
//   칸에 입력 / 글로 한 번에 붙여넣기([주제]: 같은 머리줄 → 칸으로 옮김) · 임시저장(이 브라우저) ·
//   IF 비슷한 질문 연결 제안 · 작중 시점 자리 고르기 · 글 모양(에피소드 전체) · 폰에서는 본문/미리보기 탭
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '@/lib/postStore';
import { useRawList } from '@/lib/rawList';
import { relEditorUids } from '@/lib/charAccess';
import { useFonts } from '@/lib/fontStore';
import { IF_KEY, type IfPost } from '@/lib/ifStore';
import {
  StoryEp, StoryTopic, StoryCast, StoryKind, StoryStyle, StoryVis, KIND_LABEL, normKey, laneOf, orderAt,
  parseStoryBlock, splitList, readDraft, writeDraft, StoryDraft, sameLane,
} from '@/lib/storyStore';
import { Modal } from '@/components/ui/Modal';
import { KInput, KTextarea, KSelect } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { Face, CharPicker, guessChar } from '@/components/ifs/IfParts';
import { StoryBody, KindBadge, FAINT, LINE, useIsMobile, type StoryCtx } from './StoryParts';

export interface WriteInit { topicId?: string; relId?: string }

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--sub, #5d636d)' };
const FIELD: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };

/** IF에 있는 질문 글 전부 (IF 글 + 자관 문답 질문) — 연결 제안용 */
export function useIfTitles(ctx: StoryCtx): string[] {
  const ifs = useRawList<IfPost>(IF_KEY, []);
  return useMemo(() => {
    const seen = new Map<string, string>();
    const add = (s?: string) => { const k = s ? normKey(s) : ''; if (k && !seen.has(k)) seen.set(k, s!); };
    ifs.list.forEach(p => add(p.title));
    ctx.rels.forEach(r => {
      if (r.qaEnabled !== false) (r.questions ?? []).forEach(q => add(q.q));
      r.aus.forEach(a => (a.questions ?? []).forEach(q => add(q.q)));
    });
    return [...seen.values()];
  }, [ifs.list, ctx.rels]);
}
/** 주제와 비슷한 IF 질문 — 한쪽이 다른 쪽을 품으면 */
export function ifMatches(name: string, titles: string[]): string[] {
  const k = normKey(name);
  if (k.length < 2) return [];
  return titles.filter(t => { const q = normKey(t); return q.includes(k) || (q.length >= 2 && k.includes(q)); }).slice(0, 3);
}

interface Form {
  topic: string; catId: string; title: string; relId: string; couple: string; worldId: string;
  cast: StoryCast[]; era: string; kind: StoryKind; slot: number; keywords: string; body: string;
  style: StoryStyle; vis: StoryVis; ifQ: string;
}

export function StoryWrite({ ctx, open, onClose, edit, init, onSaved }: {
  ctx: StoryCtx; open: boolean; onClose: () => void; edit?: StoryEp | null; init?: WriteInit;
  onSaved?: (e: StoryEp) => void;
}) {
  const toast = useToast();
  const { fonts } = useFonts();
  const ifTitles = useIfTitles(ctx);
  const draftKey = edit ? `edit:${edit.id}` : `new:${ctx.user?.id ?? 'guest'}`;
  const [mode, setMode] = useState<'form' | 'paste'>('form');
  const [paste, setPaste] = useState('');
  const [tab, setTab] = useState<'body' | 'preview'>('body');
  const [picking, setPicking] = useState(false);
  const [ifNo, setIfNo] = useState<string[]>([]);
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  // 폰 화면 (포크): 꼭 필요한 칸만 보이고 나머지는 「추가 정보」·「글 모양」으로 접는다
  const mobile = useIsMobile();
  const [more, setMore] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const extra = !mobile || more;
  const [f, setF] = useState<Form>(() => blank());
  const touched = useRef(false);

  function blank(): Form {
    return {
      topic: '', catId: '', title: '', relId: '', couple: '', worldId: '', cast: [], era: '', kind: 'main', slot: -1,
      keywords: '', body: '', style: {}, vis: 'member', ifQ: '',
    };
  }
  const set = (patch: Partial<Form>) => { touched.current = true; setF(x => ({ ...x, ...patch })); };

  /* 열 때 — 수정이면 그 글, 새 글이면 넘겨받은 주제·자관 */
  useEffect(() => {
    if (!open) return;
    touched.current = false;
    setMode('form'); setPaste(''); setTab('body'); setPicking(false); setIfNo([]);
    if (edit) {
      setF({
        topic: ctx.topicOf(edit.topicId)?.name ?? '', catId: ctx.topicOf(edit.topicId)?.catId ?? '', title: edit.title,
        relId: edit.relId ?? '', couple: edit.couple ?? '', worldId: edit.worldId ?? '', cast: edit.cast, era: edit.era ?? '',
        kind: edit.kind, slot: -1, keywords: (edit.keywords ?? []).map(k => `#${k}`).join(' '), body: edit.body,
        style: edit.style ?? {}, vis: edit.visibility, ifQ: ctx.topicOf(edit.topicId)?.ifQ ?? '',
      });
    } else {
      const b = blank();
      const t = ctx.topicOf(init?.topicId);
      if (t) { b.topic = t.name; b.catId = t.catId ?? ''; b.ifQ = t.ifQ ?? ''; }
      const rel = ctx.relOf(init?.relId);
      if (rel) {
        b.relId = rel.id; b.worldId = ctx.relWorld(rel) ?? '';
        b.cast = rel.members.map(m => ({ charId: m.charId, role: 'main' as const }));
      }
      setF(b);
    }
    const d = readDraft(draftKey);
    setDraft(d && (!edit || d.at > edit.date) ? d : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit?.id]);

  /* 임시저장 — 손대고 0.8초 쉬면 이 브라우저에 */
  const [savedAt, setSavedAt] = useState('');
  useEffect(() => {
    if (!open || !touched.current) return;
    const t = setTimeout(() => {
      if (!f.title.trim() && !f.body.trim()) return;
      const at = new Date().toISOString();
      writeDraft({ key: draftKey, at, title: f.title, data: f as unknown as Record<string, unknown> }, draftKey);
      setSavedAt(at);
    }, 800);
    return () => clearTimeout(t);
  }, [f, open, draftKey]);

  /* ---------- 파생 ---------- */
  const topicHit = useMemo(() => ctx.topics.find(t => normKey(t.name) === normKey(f.topic) && normKey(f.topic)), [ctx.topics, f.topic]);
  const topicSugs = useMemo(() => {
    const k = normKey(f.topic);
    const count = (id: string) => ctx.eps.filter(e => e.topicId === id).length;
    return ctx.topics
      .filter(t => !k || normKey(t.name).includes(k))
      .map(t => ({ t, n: count(t.id) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [ctx.topics, ctx.eps, f.topic]);
  const curIf = topicHit?.ifQ || f.ifQ;
  // 기존 주제를 고르면(이름이 같아지면) 카테고리 칸을 그 주제 것으로 맞춘다 — 바꾸면 주제 전체가 바뀐다
  useEffect(() => {
    if (topicHit) setF(x => ({ ...x, catId: topicHit.catId ?? '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicHit?.id]);
  const ifSug = curIf ? [] : ifMatches(f.topic, ifTitles).filter(t => !ifNo.includes(t));
  const rel = ctx.relOf(f.relId);
  const lane = laneOf(ctx.eps, f.relId || undefined, f.kind, edit?.id);
  const editIdx = edit && edit.relId === (f.relId || undefined) && sameLane(edit.kind, f.kind)
    ? lane.findIndex(e => e.order > edit.order) : -1;
  const slot = f.slot >= 0 ? Math.min(f.slot, lane.length) : editIdx >= 0 ? editIdx : lane.length;
  const castIds = f.cast.map(c => c.charId);
  const candidates = [...new Set([...(rel?.members.map(m => m.charId) ?? []), ...castIds])];
  const castChars = candidates.map(id => ctx.charOf(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const sortedChars = useMemo(() => [...ctx.chars].filter(c => c.name?.trim()).sort((a, b) => a.name.localeCompare(b.name)), [ctx.chars]);

  const pickRel = (id: string) => {
    const r = ctx.relOf(id);
    const subs = f.cast.filter(c => c.role === 'sub' && !r?.members.some(m => m.charId === c.charId));
    set({
      relId: id, slot: -1,
      worldId: (r && ctx.relWorld(r)) || f.worldId,
      cast: [...(r?.members.map(m => ({ charId: m.charId, role: 'main' as const })) ?? []), ...subs],
    });
  };
  const toggleCast = (id: string) => {
    if (castIds.includes(id)) set({ cast: f.cast.filter(c => c.charId !== id) });
    else set({ cast: [...f.cast, { charId: id, role: rel?.members.some(m => m.charId === id) ? 'main' : 'sub' }] });
  };
  const flipRole = (id: string) => set({ cast: f.cast.map(c => (c.charId === id ? { ...c, role: c.role === 'main' ? 'sub' : 'main' } : c)) });

  /* ---------- 붙여넣기 → 칸 ---------- */
  const applyPaste = () => {
    const { head, body } = parseStoryBlock(paste);
    const patch: Partial<Form> = { body: body || f.body };
    if (head.topic) patch.topic = head.topic;
    if (head.title) patch.title = head.title;
    if (head.era) patch.era = head.era;
    if (head.kind) patch.kind = head.kind;
    if (head.keywords) patch.keywords = head.keywords.map(k => `#${k}`).join(' ');
    if (head.cat) { const c = ctx.cats.find(x => normKey(x.name) === normKey(head.cat!)); if (c) patch.catId = c.id; }
    let r = rel;
    if (head.couple) {
      r = ctx.rels.find(x => normKey(x.name) === normKey(head.couple!));
      if (r) {
        patch.relId = r.id; patch.couple = ''; patch.worldId = ctx.relWorld(r) ?? f.worldId;
      } else { patch.relId = ''; patch.couple = head.couple; }
    }
    const cast: StoryCast[] = r ? r.members.map(m => ({ charId: m.charId, role: 'main' })) : [...f.cast];
    const missing: string[] = [];
    (head.cast ?? []).forEach(n => {
      const id = guessChar(n, sortedChars, r?.members.map(m => m.charId) ?? []);
      if (!id) { missing.push(n); return; }
      if (!cast.some(c => c.charId === id)) cast.push({ charId: id, role: 'sub' });
    });
    patch.cast = cast;
    set(patch);
    setMode('form');
    toast(missing.length ? `칸으로 옮겼어요 — 못 찾은 이름: ${missing.join(', ')}` : '칸으로 옮겼어요 — 확인하고 ADD 해 주세요');
  };

  /* ---------- 저장 ---------- */
  const save = () => {
    const user = ctx.user;
    if (!user) { toast('로그인 후 쓸 수 있어요'); return; }
    const title = f.title.trim();
    const topicName = f.topic.trim();
    if (!topicName) { toast('주제를 입력해 주세요'); return; }
    if (!title) { toast('에피소드 제목을 입력해 주세요'); return; }
    if (!f.body.trim()) { toast('본문을 입력해 주세요'); return; }
    const now = new Date().toISOString();
    // 주제 — 같은 이름(띄어쓰기·기호 무시)이 있으면 그 주제로
    let topic = topicHit;
    let topics = ctx.topics;
    if (!topic) {
      topic = {
        id: newId(), name: topicName, catId: f.catId || undefined, ifQ: f.ifQ || undefined,
        authorId: user.id, editorUids: ctx.memberIds, date: now, visibility: 'member',
      } as StoryTopic;
      topics = [...topics, topic];
    } else if ((f.ifQ && !topic.ifQ) || (f.catId || undefined) !== topic.catId) {
      const t: StoryTopic = { ...topic, ifQ: topic.ifQ || f.ifQ || undefined, catId: f.catId || undefined, editorUids: ctx.memberIds };
      topics = topics.map(x => (x.id === t.id ? t : x));
      topic = t;
    }
    if (topics !== ctx.topics) ctx.setTopics(topics);
    const relId = f.relId || undefined;
    const keepOrder = edit && edit.relId === relId && sameLane(edit.kind, f.kind) && f.slot < 0;
    const ep: StoryEp = {
      id: edit?.id ?? newId(),
      topicId: topic.id, title, relId, couple: relId ? undefined : (f.couple.trim() || undefined),
      worldId: f.worldId || undefined, cast: f.cast, era: f.era.trim() || undefined, kind: f.kind,
      order: keepOrder ? edit!.order : orderAt(lane, slot),
      keywords: splitList(f.keywords),
      body: f.body.replace(/\s+$/, ''), style: Object.keys(f.style).length ? f.style : undefined,
      author: edit?.author ?? user.nickname, authorId: edit?.authorId ?? user.id,
      editorUids: rel ? relEditorUids(rel, ctx.chars) : [],
      date: edit?.date ?? now, visibility: f.vis,
    };
    ctx.setEps(edit ? ctx.eps.map(x => (x.id === ep.id ? ep : x)) : [...ctx.eps, ep]);
    writeDraft(null, draftKey);
    onSaved?.(ep);
    onClose();
  };

  const loadDraft = () => {
    if (!draft) return;
    setF({ ...blank(), ...(draft.data as unknown as Form) });
    touched.current = true;
    setDraft(null);
  };
  const dropDraft = () => { writeDraft(null, draftKey); setDraft(null); };

  /* ---------- 그리기 ---------- */
  const chip = (on: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
    border: on ? '1.5px solid var(--ink, #1d2025)' : `1px solid ${LINE}`,
    background: on ? 'var(--ink, #1d2025)' : 'transparent', color: on ? '#fff' : 'inherit', fontWeight: on ? 700 : 500,
  });
  const fontOpts = [{ value: '', label: '기본 (홈 본문 글꼴)' }, ...fonts.map(x => ({ value: x.id, label: <span style={{ fontFamily: x.family }}>{x.name}</span> }))];
  const num = (v: number | undefined, d: number) => String(v ?? d);
  const styleBar = (
    <div className="story-stylebar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'color-mix(in srgb, var(--ink, #1d2025) 5%, transparent)', borderRadius: '10px 10px 0 0', border: `1px solid ${LINE}`, borderBottom: 'none' }}>
      <span style={{ fontSize: 11.5, color: FAINT }}>글꼴</span>
      <KSelect value={f.style.fontId ?? ''} onChange={v => set({ style: { ...f.style, fontId: v || undefined } })} minWidth={150} maxWidth={200} options={fontOpts} />
      <span style={{ fontSize: 11.5, color: FAINT }}>크기</span>
      <KSelect value={num(f.style.size, 14)} onChange={v => set({ style: { ...f.style, size: Number(v) } })} minWidth={64}
        options={[12, 13, 14, 15, 16, 17, 18, 20].map(n => ({ value: String(n), label: String(n) }))} />
      <span style={{ fontSize: 11.5, color: FAINT }}>줄 간격</span>
      <KSelect value={num(f.style.lh, 1.9)} onChange={v => set({ style: { ...f.style, lh: Number(v) } })} minWidth={64}
        options={[1.5, 1.7, 1.9, 2.1, 2.4].map(n => ({ value: String(n), label: String(n) }))} />
      <span style={{ fontSize: 11.5, color: FAINT }}>자간</span>
      <KSelect value={num(f.style.ls, 0)} onChange={v => set({ style: { ...f.style, ls: Number(v) || undefined } })} minWidth={70}
        options={[-0.05, -0.02, 0, 0.02, 0.05, 0.1].map(n => ({ value: String(n), label: n > 0 ? `+${n}` : String(n) }))} />
      <div className="mini-seg">
        {(['left', 'center', 'justify'] as const).map(a => (
          <button key={a} type="button" className={(f.style.align ?? 'left') === a ? 'on' : ''} onClick={() => set({ style: { ...f.style, align: a } })}>
            {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '양쪽'}
          </button>
        ))}
      </div>
      <div className="mini-seg">
        <button type="button" className={(f.style.nameColor ?? 'char') === 'char' ? 'on' : ''} onClick={() => set({ style: { ...f.style, nameColor: 'char' } })}>이름 캐릭터색</button>
        <button type="button" className={f.style.nameColor === 'ink' ? 'on' : ''} onClick={() => set({ style: { ...f.style, nameColor: 'ink' } })}>이름 글자색</button>
      </div>
    </div>
  );

  const lanePicker = f.relId ? (
    <div style={{ flex: 1, minWidth: 220, border: `1px solid ${LINE}`, borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5, maxHeight: 200, overflowY: 'auto' }} className="light-scroll">
      <div style={{ fontSize: 11.5, color: FAINT, marginBottom: 2 }}>{rel?.name} · {f.kind === 'main' ? '본편' : 'IF · AU'} 순서 — 「여기」 자리에 들어가요</div>
      {Array.from({ length: lane.length + 1 }, (_, i) => (
        <React.Fragment key={i}>
          {i === slot ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, border: '1.5px dashed var(--ink, #1d2025)', fontWeight: 700 }}>
              ● 여기 — {f.title || '이 에피소드'}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '3px 8px' }} disabled={slot === 0} onClick={() => set({ slot: slot - 1 })}>▲</button>
                <button type="button" className="btn btn-ghost" style={{ padding: '3px 8px' }} disabled={slot >= lane.length} onClick={() => set({ slot: slot + 1 })}>▼</button>
              </span>
            </div>
          ) : null}
          {i < lane.length && (
            <div onClick={() => set({ slot: i + 1 })} title="이 아래로 옮기기"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', color: 'var(--sub, #5d636d)', cursor: 'pointer' }}>
              ○ {lane[i].title}<span style={{ marginLeft: 'auto', fontSize: 11, color: FAINT }}>{lane[i].era ?? ''}</span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  ) : (
    <div style={{ flex: 1, minWidth: 220, fontSize: 12, color: FAINT, alignSelf: 'center' }}>자관을 고르면 그 자관 타임라인에서 자리를 고를 수 있어요</div>
  );

  return (
    <Modal open={open} onClose={onClose} title={edit ? '에피소드 수정' : '새 에피소드'} dirty
      actions={<>
        {savedAt && <span style={{ fontSize: 11, color: FAINT, marginRight: 'auto' }}>임시저장됨 · {new Date(savedAt).toTimeString().slice(0, 5)}</span>}
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        {mode === 'paste'
          ? <button className="btn btn-dark" onClick={applyPaste}>칸으로 옮기기</button>
          : <button className="btn btn-dark" onClick={save}>{edit ? 'SAVE' : 'ADD'}</button>}
      </>}>
      <style>{`
        .mng-box:has(.story-write){width:min(940px,96vw);max-height:90vh}
        .story-write .split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border:1px solid ${LINE};border-radius:0 0 10px 10px;overflow:hidden}
        .story-write .split>*{min-width:0}
        .story-write .split .pv{border-left:1px solid ${LINE};padding:14px 18px;max-height:420px;overflow:auto}
        .story-write .tabs{display:none}
        .story-write .tabs button{white-space:nowrap;padding:5px 12px;font-size:12px}
        .story-write .grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px 16px}
        @media (max-width:720px){
          .story-write .grid2{grid-template-columns:1fr}
          .story-write .split{grid-template-columns:1fr}
          .story-write .split .pv{border-left:none}
          .story-write .tabs{display:inline-flex}
          .story-write .split.t-body .pv{display:none}
          .story-write .split.t-preview .ed{display:none}
          .mng-box:has(.story-write){width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;padding:18px 16px}
        }
      `}</style>
      <div className="story-write" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="mini-seg" style={{ alignSelf: 'flex-start' }}>
          <button type="button" className={mode === 'form' ? 'on' : ''} onClick={() => setMode('form')}>칸에 입력</button>
          <button type="button" className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>글로 한 번에 붙여넣기</button>
        </div>

        {draft && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, #e9b949 16%, transparent)', border: '1px solid color-mix(in srgb, #e9b949 45%, transparent)', fontSize: 12.5 }}>
            <b>쓰다 만 글이 있어요</b>
            <span style={{ color: FAINT }}>「{draft.title || '제목 없음'}」 · {draft.at.slice(5, 16).replace('T', ' ').replace('-', '.')}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-dark" onClick={loadDraft}>이어 쓰기</button>
              <button type="button" className="btn btn-ghost" onClick={dropDraft}>버리기</button>
            </span>
          </div>
        )}

        {mode === 'paste' ? (
          <div style={FIELD}>
            <span style={LBL}>맨 앞에 [키]: 값 줄을 쓰면 칸으로 들어가요 — 없는 줄은 비워 둬도 돼요</span>
            <KTextarea rows={14} value={paste} onChange={e => setPaste(e.target.value)}
              placeholder={'[주제]: 화이트데이\n[제목]: 사탕을 잊어버린 날\n[커플링]: 이찬성 × 박하진\n[시점]: 고등학교 2학년\n[구분]: 본편\n[등장]: 나태영, 서도영\n[키워드]: #사탕 #기념일\n\n화이트데이에 사탕을 준비하지 않은 이찬성.\n나태영 : 찬성찬성, 사탕 언제 주려고?ㅋㅋㅋ'} />
            <p className="hint" style={{ margin: 0 }}>여러 편을 한꺼번에 넣으려면 STORY 메인의 「여러 편 가져오기」를 써 주세요.</p>
          </div>
        ) : (
          <>
            <div className="grid2">
              <div style={FIELD}>
                <span style={LBL}>주제</span>
                <KInput placeholder="화이트데이" value={f.topic} onChange={e => set({ topic: e.target.value })} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11.5, color: FAINT, alignItems: 'center' }}>
                  {topicHit ? <span>기존 주제에 들어가요</span> : f.topic.trim() ? <span>새 주제로 만들어져요</span> : <span>기존 주제:</span>}
                  {topicSugs.filter(s => s.t.id !== topicHit?.id).slice(0, 6).map(({ t, n }) => (
                    <span key={t.id} onClick={() => set({ topic: t.name, catId: t.catId ?? '' })}
                      style={{ padding: '1px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--ink, #1d2025) 8%, transparent)', color: 'var(--ink)', cursor: 'pointer' }}>{t.name} {n}</span>
                  ))}
                </div>
                {ifSug.length > 0 && ifSug.map(q => (
                  <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'color-mix(in srgb, var(--ink, #1d2025) 5%, transparent)', fontSize: 12 }}>
                    <span style={{ padding: '0 6px', borderRadius: 4, background: 'var(--ink, #1d2025)', color: '#fff', fontSize: 10.5, fontWeight: 800 }}>IF</span>
                    <span style={{ flex: 1, minWidth: 0 }}>비슷한 질문 「{q}」</span>
                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => set({ ifQ: q })}>연결</button>
                    <span className="fx" style={{ color: FAINT, cursor: 'pointer' }} onClick={() => setIfNo([...ifNo, q])}>아님</span>
                  </div>
                ))}
                {curIf && (
                  <div style={{ fontSize: 11.5, color: FAINT }}>IF 연결 — 「{curIf}」{!topicHit?.ifQ && <span className="fx" style={{ cursor: 'pointer', marginLeft: 6 }} onClick={() => set({ ifQ: '' })}>✕</span>}</div>
                )}
              </div>
              <div style={FIELD}>
                <span style={LBL}>카테고리</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={chip(!f.catId)} onClick={() => set({ catId: '' })}>미분류</span>
                  {ctx.cats.map(c => <span key={c.id} style={chip(f.catId === c.id)} onClick={() => set({ catId: c.id })}>{c.name}</span>)}
                </div>
                <span style={{ fontSize: 11.5, color: FAINT }}>
                  {topicHit && (f.catId || undefined) !== topicHit.catId
                    ? <>카테고리는 주제에 붙어 있어요 — 「{topicHit.name}」의 다른 에피소드도 같이 바뀌어요</>
                    : mobile ? '' : '카테고리 추가·이름 바꾸기는 STORY 메인의 「✎ 카테고리」에서'}
                </span>
              </div>

              <div style={{ ...FIELD, gridColumn: '1 / -1' }}>
                <span style={LBL}>에피소드 제목</span>
                <KInput placeholder="사탕을 잊어버린 날" value={f.title} onChange={e => set({ title: e.target.value })} />
              </div>

              <div style={FIELD}>
                <span style={LBL}>커플링 (자관)</span>
                <KSelect value={f.relId} onChange={pickRel} minWidth={220} maxWidth={360}
                  options={[{ value: '', label: <span style={{ color: FAINT }}>자관 없음 · 직접 입력</span> },
                    ...[...ctx.rels].sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ value: r.id, label: r.name }))]} />
                {!f.relId && <KInput placeholder="조합 이름 (선택) — 예: 찬성 × 태영" value={f.couple} onChange={e => set({ couple: e.target.value })} />}
              </div>
              {extra && <div style={FIELD}>
                <span style={LBL}>세계관 {rel && <span style={{ fontWeight: 400, color: FAINT }}>— 멤버 소속에서 자동</span>}</span>
                <KSelect value={f.worldId} onChange={v => set({ worldId: v })} minWidth={200} maxWidth={320}
                  options={[{ value: '', label: <span style={{ color: FAINT }}>지정 안 함</span> }, ...ctx.worlds.map(w => ({ value: w.id, label: w.name }))]} />
              </div>}

              <div style={{ ...FIELD, gridColumn: '1 / -1' }}>
                <span style={LBL}>{mobile ? '등장인물 — 누르면 넣기/빼기 · 주연/조연 글자로 바꾸기' : '등장인물 — 자관 멤버는 자동 체크(다시 누르면 빠짐) · 주연/조연은 글자를 눌러 바꿔요'}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 10, borderRadius: 10, border: `1px solid ${LINE}` }}>
                  {castChars.map(c => {
                    const on = f.cast.find(x => x.charId === c.id);
                    return (
                      <span key={c.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 3px', borderRadius: 999, fontSize: 12.5,
                        border: on ? '1.5px solid var(--ink, #1d2025)' : `1px solid ${LINE}`, opacity: on ? 1 : .5, cursor: 'pointer',
                      }} onClick={() => toggleCast(c.id)}>
                        <Face ch={c} name={c.name} size={24} />{c.name}
                        {on && <span onClick={e => { e.stopPropagation(); flipRole(c.id); }} style={{ fontSize: 10.5, color: FAINT, textDecoration: 'underline dotted' }}>{on.role === 'main' ? '주연' : '조연'}</span>}
                      </span>
                    );
                  })}
                  <button type="button" onClick={() => setPicking(!picking)}
                    style={{ padding: '4px 12px', borderRadius: 999, border: `1px dashed ${FAINT}`, fontSize: 12.5, background: 'transparent' }}>{picking ? '닫기' : '＋ 캐릭터'}</button>
                </div>
                {picking && <CharPicker chars={sortedChars} value="" onChange={id => { if (id && !castIds.includes(id)) set({ cast: [...f.cast, { charId: id, role: 'sub' }] }); }} />}
              </div>

              <div style={{ ...FIELD, gridColumn: '1 / -1' }}>
                <span style={LBL}>{mobile ? '작중 시점' : '작중 시점 — 글자는 자유, 순서는 자리로 정해요 (등록일이 아니라 작중 순서)'}</span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
                  <div style={{ width: mobile ? '100%' : 220, flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <KInput placeholder="고등학교 2학년" value={f.era} onChange={e => set({ era: e.target.value })} />
                    <div className="mini-seg">
                      {(['main', 'if', 'au'] as const).map(k => (
                        <button key={k} type="button" className={f.kind === k ? 'on' : ''} onClick={() => set({ kind: k, slot: -1 })}>{KIND_LABEL[k]}</button>
                      ))}
                    </div>
                  </div>
                  {extra && lanePicker}
                </div>
              </div>

              {mobile && (
                <button type="button" onClick={() => setMore(!more)}
                  style={{ justifySelf: 'start', padding: '8px 14px', borderRadius: 999, border: `1px solid ${LINE}`, background: 'transparent', fontSize: 12.5, color: 'var(--sub)' }}>
                  {more ? '추가 정보 접기 ▴' : '추가 정보 — 세계관 · 순서 · 키워드 · 공개 범위 ▾'}
                </button>
              )}
              {extra && <div style={FIELD}>
                <span style={LBL}>키워드</span>
                <KInput placeholder="#사탕 #기념일" value={f.keywords} onChange={e => set({ keywords: e.target.value })} />
              </div>}
              {extra && <div style={FIELD}>
                <span style={LBL}>공개 범위</span>
                <KSelect value={f.vis} onChange={v => set({ vis: v as StoryVis })} minWidth={160}
                  options={[{ value: 'member', label: '회원만' }, { value: 'public', label: '전체 공개' }, { value: 'private', label: '나만 보기' }]} />
              </div>}
            </div>

            <div style={FIELD}>
              <span style={{ ...LBL, display: 'flex', alignItems: 'center', gap: 8 }}>
                {mobile ? '본문 — 「이름 : 대사」는 대사 상자로' : '본문 — 「이름 : 대사」 줄은 대사 상자로 · 글 모양은 이 에피소드 전체에 적용'}
                <span className="mini-seg tabs" style={{ marginLeft: 'auto', flex: 'none', whiteSpace: 'nowrap' }}>
                  <button type="button" className={tab === 'body' ? 'on' : ''} onClick={() => setTab('body')}>본문</button>
                  <button type="button" className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>미리보기</button>
                </span>
              </span>
              <div>
                {mobile && (
                  <button type="button" onClick={() => setStyleOpen(!styleOpen)}
                    style={{ marginBottom: 6, padding: '6px 12px', borderRadius: 999, border: `1px solid ${LINE}`, background: 'transparent', fontSize: 12, color: 'var(--sub)' }}>
                    {styleOpen ? '글 모양 접기 ▴' : '글 모양 — 글꼴 · 크기 · 줄 간격 ▾'}
                  </button>
                )}
                {(!mobile || styleOpen) && styleBar}
                <div className={`split t-${tab}`} style={mobile && !styleOpen ? { borderRadius: 10 } : undefined}>
                  <textarea className="ed" value={f.body} onChange={e => set({ body: e.target.value })}
                    placeholder={'화이트데이에 사탕을 준비하지 않은 이찬성.\n\n나태영 : 찬성찬성, 사탕 언제 주려고?ㅋㅋㅋ\n이찬성 : 뭐래ㅋㅋ 꺼져'}
                    style={{ width: '100%', minHeight: 320, border: 'none', outline: 'none', resize: 'vertical', padding: 14, fontSize: 13, lineHeight: 1.75, fontFamily: 'inherit', background: 'transparent', color: 'inherit', boxSizing: 'border-box' }} />
                  <div className="pv">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <KindBadge kind={f.kind} />
                      <b style={{ fontSize: 14 }}>{f.title || '제목'}</b>
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: FAINT }}>미리보기 = 실제 화면</span>
                    </div>
                    <StoryBody body={f.body} style={f.style} cast={castChars} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
