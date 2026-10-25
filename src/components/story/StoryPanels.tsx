'use client';
// STORY (포크) — 다른 페이지에 붙는 칸. 읽기만 하므로 목록을 저장하지 않는 useRawList를 쓴다.
//   CharStories   캐릭터 상세 — 이 캐릭터가 나온 이야기 (출현 로그와 같은 모양)
//   RelStoryPanel 자관 상세 — 작중 시간순 이야기 (IF 썰 칸과 같은 모양)
// 이야기가 하나도 없으면 칸 자체를 그리지 않는다.
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRawList } from '@/lib/rawList';
import type { Relation } from '@/lib/charStore';
import { STORY_KEY, STORY_TOPIC_KEY, KIND_LABEL, type StoryEp, type StoryTopic } from '@/lib/storyStore';

const FAINT = 'var(--faint, #8a8f99)';
const LINE = 'var(--line, rgba(0,0,0,.12))';
const fs = (px: number) => `calc(${px}px*var(--fs,1))`;
const SHOW = 5;

export function CharStories({ charId }: { charId: string }) {
  const eps = useRawList<StoryEp>(STORY_KEY, []);
  const topics = useRawList<StoryTopic>(STORY_TOPIC_KEY, []);
  const rels = useRawList<Relation>('ohome.rels.v1', []);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => eps.list
    .filter(e => e.cast?.some(c => c.charId === charId))
    .map(e => ({
      e, role: e.cast.find(c => c.charId === charId)!.role,
      topic: topics.list.find(t => t.id === e.topicId)?.name,
      rel: rels.list.find(r => r.id === e.relId)?.name ?? e.couple,
    }))
    .sort((a, b) => (a.role === b.role ? b.e.date.localeCompare(a.e.date) : a.role === 'main' ? -1 : 1)),
  [eps.list, topics.list, rels.list, charId]);
  if (!eps.loaded || rows.length === 0) return null;
  const list = all ? rows : rows.slice(0, SHOW);
  return (
    <div style={{ marginTop: 22, fontFamily: 'inherit', fontWeight: 400 }}>
      <div style={{ fontSize: fs(11), color: FAINT, letterSpacing: '.1em', marginBottom: 6 }}>STORY · {rows.length}</div>
      {list.map(({ e, role, topic, rel }) => (
        <div key={e.id} style={{ padding: '7px 0', borderTop: `1px solid ${LINE}`, display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <Link href={`/story/topic/${e.topicId}?ep=${e.id}`}
            style={{ fontSize: fs(12.5), fontWeight: 400, color: 'var(--ink)', minWidth: 0, flex: 1, lineHeight: 1.5 }}>{e.title}</Link>
          <span style={{ fontSize: fs(11), color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>
            {[rel, topic].filter(Boolean).join(' · ')} · {role === 'main' ? '주연' : '조연'}
          </span>
        </div>
      ))}
      {rows.length > SHOW && (
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 7, fontSize: fs(11), color: FAINT, cursor: 'pointer' }} onClick={() => setAll(!all)}>
          {all ? '▴ 줄이기' : `${rows.length - SHOW}개 더 보기 ▾`}
        </div>
      )}
    </div>
  );
}

export function RelStoryPanel({ rel }: { rel: Relation }) {
  const router = useRouter();
  const eps = useRawList<StoryEp>(STORY_KEY, []);
  const topics = useRawList<StoryTopic>(STORY_TOPIC_KEY, []);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const mine = eps.list.filter(e => e.relId === rel.id);
    const by = (a: StoryEp, b: StoryEp) => a.order - b.order || a.date.localeCompare(b.date);
    return [...mine.filter(e => e.kind === 'main').sort(by), ...mine.filter(e => e.kind !== 'main').sort(by)];
  }, [eps.list, rel.id]);
  if (!eps.loaded || rows.length === 0) return null;
  return (
    <div className="panel widget" style={{ marginTop: 16, maxWidth: 1010, marginLeft: 'auto', marginRight: 'auto' }}>
      <h4>
        <span>STORY <span style={{ letterSpacing: 0, color: FAINT, marginLeft: 6 }}>작중 시간순 · {rows.length}</span></span>
        <span className="more" onClick={() => router.push(`/story/rel/${rel.id}`)}>전체 타임라인 ›</span>
      </h4>
      {rows.slice(0, SHOW).map(e => {
        const on = open === e.id;
        const text = e.body.replace(/\s+/g, ' ').trim();
        return (
          <div key={e.id} style={{ borderTop: `1px solid ${LINE}` }}>
            <div onClick={() => setOpen(on ? null : e.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', cursor: 'pointer', minWidth: 0 }}>
              <span style={{ fontSize: 10, color: FAINT, transform: on ? 'rotate(90deg)' : 'none', transition: '.15s' }}>▶</span>
              <span style={{ width: 90, flex: 'none', fontSize: 11.5, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.era ?? '—'}</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '0 6px', borderRadius: 4, flex: 'none', ...(e.kind === 'main' ? { background: 'var(--ink)', color: '#fff' } : { border: `1px solid ${FAINT}`, color: 'var(--sub)' }) }}>{KIND_LABEL[e.kind]}</span>
              <b style={{ fontSize: 13.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</b>
              <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap' }}>{topics.list.find(t => t.id === e.topicId)?.name}</span>
            </div>
            {on && (
              <div style={{ padding: '0 2px 12px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--ink)' }}>{text.length > 180 ? `${text.slice(0, 180)}…` : text}</div>
                <Link href={`/story/rel/${rel.id}?ep=${e.id}`} style={{ fontSize: 11.5, color: 'var(--sub)' }}>STORY에서 읽기 · 댓글 ›</Link>
              </div>
            )}
          </div>
        );
      })}
      {rows.length > SHOW && (
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 8, fontSize: 11.5, color: FAINT }}>
          나머지 {rows.length - SHOW}개는 <Link href={`/story/rel/${rel.id}`} style={{ color: 'var(--sub)' }}>전체 타임라인</Link>에서
        </div>
      )}
    </div>
  );
}
