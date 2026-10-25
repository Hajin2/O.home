'use client';
// 자관 페이지의 「IF 썰」 칸 (포크) — IF 페이지에서 이 자관 묶음으로 달았지만 자관 문답에 들어가지 못한 반응
// (그 자관에 질문을 추가할 권한이 없던 사람이 단 것). 자관 문답에 저장된 답변은 원래 문답 탭에 보이므로 여기엔 없다.
// 하나도 없으면 칸 자체를 그리지 않는다.
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalList } from '@/lib/postStore';
import type { Character, Relation } from '@/lib/charStore';
import { IfPost, IfReaction, IF_KEY, IF_REACT_KEY } from '@/lib/ifStore';
import { ReactLine, FAINT, LINE } from './IfParts';

export function RelIfPanel({ rel, chars }: { rel: Relation; chars: Character[] }) {
  const router = useRouter();
  const [posts] = useLocalList<IfPost>(IF_KEY, []);
  const [reacts] = useLocalList<IfReaction>(IF_REACT_KEY, []);
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => {
    const mine = reacts.filter(r => r.relId === rel.id);
    return posts
      .map(p => ({ p, rs: mine.filter(r => r.ifId === p.id).sort((a, b) => a.order - b.order || a.date.localeCompare(b.date)) }))
      .filter(g => g.rs.length)
      .sort((a, b) => b.p.date.localeCompare(a.p.date));
  }, [posts, reacts, rel.id]);
  if (!groups.length) return null;
  return (
    <div className="panel widget" style={{ marginTop: 16, maxWidth: 1010, marginLeft: 'auto', marginRight: 'auto' }}>
      <h4>IF 썰 <span className="more" onClick={() => router.push('/ifs')}>더보기 ›</span></h4>
      {groups.map(({ p, rs }) => (
        <div key={p.id} style={{ borderTop: `1px solid ${LINE}` }}>
          <div onClick={() => setOpen(open === p.id ? null : p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 2px', cursor: 'pointer' }}>
            <span style={{ fontSize: 10, color: FAINT, transform: open === p.id ? 'rotate(90deg)' : 'none', transition: '.15s' }}>▶</span>
            <b style={{ fontSize: 13.5, flex: 1, minWidth: 0 }}>《{p.title}》</b>
            <span style={{ fontSize: 11, color: FAINT }}>반응 {rs.length}</span>
          </div>
          {open === p.id && (
            <div style={{ padding: '0 2px 8px' }}>
              {rs.map(r => {
                const ch = r.charId ? chars.find(c => c.id === r.charId) : undefined;
                return <ReactLine key={r.id} name={r.name} text={r.text} ch={ch} />;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
