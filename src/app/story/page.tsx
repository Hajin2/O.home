'use client';
// STORY (포크) — 진지한 썰 백업. 주제로 / 커플링(자관)으로 찾기.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StoryEp } from '@/lib/storyStore';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { KInput, Pager } from '@/components/ui/Kit';
import { Face } from '@/components/ifs/IfParts';
import { useStory, Faces, FAINT, toTop, exportMany, useIsMobile, ActionSheet, Fab, RoundBtn } from '@/components/story/StoryParts';
import { StoryWrite } from '@/components/story/StoryWrite';
import { StoryImport, CatManager } from '@/components/story/StoryAdmin';

const PER_PAGE = 12;

export default function StoryPage() {
  const ctx = useStory();
  const router = useRouter();
  const [view, setView] = useState<'topic' | 'rel'>('topic');
  const [cat, setCat] = useState('');
  const [world, setWorld] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  // 폰 화면 (포크): 버튼 3개는 ⋯ 메뉴로, 쓰기는 오른쪽 아래 ＋, 칩은 한 줄로 밀어서, 주제는 한 줄 목록으로
  const mobile = useIsMobile();
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v === 'rel') setView('rel');
  }, []);
  const switchView = (v: 'topic' | 'rel') => {
    setView(v); setPage(1);
    router.replace(v === 'rel' ? '/story?view=rel' : '/story', { scroll: false });
  };

  /* ---------- 검색 ---------- */
  const k = q.trim().toLowerCase();
  const hit = (s?: string) => !!s && s.toLowerCase().includes(k);
  const epHit = (e: StoryEp) => !k || hit(e.title) || hit(e.era) || e.keywords?.some(hit)
    || hit(ctx.coupleName(e)) || e.cast.some(c => hit(ctx.charOf(c.charId)?.name)) || hit(e.body);

  /* ---------- 주제로 ---------- */
  const topicCards = useMemo(() => ctx.topics.map(t => {
    const eps = ctx.eps.filter(e => e.topicId === t.id);
    const rels = new Set(eps.map(e => e.relId ?? `c:${e.couple ?? ''}`));
    const faceIds = [...new Set(eps.flatMap(e => e.cast.filter(c => c.role === 'main').map(c => c.charId)))];
    const kw = [...new Set(eps.flatMap(e => e.keywords ?? []))].slice(0, 3);
    const last = eps.reduce((m, e) => (e.date > m ? e.date : m), '');
    return { t, eps, rels: rels.size, faces: faceIds.map(id => ctx.charOf(id)), kw, last };
  }).filter(c => c.eps.length > 0), [ctx]);

  const topicList = topicCards
    .filter(c => !cat || (cat === '_none' ? !c.t.catId || !ctx.catOf(c.t.catId) : c.t.catId === cat))
    .filter(c => !k || hit(c.t.name) || hit(c.t.desc) || c.eps.some(epHit))
    .sort((a, b) => b.last.localeCompare(a.last));

  /* ---------- 커플링으로 ---------- */
  const relCards = useMemo(() => ctx.rels.map(r => {
    const eps = ctx.eps.filter(e => e.relId === r.id);
    const main = eps.filter(e => e.kind === 'main').sort((a, b) => a.order - b.order);
    return {
      r, eps, topics: new Set(eps.map(e => e.topicId)).size, last: main[main.length - 1]?.era,
      world: ctx.relWorld(r) ?? eps.find(e => e.worldId)?.worldId, latest: eps.reduce((m, e) => (e.date > m ? e.date : m), ''),
    };
  }).filter(c => c.eps.length > 0), [ctx]);
  const worldIds = [...new Set(relCards.map(c => c.world).filter((x): x is string => !!x))];
  const relList = relCards
    .filter(c => !world || c.world === world)
    .filter(c => !k || hit(c.r.name) || c.r.members.some(m => hit(ctx.charOf(m.charId)?.name)) || c.eps.some(epHit))
    .sort((a, b) => b.latest.localeCompare(a.latest));
  const loose = ctx.eps.filter(e => !e.relId && e.couple).length;

  const list = view === 'topic' ? topicList : relList;
  const pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, pageCount);
  const goPage = (n: number) => { setPage(n); toTop(); };

  const chip = (on: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
    background: on ? 'var(--panel-solid, #fff)' : 'transparent', color: on ? 'var(--ink)' : 'var(--page-title, #e3e6ea)',
    border: on ? '1px solid transparent' : '1px solid color-mix(in srgb, var(--page-title, #fff) 35%, transparent)', fontWeight: on ? 700 : 500,
  });

  if (!ctx.loaded) return <section className="page" />;

  const exportAll = () => exportMany(ctx, 'STORY 전체', [...ctx.eps].sort((a, b) => a.topicId.localeCompare(b.topicId) || a.order - b.order));
  return (
    <section className="page">
      <style>{`.story-chips::-webkit-scrollbar{display:none}`}</style>
      {mobile ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="page-head" style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
              <PageTitle>STORY</PageTitle>
            </div>
            <RoundBtn label="더 보기" onClick={() => setSheet(true)}>⋯</RoundBtn>
          </div>
          <ActionSheet open={sheet} title="STORY" onClose={() => setSheet(false)} items={[
            { label: '전체 TXT로 저장', onClick: exportAll },
            ...(ctx.canWrite ? [{ label: '여러 편 가져오기', onClick: () => setImporting(true) }, { label: '카테고리 관리', onClick: () => setCatOpen(true) }] : []),
          ]} />
          {ctx.canWrite && <Fab onClick={() => setWriting(true)} />}
        </>
      ) : (
      <div className="page-head">
        <PageTitle>STORY</PageTitle>
        <EditableDesc k="story-desc" def="캐릭터들의 사소하고 특별한 이야기 — 주제로도, 커플링으로도" />
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={exportAll}>⇩ 전체 TXT</button>
          {ctx.canWrite && <button className="btn btn-ghost" onClick={() => setImporting(true)}>여러 편 가져오기</button>}
          {ctx.canWrite && <button className="btn btn-dark" onClick={() => setWriting(true)}>＋ 에피소드</button>}
        </div>
      </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="mini-seg" style={{ padding: 3 }}>
          <button type="button" className={view === 'topic' ? 'on' : ''} style={{ padding: '6px 14px', fontSize: 12.5 }} onClick={() => switchView('topic')}>주제로</button>
          <button type="button" className={view === 'rel' ? 'on' : ''} style={{ padding: '6px 14px', fontSize: 12.5 }} onClick={() => switchView('rel')}>커플링으로</button>
        </div>
        <div className="story-chips" style={mobile
          ? { display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', order: 3, width: '100%', scrollbarWidth: 'none', paddingBottom: 2 }
          : { display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {view === 'topic' ? (
            <>
              <span style={chip(!cat)} onClick={() => { setCat(''); setPage(1); }}>전체</span>
              {ctx.cats.map(c => <span key={c.id} style={chip(cat === c.id)} onClick={() => { setCat(c.id); setPage(1); }}>{c.name}</span>)}
              {topicCards.some(c => !c.t.catId || !ctx.catOf(c.t.catId)) && <span style={chip(cat === '_none')} onClick={() => { setCat('_none'); setPage(1); }}>미분류</span>}
              {ctx.canWrite && !mobile && <span style={{ ...chip(false), borderStyle: 'dashed' }} onClick={() => setCatOpen(true)}>✎ 카테고리</span>}
            </>
          ) : (
            <>
              <span style={chip(!world)} onClick={() => { setWorld(''); setPage(1); }}>모든 세계관</span>
              {worldIds.map(w => <span key={w} style={chip(world === w)} onClick={() => { setWorld(w); setPage(1); }}>{ctx.worldName(w) ?? '?'}</span>)}
            </>
          )}
        </div>
        <KInput placeholder={view === 'topic' ? '주제 · 캐릭터 · 자관 · 본문 검색' : '자관 · 캐릭터 · 본문 검색'} value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }} style={mobile ? { flex: 1, minWidth: 0 } : { maxWidth: 260, marginLeft: 'auto' }} />
      </div>

      {list.length === 0 && (
        <p className="hint">{k ? '찾는 이야기가 없어요' : ctx.eps.length ? '이 조건의 이야기가 없어요' : '아직 이야기가 없어요 — ＋ 에피소드로 첫 이야기를 남겨 보세요'}</p>
      )}

      <div className="story-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: mobile ? 8 : 12 }}>
        {view === 'topic'
          ? topicList.slice((cur - 1) * PER_PAGE, cur * PER_PAGE).map(({ t, eps, rels, faces, kw }) => mobile ? (
            <Link key={t.id} href={`/story/topic/${t.id}`} className="panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', minWidth: 0 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10.5, color: FAINT }}>{ctx.catOf(t.catId)?.name ?? '미분류'} · 에피소드 {eps.length}{t.ifQ ? ' · IF' : ''}</div>
                <div style={{ fontSize: 15.5, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              </div>
              <Faces chars={faces} size={22} max={3} />
              <span style={{ color: FAINT }}>›</span>
            </Link>
          ) : (
            <Link key={t.id} href={`/story/topic/${t.id}`} className="panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 140, color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: FAINT }}>
                <span className="pill dark">{ctx.catOf(t.catId)?.name ?? '미분류'}</span>
                <span>자관 {rels} · 에피소드 {eps.length}</span>
                <span style={{ marginLeft: 'auto' }}>›</span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-.01em' }}>{t.name}</div>
              {t.desc && <div style={{ fontSize: 13, color: 'var(--sub)' }}>{t.desc}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', minWidth: 0 }}>
                <Faces chars={faces} />
                <span style={{ fontSize: 11.5, color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.map(x => `#${x}`).join(' ')}</span>
                {t.ifQ && <span className="pill" style={{ marginLeft: 'auto', flex: 'none' }}>IF 썰에도 있음</span>}
              </div>
            </Link>
          ))
          : relList.slice((cur - 1) * PER_PAGE, cur * PER_PAGE).map(({ r, eps, topics, last, world: w }) => (
            <Link key={r.id} href={`/story/rel/${r.id}`} className="panel" style={{ padding: mobile ? '12px 14px' : '18px 20px', display: 'flex', gap: mobile ? 12 : 16, alignItems: 'center', color: 'inherit' }}>
              <span style={{ display: 'inline-flex', flex: 'none' }}>
                {r.members.slice(0, 3).map((m, i) => {
                  const c = ctx.charOf(m.charId);
                  return <span key={m.charId} style={{ marginLeft: i ? -14 : 0, borderRadius: '50%', boxShadow: '0 0 0 3px var(--panel-solid, #fff)', display: 'inline-flex' }}><Face ch={c} name={c?.name ?? '?'} size={mobile ? 36 : 52} /></span>;
                })}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 11.5, color: FAINT }}>{ctx.worldName(w) ?? '세계관 미지정'}</div>
                <div style={{ fontSize: 18, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--sub)' }}>에피소드 {eps.length} · 주제 {topics}</div>
                {last && <div style={{ fontSize: 11.5, color: FAINT }}>최근 시점 — {last}</div>}
              </div>
              <span style={{ color: FAINT, fontSize: 18 }}>›</span>
            </Link>
          ))}
      </div>
      {view === 'rel' && loose > 0 && <p className="hint" style={{ textAlign: 'center' }}>자관 없이 쓴 이야기 {loose}편은 주제 화면과 캐릭터 페이지에서 보여요</p>}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <Pager page={cur} total={pageCount} onChange={goPage} />
      </div>

      <StoryWrite ctx={ctx} open={writing} onClose={() => setWriting(false)}
        onSaved={e => router.push(`/story/topic/${e.topicId}?ep=${e.id}`)} />
      <StoryImport ctx={ctx} open={importing} onClose={() => setImporting(false)} />
      <CatManager ctx={ctx} open={catOpen} onClose={() => setCatOpen(false)} />
    </section>
  );
}

