'use client';
// TALK (포크) — 카톡 썰 보관함 목록. 대화방 목록처럼 · 자관 칩으로 거르기 · 검색
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { KInput, Pager } from '@/components/ui/Kit';
import { useIsMobile, WriteBtn } from '@/components/story/StoryParts';
import { useTalk, TalkFaces, TalkImgBox, roomLabel, lastLine, kindLabel, lineCount, toTop, FAINT, LINE } from '@/components/talk/TalkParts';
import { TalkWrite } from '@/components/talk/TalkWrite';
import type { TalkPost } from '@/lib/talkStore';

const PER_PAGE = 20;

export default function TalkPage() {
  const ctx = useTalk();
  const router = useRouter();
  const mobile = useIsMobile();
  const [rel, setRel] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('rel');
    if (r) setRel(r);
  }, []);
  const pickRel = (id: string) => {
    setRel(id); setPage(1);
    router.replace(id ? `/talk?rel=${id}` : '/talk', { scroll: false });
  };

  const relIds = useMemo(() => {
    const n = new Map<string, number>();
    ctx.talks.forEach(t => t.relIds?.forEach(id => n.set(id, (n.get(id) ?? 0) + 1)));
    return [...n.entries()].filter(([id]) => ctx.relOf(id)).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [ctx]);
  const noRel = ctx.talks.some(t => !t.relIds?.length);

  const k = q.trim().toLowerCase();
  const hit = (s?: string) => !!s && s.toLowerCase().includes(k);
  const match = (t: TalkPost) => !k || hit(t.title) || hit(t.room) || t.members.some(m => hit(m.name) || hit(ctx.charOf(m.charId)?.name))
    || t.relIds?.some(id => hit(ctx.relOf(id)?.name)) || t.msgs.some(m => hit(m.text));
  const list = ctx.talks
    .filter(t => !rel || (rel === '_none' ? !t.relIds?.length : t.relIds?.includes(rel)))
    .filter(match)
    .sort((a, b) => b.date.localeCompare(a.date));
  const pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, pageCount);

  const chip = (on: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
    background: on ? 'var(--panel-solid, #fff)' : 'transparent', color: on ? 'var(--ink)' : 'var(--page-title, #e3e6ea)',
    border: on ? '1px solid transparent' : '1px solid color-mix(in srgb, var(--page-title, #fff) 35%, transparent)', fontWeight: on ? 700 : 500,
  });

  if (!ctx.loaded) return <section className="page" />;
  return (
    <section className="page">
      <style>{`.talk-chips::-webkit-scrollbar{display:none}.talk-row:hover{background:color-mix(in srgb,var(--ink) 3%,transparent)}`}</style>
      {mobile ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="page-head" style={{ flex: 1, minWidth: 0, marginBottom: 0 }}><PageTitle>TALK</PageTitle></div>
          {ctx.canWrite && <WriteBtn onClick={() => setWriting(true)} />}
        </div>
      ) : (
        <div className="page-head">
          <PageTitle>TALK</PageTitle>
          <EditableDesc k="talk-desc" def="카톡 썰 보관함 — 대화 그대로, 자관과 함께" />
          <div className="head-actions">
            {ctx.canWrite && <button className="btn btn-dark" onClick={() => setWriting(true)}>＋ 올리기</button>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="talk-chips" style={mobile
          ? { display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', order: 3, width: '100%', scrollbarWidth: 'none', paddingBottom: 2 }
          : { display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={chip(!rel)} onClick={() => pickRel('')}>전체</span>
          {relIds.map(id => <span key={id} style={chip(rel === id)} onClick={() => pickRel(id)}>{ctx.relOf(id)?.name}</span>)}
          {noRel && <span style={chip(rel === '_none')} onClick={() => pickRel('_none')}>자관 없음</span>}
        </div>
        <KInput placeholder={mobile ? '검색' : '제목 · 사람 · 자관 · 대화 내용 검색'} value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }} style={mobile ? { flex: 1, minWidth: 0 } : { maxWidth: 260, marginLeft: 'auto' }} />
      </div>

      {list.length === 0 ? (
        <p className="hint">{k ? '찾는 대화가 없어요' : ctx.talks.length ? '이 자관의 대화가 없어요' : '아직 대화가 없어요 — ＋ 버튼으로 첫 카톡 썰을 남겨 보세요'}</p>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          {list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE).map((t, i) => {
            const thumb = t.caps[0] ?? t.msgs.find(m => m.kind === 'img' && m.img)?.img;
            const nCmt = ctx.cmts.filter(c => c.talkId === t.id).length;
            const kind = kindLabel(t);
            return (
              <Link key={t.id} href={`/talk/${t.id}`} className="talk-row"
                style={{ display: 'flex', gap: mobile ? 10 : 14, alignItems: 'center', padding: mobile ? '11px 12px' : '13px 18px', borderTop: i ? `1px solid ${LINE}` : 'none', color: 'inherit' }}>
                <TalkFaces ctx={ctx} t={t} size={mobile ? 30 : 36} max={mobile ? 2 : 3} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                    <b style={{ fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{t.title}</b>
                    {!mobile && t.relIds?.slice(0, 2).map(id => (
                      <span key={id} style={{ flex: 'none', fontSize: 11, padding: '1px 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--ink) 7%, transparent)', color: 'var(--sub)' }}>{ctx.relOf(id)?.name}</span>
                    ))}
                    {kind && <span style={{ flex: 'none', fontSize: 11, color: '#4a5bd8', fontWeight: 700 }}>{kind}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {t.room && <span style={{ color: 'var(--sub)' }}>{roomLabel(t)} · </span>}{lastLine(t)}
                  </div>
                </div>
                {thumb && !mobile && <div style={{ flex: 'none', width: 54, height: 54, borderRadius: 10, overflow: 'hidden' }}><TalkImgBox img={thumb} max={54} /></div>}
                <div style={{ flex: 'none', textAlign: 'right', fontSize: 11.5, color: FAINT, lineHeight: 1.6 }}>
                  {t.date.slice(5, 10).replace('-', '.')}
                  <div>{lineCount(t) ? `${lineCount(t)}줄` : `캡처 ${t.caps.length}`}{nCmt ? ` · 댓글 ${nCmt}` : ''}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <Pager page={cur} total={pageCount} onChange={n => { setPage(n); toTop(); }} />
      </div>

      <TalkWrite ctx={ctx} open={writing} onClose={() => setWriting(false)} initRel={rel && rel !== '_none' ? rel : undefined}
        onSaved={t => router.push(`/talk/${t.id}`)} />
    </section>
  );
}
