'use client';
// STORY (포크) — 주제 결과: 자관별로 묶어 접고 펼치기. 누른 이야기는 바로 아래에서 펼쳐지고 한 번에 하나만.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { StoryEp } from '@/lib/storyStore';
import { KInput, Pager } from '@/components/ui/Kit';
import { useStory, EpView, KindBadge, Faces, FAINT, LINE, toTop, exportMany, useIsMobile, ActionSheet, WriteBtn, RoundBtn } from '@/components/story/StoryParts';
import { KIND_LABEL } from '@/lib/storyStore';
import { StoryWrite } from '@/components/story/StoryWrite';
import { TopicEdit } from '@/components/story/StoryAdmin';

const GROUPS_PER_PAGE = 5;
const EPS_SHOWN = 5;

interface Grp { key: string; name: string; world?: string; relId?: string; eps: StoryEp[]; latest: string }

export default function StoryTopicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ctx = useStory();
  const topic = ctx.topicOf(id);
  const [openG, setOpenG] = useState<Set<string> | null>(null);
  const [openEp, setOpenEp] = useState<string | null>(null);
  const [more, setMore] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [writing, setWriting] = useState(false);
  const [editEp, setEditEp] = useState<StoryEp | null>(null);
  const [topicEdit, setTopicEdit] = useState(false);
  // 폰 화면 (포크 — 「폰에서 복잡하다」 정리): 버튼은 ⋯ 메뉴로, 쓰기는 오른쪽 아래 ＋, 검색은 ⌕ 아이콘
  const mobile = useIsMobile();
  const [sheet, setSheet] = useState(false);
  const [findOpen, setFindOpen] = useState(false);

  const groups: Grp[] = useMemo(() => {
    if (!topic) return [];
    const k = q.trim().toLowerCase();
    const eps = ctx.eps.filter(e => e.topicId === topic.id)
      .filter(e => !k || [e.title, e.era, e.body, ctx.coupleName(e), ...e.cast.map(c => ctx.charOf(c.charId)?.name)].some(s => s?.toLowerCase().includes(k)));
    const map = new Map<string, Grp>();
    eps.forEach(e => {
      const key = e.relId ? `r:${e.relId}` : e.couple ? `c:${e.couple}` : '_';
      let g = map.get(key);
      if (!g) {
        const rel = ctx.relOf(e.relId);
        g = { key, name: rel?.name ?? e.couple ?? '자관 없음', relId: rel?.id, world: ctx.worldName(ctx.relWorld(rel) ?? e.worldId), eps: [], latest: '' };
        map.set(key, g);
      }
      g.eps.push(e);
      if (e.date > g.latest) g.latest = e.date;
    });
    const lane = (e: StoryEp) => (e.kind === 'main' ? 0 : 1);
    return [...map.values()]
      .map(g => ({ ...g, eps: g.eps.sort((a, b) => lane(a) - lane(b) || a.order - b.order || a.date.localeCompare(b.date)) }))
      .sort((a, b) => (a.key === '_' ? 1 : 0) - (b.key === '_' ? 1 : 0) || b.latest.localeCompare(a.latest));
  }, [ctx, topic, q]);

  // ?ep= 로 들어오면 그 이야기를 펼쳐 둔다 (알림·다른 화면에서 넘어올 때)
  useEffect(() => {
    if (!ctx.loaded || !groups.length) return;
    const ep = new URLSearchParams(window.location.search).get('ep');
    const gi = ep ? groups.findIndex(g => g.eps.some(e => e.id === ep)) : -1;
    if (gi >= 0) {
      const g = groups[gi];
      setOpenG(new Set([g.key]));
      setPage(Math.floor(gi / GROUPS_PER_PAGE) + 1);
      if (g.eps.findIndex(e => e.id === ep) >= EPS_SHOWN) setMore(new Set([g.key]));
      setOpenEp(ep);
      setTimeout(() => document.getElementById(`ep-${ep}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
    } else if (openG === null) setOpenG(new Set([groups[0].key]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.loaded, groups.length]);

  if (!ctx.loaded) return <section className="page" />;
  if (!topic) {
    return (
      <section className="page">
        <p className="hint">없는 주제예요 — 합쳐졌거나 지워졌을 수 있어요. <Link href="/story">STORY로 ›</Link></p>
      </section>
    );
  }

  const pageCount = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const cur = Math.min(page, pageCount);
  const shown = groups.slice((cur - 1) * GROUPS_PER_PAGE, cur * GROUPS_PER_PAGE);
  const all = groups.flatMap(g => g.eps);
  const toggleG = (key: string) => setOpenG(s => { const n = new Set(s ?? []); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleEp = (eid: string) => {
    setOpenEp(openEp === eid ? null : eid);
    if (openEp !== eid) setTimeout(() => document.getElementById(`ep-${eid}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  };
  const collapseEp = (eid: string) => {
    setOpenEp(null);
    requestAnimationFrame(() => document.getElementById(`ep-${eid}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  return (
    <section className="page">
      {mobile ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href="/story" style={{ fontSize: 11.5, color: 'var(--page-desc)' }}>‹ STORY · {ctx.catOf(topic.catId)?.name ?? '미분류'}</Link>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--page-title)', margin: '2px 0 0', wordBreak: 'keep-all' }}>{topic.name}</h2>
              {topic.desc && <div style={{ fontSize: 12, color: 'var(--page-desc)', marginTop: 2 }}>{topic.desc}</div>}
            </div>
            <RoundBtn label="검색" onClick={() => setFindOpen(!findOpen)}>⌕</RoundBtn>
            {ctx.canWrite && <WriteBtn onClick={() => setWriting(true)} />}
            <RoundBtn label="더 보기" onClick={() => setSheet(true)}>⋯</RoundBtn>
          </div>
          {(findOpen || q) && (
            <KInput placeholder="이 주제 안에서 검색" value={q} autoFocus onChange={e => { setQ(e.target.value); setPage(1); }} style={{ marginBottom: 10 }} />
          )}
          <ActionSheet open={sheet} title={`${topic.name} · 에피소드 ${all.length}`} onClose={() => setSheet(false)} items={[
            { label: '주제 전체 TXT로 저장', onClick: () => exportMany(ctx, topic.name, all) },
            ...(ctx.canWrite ? [{ label: '주제 수정 · 합치기', onClick: () => setTopicEdit(true) }] : []),
          ]} />
        </>
      ) : (<>
      <div style={{ marginBottom: 6 }}><Link href="/story" style={{ fontSize: 12.5, color: 'var(--page-desc)' }}>‹ STORY</Link></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <span className="pill">{ctx.catOf(topic.catId)?.name ?? '미분류'}</span>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: 'var(--page-title)', margin: '8px 0 2px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {topic.name}
            {ctx.canWrite && <button type="button" onClick={() => setTopicEdit(true)} style={{ fontSize: 12, fontWeight: 500, color: 'var(--page-desc)', border: '1px solid color-mix(in srgb, var(--page-title) 30%, transparent)', borderRadius: 6, padding: '3px 9px', background: 'transparent' }}>✎ 주제 수정 · 합치기</button>}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--page-desc)' }}>
            {topic.desc ? `${topic.desc} · ` : ''}자관 {groups.filter(g => g.relId).length} · 에피소드 {all.length}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button className="btn btn-ghost" onClick={() => exportMany(ctx, topic.name, all)}>⇩ 주제 전체 TXT</button>
          {ctx.canWrite && <button className="btn btn-dark" onClick={() => setWriting(true)}>＋ 이 주제로 쓰기</button>}
        </div>
      </div>
      </>)}

      {topic.ifQ && (
        <Link href={`/ifs?q=${encodeURIComponent(topic.ifQ)}`} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 12, color: 'inherit', fontSize: 13 }}>
          <span className="pill dark">IF</span>
          <span style={{ minWidth: 0, flex: 1 }}>IF 썰에도 「{topic.ifQ}」 질문이 있어요</span>
          <b style={{ flex: 'none' }}>보러 가기 →</b>
        </Link>
      )}

      {!mobile && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <KInput placeholder="이 주제 안에서 검색" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} style={{ maxWidth: 240 }} />
      </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {shown.map(g => {
          const isOpen = !!openG?.has(g.key);
          const rel = ctx.relOf(g.relId);
          const list = more.has(g.key) ? g.eps : g.eps.slice(0, EPS_SHOWN);
          return (
            <div key={g.key} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              {mobile ? (
                <div onClick={() => toggleG(g.key)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', cursor: 'pointer', minWidth: 0 }}>
                  {rel ? <Faces chars={rel.members.map(m => ctx.charOf(m.charId))} size={26} max={3} /> : <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1px dashed ${FAINT}`, flex: 'none' }} />}
                  <b style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</b>
                  <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap' }}>{[g.world, g.eps.length].filter(Boolean).join(' · ')}</span>
                  <span style={{ marginLeft: 'auto', color: FAINT, fontSize: 11 }}>{isOpen ? '▴' : '▾'}</span>
                </div>
              ) : (
              <div onClick={() => toggleG(g.key)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}>
                {rel ? <Faces chars={rel.members.map(m => ctx.charOf(m.charId))} size={38} max={3} /> : <span style={{ width: 38, height: 38, borderRadius: '50%', border: `1px dashed ${FAINT}`, flex: 'none' }} />}
                <div style={{ minWidth: 0 }}>
                  {g.world && <div style={{ fontSize: 11.5, color: FAINT }}>{g.world}</div>}
                  <div style={{ fontSize: 16.5, fontWeight: 900 }}>{g.name}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--sub)', whiteSpace: 'nowrap' }}>{g.eps.length}개의 이야기 {isOpen ? '▴' : '▾'}</span>
              </div>
              )}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${LINE}` }}>
                  {list.map(e => {
                    const on = openEp === e.id;
                    const n = ctx.cmts.filter(c => c.epId === e.id).length;
                    return (
                      <div key={e.id} id={`ep-${e.id}`} style={{ borderBottom: `1px solid ${LINE}`, borderLeft: on && !mobile ? '4px solid var(--ink)' : mobile ? 'none' : '4px solid transparent', scrollMarginTop: 12 }}>
                        {mobile ? (
                          <div onClick={() => toggleEp(e.id)} style={{ padding: '11px 16px', cursor: 'pointer', minWidth: 0 }}>
                            <div style={{ fontSize: 10.5, color: FAINT }}>{[e.era, KIND_LABEL[e.kind]].filter(Boolean).join(' · ')}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <b style={{ fontSize: 15, minWidth: 0, flex: 1, wordBreak: 'keep-all' }}>{e.title}</b>
                              <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap' }}>{on ? '접기 ▴' : n ? `댓글 ${n}` : '▾'}</span>
                            </div>
                          </div>
                        ) : (
                        <div onClick={() => toggleEp(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', cursor: 'pointer', minWidth: 0 }}>
                          <span className="story-era" style={{ width: 96, flex: 'none', fontSize: 12, color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.era ?? '—'}</span>
                          <KindBadge kind={e.kind} />
                          <span style={{ fontSize: 14, fontWeight: on ? 800 : 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: FAINT, whiteSpace: 'nowrap' }}>{n ? `댓글 ${n} · ` : ''}{on ? '접기 ▴' : '▾'}</span>
                        </div>
                        )}
                        {on && (
                          <div style={{ padding: mobile ? '0 16px 14px' : '4px 22px 16px 28px' }}>
                            <EpView ctx={ctx} ep={e} from="topic" onEdit={setEditEp} onDeleted={() => setOpenEp(null)} />
                            {!mobile && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                              <span className="fx" style={{ fontSize: 12, color: 'var(--sub)', cursor: 'pointer' }} onClick={() => collapseEp(e.id)}>▴ 이 이야기 접기</span>
                            </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {g.eps.length > EPS_SHOWN && (
                    <div onClick={() => setMore(s => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                      style={{ padding: '10px 18px', fontSize: 12, color: 'var(--sub)', textAlign: 'center', cursor: 'pointer' }}>
                      {more.has(g.key) ? '▴ 줄이기' : `이 자관 이야기 ${g.eps.length - EPS_SHOWN}개 더 보기 ▾`}
                    </div>
                  )}
                  {rel && (
                    <div style={{ padding: '8px 18px 12px', fontSize: 12, textAlign: 'right' }}>
                      <Link href={`/story/rel/${rel.id}`} style={{ color: 'var(--sub)' }}>{mobile ? `${rel.name} 타임라인 ›` : '이 커플링 전체 타임라인 ›'}</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {groups.length === 0 && <p className="hint">{q ? '찾는 이야기가 없어요' : '이 주제에는 아직 이야기가 없어요'}</p>}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <Pager page={cur} total={pageCount} onChange={n => { setPage(n); toTop(); }} />
      </div>

      <StoryWrite ctx={ctx} open={writing || !!editEp} edit={editEp} init={{ topicId: topic.id }}
        onClose={() => { setWriting(false); setEditEp(null); }}
        onSaved={e => {
          if (e.topicId !== topic.id) { router.push(`/story/topic/${e.topicId}?ep=${e.id}`); return; }
          const key = e.relId ? `r:${e.relId}` : e.couple ? `c:${e.couple}` : '_';
          setOpenG(s => new Set(s ?? []).add(key)); setOpenEp(e.id);
        }} />
      {topicEdit && <TopicEdit ctx={ctx} topic={topic} onClose={() => setTopicEdit(false)} onGone={() => router.push('/story')} />}
    </section>
  );
}
