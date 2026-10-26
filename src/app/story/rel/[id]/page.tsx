'use client';
// STORY (포크) — 커플링(자관) 타임라인. 등록일이 아니라 작중 순서. 박스 안에서 스크롤, 이야기도 박스 안에서 펼침.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { StoryEp } from '@/lib/storyStore';
import { DragList } from '@/components/ui/DragList';
import { useToast } from '@/components/ui/Toast';
import { useStory, EpView, KindBadge, Faces, FAINT, LINE, excerpt, exportMany, useIsMobile, ActionSheet, Fab, RoundBtn } from '@/components/story/StoryParts';
import { KIND_LABEL } from '@/lib/storyStore';
import { StoryWrite } from '@/components/story/StoryWrite';

export default function StoryRelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const ctx = useStory();
  const rel = ctx.relOf(id);
  const [withIf, setWithIf] = useState(true);
  const [openEp, setOpenEp] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [writing, setWriting] = useState(false);
  const [editEp, setEditEp] = useState<StoryEp | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // 폰 화면 (포크): 왼쪽 시점 칸을 없애고 카드 안으로 · 버튼은 ⋯ 메뉴 · 쓰기는 ＋
  const mobile = useIsMobile();
  const [sheet, setSheet] = useState(false);

  const { main, side } = useMemo(() => {
    const eps = rel ? ctx.eps.filter(e => e.relId === rel.id) : [];
    const by = (a: StoryEp, b: StoryEp) => a.order - b.order || a.date.localeCompare(b.date);
    return { main: eps.filter(e => e.kind === 'main').sort(by), side: eps.filter(e => e.kind !== 'main').sort(by) };
  }, [ctx.eps, rel]);
  const shown = withIf ? [...main, ...side] : main;

  useEffect(() => {
    if (!ctx.loaded) return;
    const ep = new URLSearchParams(window.location.search).get('ep');
    if (!ep) return;
    setOpenEp(ep);
    setTimeout(() => {
      const el = document.getElementById(`ep-${ep}`);
      if (el && box.current) box.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
    }, 150);
  }, [ctx.loaded]);

  if (!ctx.loaded) return <section className="page" />;
  if (!rel) return <section className="page"><p className="hint">없는 자관이에요. <Link href="/story?view=rel">커플링으로 ›</Link></p></section>;

  const world = ctx.worldName(ctx.relWorld(rel) ?? main[0]?.worldId);
  const topics = new Set([...main, ...side].map(e => e.topicId)).size;
  const canOrder = [...main, ...side].some(ctx.canEditEp);

  /** 끌어서 놓은 순서대로 — 자리가 바뀐 것만 새 순서 값 (권한 없는 글은 그대로) */
  const applyOrder = (list: StoryEp[]) => {
    let blocked = 0;
    const changed = new Map<string, number>();
    list.forEach((e, i) => {
      const order = (i + 1) * 1000;
      if (e.order === order) return;
      if (!ctx.canEditEp(e)) { blocked++; return; }
      changed.set(e.id, order);
    });
    if (blocked) { toast('순서를 바꿀 권한이 없는 이야기가 있어요 — 같은 자관을 고칠 수 있는 회원만 바꿀 수 있어요'); return; }
    if (changed.size) ctx.setEps(ctx.eps.map(e => (changed.has(e.id) ? { ...e, order: changed.get(e.id)! } : e)));
  };

  const row = (e: StoryEp, drag: boolean) => {
    const on = openEp === e.id && !drag;
    const topic = ctx.topicOf(e.topicId);
    const n = ctx.cmts.filter(c => c.epId === e.id).length;
    const main = e.kind === 'main';
    return (
      <div id={`ep-${e.id}`} style={{ display: 'flex', gap: mobile ? 10 : 14 }}>
        {!mobile && <div className="story-tl-era" style={{ width: 110, flex: 'none', textAlign: 'right', paddingTop: 16, fontSize: 12.5, fontWeight: 700, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.era ?? '—'}</div>}
        <div style={{ width: mobile ? 12 : 16, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ width: 2, height: 18, background: LINE }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', flex: 'none', boxSizing: 'border-box', background: main ? 'var(--ink)' : 'var(--panel-solid, #fff)', border: main ? 'none' : `2px solid ${FAINT}` }} />
          <span style={{ width: 2, flex: 1, background: LINE }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, margin: '6px 0', borderRadius: 12, padding: mobile ? '10px 12px' : '12px 16px', background: main ? 'var(--panel-solid, #fff)' : 'transparent', border: main ? `1px solid ${LINE}` : `1px dashed ${FAINT}`, boxShadow: on ? '0 0 0 2px var(--ink)' : 'none' }}>
          <div onClick={() => !drag && setOpenEp(on ? null : e.id)} style={{ cursor: drag ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {mobile && <div style={{ fontSize: 10.5, color: FAINT }}>{[e.era, KIND_LABEL[e.kind], topic?.name].filter(Boolean).join(' · ')}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
              {drag && <span className="drag-h" style={{ cursor: 'grab', color: FAINT, padding: '0 4px', fontSize: 16 }}>⠿</span>}
              {!mobile && <KindBadge kind={e.kind} />}
              <b style={{ fontSize: 15, minWidth: 0, flex: '1 1 auto', wordBreak: 'keep-all' }}>{e.title}</b>
              {topic && !mobile && <Link href={`/story/topic/${topic.id}`} onClick={ev => ev.stopPropagation()} className="pill" style={{ marginLeft: 'auto', flex: 'none' }}>{topic.name}</Link>}
            </div>
            {!on && <div style={{ fontSize: mobile ? 12.5 : 13, color: 'var(--sub)', lineHeight: 1.7 }}>{excerpt(e.body, mobile ? 50 : 80)}</div>}
            {!on && <div style={{ fontSize: 11, color: FAINT }}>{e.author}{n ? (mobile ? ` · 💬 ${n}` : ` · 댓글 ${n}`) : ''}</div>}
          </div>
          {on && (
            <div style={{ marginTop: 10 }}>
              <EpView ctx={ctx} ep={e} from="rel" onEdit={setEditEp} onDeleted={() => setOpenEp(null)} />
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <span className="fx" style={{ fontSize: 12, color: 'var(--sub)', cursor: 'pointer' }} onClick={() => setOpenEp(null)}>{mobile ? '▴ 접기' : '▴ 이 이야기 접기'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="page">
      <style>{`
        .story-tl{max-height:min(760px,72vh);overflow-y:auto;overscroll-behavior:contain}
        @media (max-width:720px){.story-tl{max-height:70vh}.story-tl-era{width:64px!important;font-size:11px!important}}
      `}</style>
      {mobile ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Faces chars={rel.members.map(m => ctx.charOf(m.charId))} size={36} max={3} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href="/story?view=rel" style={{ fontSize: 11, color: 'var(--page-desc)' }}>‹ 커플링 · {world ?? '세계관 미지정'}</Link>
              <h2 style={{ fontSize: 19, fontWeight: 900, color: 'var(--page-title)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rel.name}</h2>
            </div>
            <RoundBtn label="더 보기" onClick={() => setSheet(true)}>⋯</RoundBtn>
          </div>
          <div className="mini-seg" style={{ padding: 3, marginBottom: 10 }}>
            <button type="button" className={!withIf ? 'on' : ''} style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setWithIf(false)}>본편만</button>
            <button type="button" className={withIf ? 'on' : ''} style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setWithIf(true)}>IF 포함</button>
          </div>
          <ActionSheet open={sheet} title={`${rel.name} · 에피소드 ${main.length + side.length}`} onClose={() => setSheet(false)} items={[
            { label: '전체 TXT로 백업', onClick: () => exportMany(ctx, rel.name, shown) },
            ...(canOrder ? [{ label: reorder ? '순서 바꾸기 끝내기' : '순서 바꾸기', onClick: () => { setReorder(!reorder); setOpenEp(null); } }] : []),
            { label: '자관 페이지로', href: `/rels/${rel.slug || rel.id}` },
          ]} />
          {ctx.canWrite && !reorder && <Fab onClick={() => setWriting(true)} />}
        </>
      ) : (<>
      <div style={{ marginBottom: 6 }}><Link href="/story?view=rel" style={{ fontSize: 12.5, color: 'var(--page-desc)' }}>‹ 커플링으로</Link></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Faces chars={rel.members.map(m => ctx.charOf(m.charId))} size={60} max={3} />
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ fontSize: 12, color: 'var(--page-desc)' }}>{world ?? '세계관 미지정'} · 자관</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--page-title)', margin: '2px 0' }}>{rel.name}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--page-desc)' }}>
            에피소드 {main.length + side.length} · 주제 {topics} · <Link href={`/rels/${rel.slug || rel.id}`} style={{ color: 'var(--page-title)' }}>자관 페이지로 ›</Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <div className="mini-seg" style={{ padding: 3 }}>
            <button type="button" className={!withIf ? 'on' : ''} style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setWithIf(false)}>본편만</button>
            <button type="button" className={withIf ? 'on' : ''} style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setWithIf(true)}>IF 포함</button>
          </div>
          <button className="btn btn-ghost" onClick={() => exportMany(ctx, rel.name, shown)}>⇩ 전체 TXT 백업</button>
          {canOrder && <button className={`btn ${reorder ? 'btn-dark' : 'btn-ghost'}`} onClick={() => { setReorder(!reorder); setOpenEp(null); }}>{reorder ? '순서 다 바꿨어요' : '✎ 순서 바꾸기'}</button>}
          {ctx.canWrite && <button className="btn btn-dark" onClick={() => setWriting(true)}>＋ 이 자관으로 쓰기</button>}
        </div>
      </div>
      </>)}

      <div className="panel" style={{ padding: mobile ? '12px 10px 6px' : '18px 18px 10px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: FAINT, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={mobile ? { fontSize: 11 } : undefined}>{mobile ? (reorder ? '⠿를 잡고 끌어서 순서 바꾸기' : '작중 시간순') : null}{!mobile && (reorder ? '⠿를 잡고 끌어서 작중 순서를 바꿔요 — 본편과 IF·AU는 따로 정렬돼요' : '작중 시간순 — 등록한 날짜가 아니라 「작중 시점」 자리 순서예요')}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <span className="fx" style={{ cursor: 'pointer' }} onClick={() => box.current?.scrollTo({ top: 0, behavior: 'smooth' })}>▲ 맨 위</span>
            <span className="fx" style={{ cursor: 'pointer' }} onClick={() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' })}>▼ 맨 아래</span>
          </span>
        </div>
        <div ref={box} className="story-tl light-scroll" style={{ position: 'relative', paddingRight: 6 }}>
          {shown.length === 0 && <p className="hint">아직 이 자관의 이야기가 없어요</p>}
          {reorder ? (
            <>
              <DragList items={main} keyOf={e => e.id} onReorder={l => setTimeout(() => applyOrder(l), 0)} render={e => row(e, true)} />
              {withIf && side.length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, color: FAINT, margin: mobile ? '12px 0 2px 22px' : '14px 0 2px 140px' }}>IF · AU</div>
                  <DragList items={side} keyOf={e => e.id} onReorder={l => setTimeout(() => applyOrder(l), 0)} render={e => row(e, true)} />
                </>
              )}
            </>
          ) : (
            <>
              {main.map(e => <React.Fragment key={e.id}>{row(e, false)}</React.Fragment>)}
              {withIf && side.length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, color: FAINT, margin: mobile ? '12px 0 2px 22px' : '14px 0 2px 140px' }}>IF · AU — 작중 시간과 따로</div>
                  {side.map(e => <React.Fragment key={e.id}>{row(e, false)}</React.Fragment>)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <StoryWrite ctx={ctx} open={writing || !!editEp} edit={editEp} init={{ relId: rel.id }}
        onClose={() => { setWriting(false); setEditEp(null); }}
        onSaved={e => { if (e.relId !== rel.id) router.push(`/story/topic/${e.topicId}?ep=${e.id}`); else setOpenEp(e.id); }} />
    </section>
  );
}
