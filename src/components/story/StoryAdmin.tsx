'use client';
// STORY (포크) — 관리 창: 여러 편 가져오기 · 주제 수정·합치기 · 카테고리 관리
import React, { useEffect, useMemo, useState } from 'react';
import { newId } from '@/lib/postStore';
import { relEditorUids } from '@/lib/charAccess';
import {
  StoryEp, StoryTopic, StoryCat, StoryCast, normKey, laneOf, parseStoryBlock, splitStoryBlocks, DEFAULT_CATS,
} from '@/lib/storyStore';
import { Modal } from '@/components/ui/Modal';
import { KInput, KTextarea, KSelect } from '@/components/ui/Kit';
import { DragList } from '@/components/ui/DragList';
import { useToast } from '@/components/ui/Toast';
import { guessChar } from '@/components/ifs/IfParts';
import { useIfTitles, ifMatches } from './StoryWrite';
import { FAINT, LINE, type StoryCtx } from './StoryParts';

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--sub, #5d636d)' };

/* =================== 여러 편 가져오기 =================== */
interface ImportRow {
  i: number; title: string; topic: string; relName?: string; relId: string; era?: string;
  kind: StoryEp['kind']; cast: StoryCast[]; missing: string[]; keywords: string[]; cat?: string; body: string;
  dupId?: string; suggest?: { id: string; name: string };
}

/** 이름이 얼마나 비슷한가 (0~1) — 글자를 겹쳐 센다. 「마띠스 / 마티스」처럼 한두 글자 다른 걸 찾는 용도 */
function likeness(a: string, b: string): number {
  const x = normKey(a), y = normKey(b);
  if (!x || !y) return 0;
  const pool = [...y];
  let hit = 0;
  for (const ch of x) { const i = pool.indexOf(ch); if (i >= 0) { hit++; pool.splice(i, 1); } }
  return hit / Math.max(x.length, y.length);
}

export function StoryImport({ ctx, open, onClose }: { ctx: StoryCtx; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [relPick, setRelPick] = useState<Record<number, string>>({});
  const [dupAct, setDupAct] = useState<Record<number, 'skip' | 'over'>>({});
  useEffect(() => { if (open) { setText(''); setRelPick({}); setDupAct({}); } }, [open]);
  const sortedChars = useMemo(() => [...ctx.chars].filter(c => c.name?.trim()), [ctx.chars]);

  const rows: ImportRow[] = useMemo(() => splitStoryBlocks(text).map((blk, i) => {
    const { head, body } = parseStoryBlock(blk);
    const auto = head.couple ? ctx.rels.find(r => normKey(r.name) === normKey(head.couple!)) : undefined;
    const relId = relPick[i] ?? auto?.id ?? '';
    const rel = ctx.relOf(relId);
    const cast: StoryCast[] = rel ? rel.members.map(m => ({ charId: m.charId, role: 'main' })) : [];
    const missing: string[] = [];
    (head.cast ?? []).forEach(n => {
      const id = guessChar(n, sortedChars, rel?.members.map(m => m.charId) ?? []);
      if (!id) missing.push(n);
      else if (!cast.some(c => c.charId === id)) cast.push({ charId: id, role: 'sub' });
    });
    const title = head.title?.trim() || body.split('\n')[0].slice(0, 30) || `가져온 글 ${i + 1}`;
    const dup = ctx.eps.find(e => normKey(e.title) === normKey(title) && (e.relId ?? '') === relId);
    const like = head.couple && !auto
      ? ctx.rels.map(r => ({ r, v: likeness(head.couple!, r.name) })).sort((a, b) => b.v - a.v)[0] : undefined;
    const suggest = like && like.v >= 0.6 ? { id: like.r.id, name: like.r.name } : undefined;
    return {
      i, title, topic: head.topic?.trim() ?? '', relName: head.couple, relId, era: head.era, kind: head.kind ?? 'main',
      cast, missing, keywords: head.keywords ?? [], cat: head.cat, body, dupId: dup?.id, suggest,
    };
  }), [text, relPick, ctx.rels, ctx.eps, sortedChars, ctx]);

  const problems = (r: ImportRow) => [
    !r.topic && '주제 없음',
    r.relName && !r.relId && `「${r.relName}」 자관 못 찾음`,
    !r.body.trim() && '본문 없음',
  ].filter(Boolean) as string[];
  const ready = rows.filter(r => r.topic && r.body.trim() && !(r.dupId && (dupAct[r.i] ?? 'skip') === 'skip'));

  const onFile = (file?: File) => {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => setText(String(rd.result ?? '').replace(/^﻿/, ''));
    rd.readAsText(file, 'utf-8');
  };

  const save = () => {
    const user = ctx.user;
    if (!user) { toast('로그인 후 쓸 수 있어요'); return; }
    if (!ready.length) { toast('가져올 글이 없어요 — 주제와 본문이 있어야 해요'); return; }
    const now = Date.now();
    let topics = [...ctx.topics];
    let cats = [...ctx.cats];
    let eps = [...ctx.eps];
    ready.forEach((r, n) => {
      const date = new Date(now + n).toISOString();
      let topic = topics.find(t => normKey(t.name) === normKey(r.topic));
      if (!topic) {
        let catId: string | undefined;
        if (r.cat) {
          let c = cats.find(x => normKey(x.name) === normKey(r.cat!));
          if (!c) {
            c = { id: newId(), name: r.cat, order: cats.length, authorId: user.id, editorUids: ctx.memberIds, date, visibility: 'member' };
            cats = [...cats, c];
          }
          catId = c.id;
        }
        topic = { id: newId(), name: r.topic, catId, authorId: user.id, editorUids: ctx.memberIds, date, visibility: 'member' };
        topics = [...topics, topic];
      }
      const rel = ctx.relOf(r.relId);
      const over = r.dupId && dupAct[r.i] === 'over' ? eps.find(e => e.id === r.dupId) : undefined;
      const lane = laneOf(eps, r.relId || undefined, r.kind, over?.id);
      const ep: StoryEp = {
        id: over?.id ?? newId(), topicId: topic.id, title: r.title, relId: r.relId || undefined,
        couple: r.relId ? undefined : r.relName, worldId: ctx.relWorld(rel), cast: r.cast, era: r.era, kind: r.kind,
        order: over?.order ?? ((lane[lane.length - 1]?.order ?? 0) + 1000), keywords: r.keywords, body: r.body,
        style: over?.style, author: over?.author ?? user.nickname, authorId: over?.authorId ?? user.id,
        editorUids: rel ? relEditorUids(rel, ctx.chars) : [], date: over?.date ?? date, visibility: over?.visibility ?? 'member',
      };
      eps = over ? eps.map(e => (e.id === ep.id ? ep : e)) : [...eps, ep];
    });
    if (cats.length !== ctx.cats.length) ctx.setCats(cats);
    if (topics.length !== ctx.topics.length) ctx.setTopics(topics);
    ctx.setEps(eps);
    toast(`${ready.length}편 가져왔어요`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="여러 편 한 번에 가져오기" desc="TXT를 붙여넣거나 파일을 올려요 · 「===」 줄로 에피소드를 나눠요" dirty={!!text}
      actions={<>
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button className="btn btn-dark" onClick={save}>{ready.length ? `${ready.length}편 ADD` : 'ADD'}</button>
      </>}>
      <style>{`.mng-box:has(.story-import){width:min(980px,96vw);max-height:90vh}
        .story-import{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
        @media (max-width:720px){.story-import{grid-template-columns:1fr}}`}</style>
      <div className="story-import">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="btn btn-ghost" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
            TXT 파일 올리기<input type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
          </label>
          <KTextarea rows={20} value={text} onChange={e => setText(e.target.value)} style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }}
            placeholder={'[주제]: 화이트데이\n[제목]: 사탕을 잊어버린 날\n[커플링]: 이찬성 × 박하진\n[시점]: 고등학교 2학년\n[구분]: 본편\n[등장]: 나태영, 서도영\n[키워드]: #사탕 #기념일\n화이트데이에 사탕을 준비하지 않은 이찬성.\n나태영 : 찬성찬성, 사탕 언제 주려고?ㅋㅋㅋ\n===\n[주제]: 질투하는 순간\n[제목]: 말하지 않는 질투\n…'} />
          <p className="hint" style={{ margin: 0 }}>머리줄: [주제] [제목] [커플링] [시점] [구분] [등장] [키워드] [카테고리] — 빼도 되는 줄은 빼도 돼요. STORY에서 내보낸 TXT도 그대로 다시 넣을 수 있어요.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <span style={LBL}>확인 — {rows.length}편 찾음</span>
          {rows.length === 0 && <p className="hint">왼쪽에 붙여넣으면 여기서 미리 확인해요</p>}
          {rows.map(r => {
            const bad = problems(r);
            const skip = r.dupId && (dupAct[r.i] ?? 'skip') === 'skip';
            return (
              <div key={r.i} style={{ border: `1px solid ${bad.length ? '#e0b46a' : LINE}`, borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, opacity: skip ? .55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</b>
                  {r.topic && <span className="pill">{r.topic}{ctx.topics.some(t => normKey(t.name) === normKey(r.topic)) ? '' : ' · 새 주제'}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: bad.length ? '#b5651d' : '#2d6a4f', whiteSpace: 'nowrap' }}>{bad.length ? '확인 필요' : '✓ 준비됨'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: FAINT }}>
                  <KSelect value={r.relId} onChange={v => setRelPick(p => ({ ...p, [r.i]: v }))} minWidth={180} maxWidth={260}
                    options={[{ value: '', label: <span style={{ color: FAINT }}>{r.relName ? `자관 없음 (「${r.relName}」 그대로)` : '자관 없음'}</span> },
                      ...[...ctx.rels].sort((a, b) => a.name.localeCompare(b.name)).map(x => ({ value: x.id, label: x.name }))]} />
                  <span>{r.era ?? '시점 없음'} · {r.kind === 'main' ? '본편' : r.kind.toUpperCase()} · 등장 {r.cast.length}명</span>
                </div>
                {bad.length > 0 && <div style={{ fontSize: 11.5, color: '#b5651d' }}>{bad.join(' · ')}</div>}
                {!r.relId && r.suggest && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                    <span style={{ color: FAINT }}>비슷한 자관: {r.suggest.name}</span>
                    <button type="button" className="btn btn-ghost" style={{ padding: '3px 10px' }} onClick={() => setRelPick(p => ({ ...p, [r.i]: r.suggest!.id }))}>이 자관으로</button>
                  </div>
                )}
                {r.missing.length > 0 && <div style={{ fontSize: 11.5, color: FAINT }}>못 찾은 이름(빼고 넣어요): {r.missing.join(', ')}</div>}
                {r.dupId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                    <span style={{ color: '#b5651d' }}>같은 제목의 글이 이미 있어요</span>
                    <div className="mini-seg">
                      <button type="button" className={(dupAct[r.i] ?? 'skip') === 'skip' ? 'on' : ''} onClick={() => setDupAct(d => ({ ...d, [r.i]: 'skip' }))}>건너뛰기</button>
                      <button type="button" className={dupAct[r.i] === 'over' ? 'on' : ''} onClick={() => setDupAct(d => ({ ...d, [r.i]: 'over' }))}>덮어쓰기</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rows.length > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--ink, #1d2025) 5%, transparent)', fontSize: 12, lineHeight: 1.7, color: 'var(--sub, #5d636d)' }}>
              · 같은 주제는 띄어쓰기·기호가 달라도 하나로 묶여요<br />
              · 작중 순서는 그 자관 타임라인 맨 뒤로 들어가요 — 나중에 타임라인에서 끌어서 옮겨요<br />
              · 글 모양(글꼴 등)은 넣은 뒤 각 에피소드 수정에서
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* =================== 주제 수정 · 합치기 =================== */
export function TopicEdit({ ctx, topic, onClose, onGone }: {
  ctx: StoryCtx; topic: StoryTopic | null; onClose: () => void; onGone?: () => void;
}) {
  const toast = useToast();
  const ifTitles = useIfTitles(ctx);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [catId, setCatId] = useState('');
  const [ifQ, setIfQ] = useState('');
  const [merge, setMerge] = useState<string[]>([]);
  useEffect(() => {
    if (!topic) return;
    setName(topic.name); setDesc(topic.desc ?? ''); setCatId(topic.catId ?? ''); setIfQ(topic.ifQ ?? ''); setMerge([]);
  }, [topic]);
  const count = (id: string) => ctx.eps.filter(e => e.topicId === id).length;
  const others = useMemo(() => {
    if (!topic) return [];
    const k = normKey(topic.name);
    const sim = (t: StoryTopic) => { const q = normKey(t.name); return q === k || q.includes(k) || k.includes(q) ? 0 : 1; };
    return ctx.topics.filter(t => t.id !== topic.id).sort((a, b) => sim(a) - sim(b) || a.name.localeCompare(b.name));
  }, [ctx.topics, topic]);
  if (!topic) return null;
  const sugg = ifMatches(name, ifTitles);
  const ifOpts = [{ value: '', label: <span style={{ color: FAINT }}>연결 안 함</span> },
    ...[...new Set([...(ifQ ? [ifQ] : []), ...sugg, ...ifTitles])].map(t => ({ value: t, label: `${sugg.includes(t) ? '★ ' : ''}${t}` }))];

  const save = () => {
    const n = name.trim();
    if (!n) { toast('주제 이름을 입력해 주세요'); return; }
    const clash = ctx.topics.find(t => t.id !== topic.id && !merge.includes(t.id) && normKey(t.name) === normKey(n));
    if (clash) { toast(`「${clash.name}」 주제가 이미 있어요 — 아래에서 합치기를 골라 주세요`); return; }
    const next: StoryTopic = { ...topic, name: n, desc: desc.trim() || undefined, catId: catId || undefined, ifQ: ifQ || undefined, editorUids: ctx.memberIds };
    let topics = ctx.topics.map(t => (t.id === topic.id ? next : t));
    if (merge.length) {
      // 합치기 — 고칠 수 있는 에피소드만 옮긴다. 다 옮겨진 주제만 지운다
      let kept = 0;
      const eps = ctx.eps.map(e => {
        if (!merge.includes(e.topicId)) return e;
        if (!ctx.canEditEp(e)) { kept++; return e; }
        return { ...e, topicId: topic.id };
      });
      ctx.setEps(eps);
      const empty = merge.filter(id => !eps.some(e => e.topicId === id));
      topics = topics.filter(t => !empty.includes(t.id));
      if (kept) toast(`권한이 없는 에피소드 ${kept}편은 그대로 남았어요 — 그 글쓴이가 옮길 수 있어요`);
    }
    ctx.setTopics(topics);
    onClose();
  };
  const remove = () => {
    if (count(topic.id)) { toast('에피소드가 있는 주제는 지울 수 없어요 — 다른 주제로 합치거나 에피소드를 먼저 지워 주세요'); return; }
    ctx.setTopics(ctx.topics.filter(t => t.id !== topic.id));
    onGone?.();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="주제 수정" dirty
      actions={<>
        <button className="btn btn-ghost" style={{ marginRight: 'auto', color: 'var(--accent)' }} onClick={remove}>주제 삭제</button>
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button className="btn btn-dark" onClick={save}>SAVE</button>
      </>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <span style={LBL}>주제 이름</span>
        <KInput value={name} onChange={e => setName(e.target.value)} />
        <span style={LBL}>한 줄 설명</span>
        <KInput placeholder="사탕 하나로 시작되는 소소한 소동" value={desc} onChange={e => setDesc(e.target.value)} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={LBL}>카테고리</span>
            <KSelect value={catId} onChange={setCatId} minWidth={160}
              options={[{ value: '', label: '미분류' }, ...ctx.cats.map(c => ({ value: c.id, label: c.name }))]} />
          </div>
          <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 220 }}>
            <span style={LBL}>IF 연결 <span style={{ fontWeight: 400, color: FAINT }}>— ★는 이름이 비슷한 질문</span></span>
            <KSelect value={ifQ} onChange={setIfQ} minWidth={220} maxWidth={360} options={ifOpts} />
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12, display: 'grid', gap: 6 }}>
          <span style={LBL}>다른 주제를 여기로 합치기</span>
          {others.length === 0 && <p className="hint" style={{ margin: 0 }}>다른 주제가 없어요</p>}
          <div className="light-scroll" style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {others.map(t => {
              const on = merge.includes(t.id);
              return (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: on ? '1.5px solid var(--ink)' : `1px solid ${LINE}`, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={on} onChange={() => setMerge(on ? merge.filter(x => x !== t.id) : [...merge, t.id])} />
                  <b>{t.name}</b><span style={{ fontSize: 12, color: FAINT }}>에피소드 {count(t.id)}</span>
                </label>
              );
            })}
          </div>
          {merge.length > 0 && <p className="hint" style={{ margin: 0 }}>고른 주제의 에피소드가 전부 「{name || topic.name}」로 옮겨지고, 빈 주제는 사라져요.</p>}
        </div>
      </div>
    </Modal>
  );
}

/* =================== 카테고리 관리 =================== */
export function CatManager({ ctx, open, onClose }: { ctx: StoryCtx; open: boolean; onClose: () => void }) {
  const [list, setList] = useState<StoryCat[]>([]);
  const [add, setAdd] = useState('');
  useEffect(() => { if (open) { setList(ctx.cats); setAdd(''); } }, [open, ctx.cats]);
  const user = ctx.user;
  const mk = (name: string, order: number): StoryCat => ({
    id: newId(), name, order, authorId: user?.id ?? 'admin', editorUids: ctx.memberIds, date: new Date().toISOString(), visibility: 'member',
  });
  const save = () => {
    const next = list.map((c, i) => ({ ...c, order: i, editorUids: ctx.memberIds })).filter(c => c.name.trim());
    const changed = next.filter(c => {
      const o = ctx.cats.find(x => x.id === c.id);
      return !o || o.name !== c.name || o.order !== c.order;
    });
    const gone = ctx.cats.filter(c => !next.some(x => x.id === c.id));
    if (changed.length || gone.length) ctx.setCats(next);
    // 지운 카테고리의 주제는 미분류로
    if (gone.length) {
      const ids = gone.map(g => g.id);
      if (ctx.topics.some(t => t.catId && ids.includes(t.catId))) {
        ctx.setTopics(ctx.topics.map(t => (t.catId && ids.includes(t.catId) ? { ...t, catId: undefined } : t)));
      }
    }
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="카테고리" desc="이름을 바로 고치고 ⠿를 잡아 순서를 바꿔요 · 지운 카테고리의 주제는 미분류로" small
      actions={<>
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button className="btn btn-dark" onClick={save}>SAVE</button>
      </>}>
      <div style={{ display: 'grid', gap: 8 }}>
        <DragList items={list} keyOf={c => c.id} onReorder={l => setTimeout(() => setList(l), 0)} render={c => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span className="drag-h" style={{ cursor: 'grab', color: FAINT, padding: '0 4px' }}>⠿</span>
            <KInput value={c.name} onChange={e => setList(list.map(x => (x.id === c.id ? { ...x, name: e.target.value } : x)))} style={{ flex: 1 }} />
            <span className="fx" style={{ cursor: 'pointer', color: FAINT, padding: '0 6px' }} onClick={() => setList(list.filter(x => x.id !== c.id))}>✕</span>
          </div>
        )} />
        <div style={{ display: 'flex', gap: 6 }}>
          <KInput placeholder="새 카테고리" value={add} onChange={e => setAdd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && add.trim()) { setList([...list, mk(add.trim(), list.length)]); setAdd(''); } }} style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={() => { if (add.trim()) { setList([...list, mk(add.trim(), list.length)]); setAdd(''); } }}>＋ 추가</button>
        </div>
        {list.length === 0 && (
          <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }}
            onClick={() => setList(DEFAULT_CATS.map((n, i) => mk(n, i)))}>기본 카테고리 넣기 ({DEFAULT_CATS.join(' · ')})</button>
        )}
      </div>
    </Modal>
  );
}
