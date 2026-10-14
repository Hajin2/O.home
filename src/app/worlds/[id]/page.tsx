'use client';
// 세계관 상세 — 커버·이름·태그 · 문서 탭 · 소속 캐릭터 · 이 세계관 캐릭터가 속한 자관
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useRawList } from '@/lib/rawList';
import { Character, CHAR_SEED, Relation, REL_SEED, charPath, relPath } from '@/lib/charStore';
import { useVisibleWorlds, useCanSee, canEditWorld } from '@/lib/worldStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { TagList } from '@/components/ui/TagList';
import { PageTitle } from '@/components/ui/PageText';

export default function WorldDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const canSee = useCanSee();
  const worlds = useVisibleWorlds();
  const chars = useRawList<Character>('ohome.chars.v1', CHAR_SEED);
  const rels = useRawList<Relation>('ohome.rels.v1', REL_SEED);
  const [tab, setTab] = useState(0);

  const w = worlds.visible.find(x => x.id === id);
  const members = useMemo(() => chars.list.filter(c => c.own && c.worldId === id && canSee(c.visibility)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chars.list, id, canSee]);
  const memberIds = useMemo(() => new Set(members.map(c => c.id)), [members]);
  // 자관은 따로 세계관을 갖지 않는다 — 소속 캐릭터가 멤버로 들어 있는 자관을 모아 보여 준다
  const relList = useMemo(() => rels.list.filter(r => canSee(r.visibility) && r.members.some(m => memberIds.has(m.charId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rels.list, memberIds, canSee]);

  if (!worlds.loaded) return <section className="page" />;
  if (!w) return <section className="page"><div className="page-head"><PageTitle href="/worlds">WORLDS</PageTitle><p>세계관을 찾을 수 없거나 볼 수 없어요</p></div></section>;

  const t = w.tabs[Math.min(tab, w.tabs.length - 1)];
  const lb: React.CSSProperties = { fontSize: 'calc(11px*var(--fs,1))', letterSpacing: '.14em', color: 'var(--faint)', margin: '28px 0 10px' };
  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href="/worlds">WORLDS</PageTitle>
        <div className="head-actions">
          {canEditWorld(w, user?.id, isAdmin) && <button className="btn btn-ghost" onClick={() => router.push(`/worlds/${w.id}/edit`)}>EDIT</button>}
          <button className="btn btn-ghost" onClick={() => router.push('/worlds')}>목록</button>
        </div>
      </div>
      <div className="panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {w.imgId && (
            <div style={{ width: 120, height: 120, flex: 'none', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
              <CroppedBlobImg fileRef={w.imgId} crop={w.crop} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'calc(30px*var(--fs,1))', color: 'var(--ink)', fontWeight: 500 }}>{w.name}</h2>
            {w.sub && <p style={{ margin: '6px 0 0', color: 'var(--faint)', fontSize: 'calc(13px*var(--fs,1))' }}>{w.sub}</p>}
            <TagList tags={w.tags} href="/worlds" style={{ marginTop: 10 }} />
          </div>
        </div>

        {w.tabs.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 22 }}>
            {w.tabs.map((x, i) => (
              <button key={x.id} className={`btn ${i === tab ? 'btn-dark' : 'btn-ghost'}`} style={{ fontSize: 12, padding: '4px 14px' }}
                onClick={() => setTab(i)}>{x.title || '제목 없음'}</button>
            ))}
          </div>
        )}
        {t && t.html.trim() && (
          <div className="prose" style={{ marginTop: 18, overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.html) }} />
        )}

        <div style={lb}>소속 캐릭터 · {members.length}</div>
        {members.length === 0 ? <p className="hint">아직 이 세계관에 속한 캐릭터가 없어요</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
            {members.map(c => (
              <div key={c.id} className="char-card" onClick={() => router.push(charPath(c))}>
                <div className="thumb"><CroppedBlobImg fileRef={c.arts?.[0] ?? c.thumbId} crop={c.thumbCrop} ph={c.thumbClass} /></div>
                <div className="nm" style={{ padding: '8px 10px' }}><b style={{ fontSize: 'calc(12.5px*var(--fs,1))' }}>{c.name}</b></div>
              </div>
            ))}
          </div>
        )}

        {relList.length > 0 && (
          <>
            <div style={lb}>자관 · {relList.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
              {relList.map(r => (
                <Link key={r.id} href={relPath(r)} style={{ color: 'var(--ink)', fontSize: 'calc(13px*var(--fs,1))', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  {r.name}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
