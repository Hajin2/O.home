'use client';
// EditableDesc 주입
// 자관 리스트 (4.5) — 4:3 가로 썸네일 · 공개범위 3단계 · 멤버 색 점
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEditableWorlds, relEditorUids } from '@/lib/charAccess';
import { useLocalList } from '@/lib/postStore';
import { Relation, REL_SEED, Character, CHAR_SEED, relPath } from '@/lib/charStore';
import { SearchBar } from '@/components/ui/Kit';
import { TagFilter } from '@/components/ui/TagFilter';
import { TagList } from '@/components/ui/TagList';
import { tagCounts, matchTags, tagMatches, useTagFilter } from '@/lib/tagUtil';
import { useToast } from '@/components/ui/Toast';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { useMainStore } from '@/lib/mainStore';
import { useCardSort, mergeOrder } from '@/lib/cardSort';

export default function RelsPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { canAdd } = useEditableWorlds();   // 세계관 편집 회원도 자관 추가 (포크)
  const toast = useToast();
  const { editOn } = useMainStore();
  const [rels, setRels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [chars, , charsLoaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [q, setQ] = useState('');
  /* 관리자가 목록을 열면, 서버용 편집 회원 목록이 낡은 자관만 고쳐 저장한다 (포크) —
     이 기능 전에 만든 자관이나 캐릭터 권한이 바뀐 뒤에도, 멤버 캐릭터 주인이 자관을 저장할 수 있게 */
  useEffect(() => {
    if (!isAdmin || !charsLoaded || !rels.length) return;
    let changed = false;
    const next = rels.map(r => {
      const u = relEditorUids(r, chars);
      if (JSON.stringify(u) === JSON.stringify(r.editorUids ?? [])) return r;
      changed = true;
      return { ...r, editorUids: u };
    });
    if (changed) setRels(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, charsLoaded, rels.length, chars]);
  const [tagSel, toggleTag, clearTags, tagMode, toggleMode] = useTagFilter();   // 자유 태그 필터

  const colorOf = (id: string) => chars.find(c => c.id === id)?.color ?? '#666';
  const visible = rels
    .filter(r => isAdmin || r.visibility !== 'private' || (!!user && r.authorId === user.id))
    .filter(r => matchTags(r, tagSel, tagMode))
    .filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()) || tagMatches(r, q));

  // 편집모드 카드 드래그 정렬 (v1.9)
  const sort = useCardSort(visible, next => setRels(mergeOrder(rels, next)), editOn && isAdmin);

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>RELATIONS</PageTitle>
        <EditableDesc k="rels-desc" def="자관 목록 · 4:3 가로 썸네일 · 공개범위: 전체공개/멤버공개/나만보기" />
        <div className="head-actions">
          <SearchBar onSearch={setQ} />
          {canAdd && <button className="btn btn-dark" onClick={() => router.push('/rels/new')}>＋ ADD RELATION</button>}
        </div>
      </div>
      <TagFilter counts={tagCounts(rels.filter(r => isAdmin || r.visibility !== 'private' || (!!user && r.authorId === user.id)))}
        selected={tagSel} onToggle={toggleTag} onClear={clearTags} mode={tagMode} onToggleMode={toggleMode} />
      <div className="g3 rels-grid">
        {visible.map((r, i) => {
          const memberLocked = r.visibility === 'member' && !user;
          const priv = r.visibility === 'private';
          const sp = sort(i) as { style?: React.CSSProperties };
          return (
            <div key={r.id} className="rel-card" {...sort(i)}
              style={{ ...(priv ? { opacity: .45 } : undefined), ...sp.style }}
              onClick={() => {
                if (editOn) return;
                if (memberLocked) { toast('멤버공개 — 로그인 후 열람할 수 있습니다'); return; }
                router.push(relPath(r));
              }}>
              <div className="thumb" style={{ position: 'relative' }}>
                <CroppedBlobImg fileRef={r.thumbId} crop={r.thumbCrop} ph={r.thumbClass}
                  label={priv ? '나만보기' : memberLocked ? '멤버공개' : '4:3'} />
              </div>
              <div className="nm">
                {/* 리스트에서는 기본 폰트로 통일 — 개별 이름 폰트는 상세에서만 */}
                <b>
                  {r.name}
                  {r.visibility === 'member' && <span className="pill" style={{ marginLeft: 6 }}>멤버</span>}
                </b>
                <span>
                  {priv ? '관리자에게만 표시됨'
                    : memberLocked ? '로그인 시 열람 가능'
                    : `${r.catchphrase.replace(/ /g, '')} · ${r.members.length}인`}
                </span>
                {r.members.length > 0 && (
                  <div className="who">
                    {r.members.map(m => <i key={m.charId} style={{ background: colorOf(m.charId) }} />)}
                  </div>
                )}
                <TagList tags={r.tags} max={4} onPick={toggleTag} style={{ marginTop: 6, fontSize: 11 }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
