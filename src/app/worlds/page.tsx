'use client';
// 세계관 목록 — 행 카드 (정사각 커버 · 이탤릭 제목 · 한 줄 소개 | 캐릭터 N명 · 오른쪽 라벨)
// PC는 2열(화면이 넓으면 카드가 너무 길어져서), 좁은 화면은 1열. 관리자는 ORDER 버튼을 켜고 끌어다 놓아 순서 변경.
import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useRawList } from '@/lib/rawList';
import { Character, CHAR_SEED } from '@/lib/charStore';
import { useVisibleWorlds, countByWorld, worldPath, type World } from '@/lib/worldStore';
import { newId } from '@/lib/postStore';
import { SearchBar } from '@/components/ui/Kit';
import { TagFilter } from '@/components/ui/TagFilter';
import { TagList } from '@/components/ui/TagList';
import { tagCounts, matchTags, tagMatches, useTagFilter } from '@/lib/tagUtil';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { mergeOrder } from '@/lib/cardSort';

export default function WorldsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const del = useConfirmDelete();
  const worlds = useVisibleWorlds();
  const chars = useRawList<Character>('ohome.chars.v1', CHAR_SEED);
  const [q, setQ] = useState('');
  // JSON 가져오기 — 세계관 문서를 파일로 한꺼번에 등록 (관리자). 공개범위는 파일에 적힌 대로(기본 나만보기)
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const arr = JSON.parse(await file.text());
      if (!Array.isArray(arr)) throw new Error('목록이 아님');
      const today = new Date().toISOString().slice(0, 10);
      const made: World[] = arr.filter(x => x && typeof x.name === 'string').map((x, i) => ({
        id: newId() + i,
        name: x.name, sub: x.sub || undefined, label: x.label || undefined,
        tags: Array.isArray(x.tags) ? x.tags : [],
        visibility: x.visibility === 'public' || x.visibility === 'member' ? x.visibility : 'private',
        tabs: (Array.isArray(x.tabs) ? x.tabs : []).map((t: { title?: string; html?: string }, j: number) => ({ id: newId() + j, title: t.title ?? '', html: t.html ?? '' })),
        date: today,
      }));
      if (made.length === 0) throw new Error('가져올 세계관이 없음');
      await worlds.save([...worlds.list, ...made]);
      toast(`세계관 ${made.length}개를 가져왔습니다 — 공개범위는 각 수정 화면에서 바꿀 수 있어요`);
    } catch (e) {
      toast(`가져오지 못했습니다 — ${e instanceof Error ? e.message : '파일을 확인해 주세요'}`);
    }
  };
  const [tagSel, toggleTag, clearTags, tagMode, toggleMode] = useTagFilter();
  const counts = useMemo(() => countByWorld(chars.list, isAdmin), [chars.list, isAdmin]);

  const shown = worlds.visible
    .filter(w => matchTags(w, tagSel, tagMode))
    .filter(w => !q || w.name.toLowerCase().includes(q.toLowerCase()) || (w.sub ?? '').toLowerCase().includes(q.toLowerCase()) || tagMatches(w, q));

  /* 순서 바꾸기 — 관리자가 ORDER를 켜고 카드를 끌어다 놓는다.
     상단바 편집모드는 원작 목록(mainStore의 EDIT_PAGES)에 있는 페이지에서만 켜져서, 원작 파일을
     고치지 않으려고 이 페이지 안에 따로 스위치를 뒀다.
     끄는 동안은 화면에서만 자리를 바꿔 보여 주고(미리보기), 손을 놓을 때 한 번만 저장한다
     (지나는 자리마다 저장하면 서버 모드에서 뚝뚝 끊기고 요청도 많아진다). */
  const [sortMode, setSortMode] = useState(false);
  // 검색·태그로 일부만 보이는 중에는 끌기를 막는다 — 보이는 것끼리만 바뀌어 전체 순서가 헷갈리지 않게
  const filtering = !!q || tagSel.length > 0;
  const sortOn = isAdmin && sortMode && !filtering;
  const [preview, setPreview] = useState<World[] | null>(null);
  const previewRef = useRef<World[] | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const setPv = (v: World[] | null) => { previewRef.current = v; setPreview(v); };
  const list = preview ?? shown;
  const finishDrag = async () => {
    const p = previewRef.current;
    dragIdx.current = null; setDragging(null);
    if (!p) return;
    const changed = p.some((w, i) => w.id !== shown[i]?.id);
    if (!changed) { setPv(null); return; }
    try { await worlds.save(mergeOrder(worlds.list, p)); }
    catch (e) { toast(`순서를 저장하지 못했습니다 — ${e instanceof Error ? e.message : '다시 시도해 주세요'}`); }
    setPv(null);
  };
  const dragProps = (i: number): React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean } => !sortOn ? {} : {
    draggable: true,
    onDragStart: e => {
      dragIdx.current = i; setDragging(i); setPv(shown);
      try { e.dataTransfer.setData('text/plain', ''); } catch { /* 무시 */ }
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: e => {
      e.preventDefault();
      const from = dragIdx.current;
      if (from == null || from === i || !previewRef.current) return;
      const n = [...previewRef.current];
      const [m] = n.splice(from, 1);
      n.splice(i, 0, m);
      dragIdx.current = i; setDragging(i); setPv(n);
    },
    onDrop: e => e.preventDefault(),
    onDragEnd: () => { void finishDrag(); },
  };

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>WORLDS</PageTitle>
        <EditableDesc k="worlds-desc" def="세계관 목록 — 캐릭터가 속한 세계" />
        <div className="head-actions">
          <SearchBar onSearch={setQ} />
          {isAdmin && (
            <>
              <input id="world-import-in" type="file" accept="application/json,.json" hidden
                onChange={e => { importJson(e.target.files?.[0]); e.target.value = ''; }} />
              {worlds.visible.length > 1 && (
                <button className={`btn ${sortMode ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setSortMode(v => !v)}
                  data-tip={sortMode ? '순서 바꾸기 끝내기' : '끌어다 놓아 순서 바꾸기'}>{sortMode ? 'DONE' : 'ORDER'}</button>
              )}
              <button className="btn btn-ghost" onClick={() => document.getElementById('world-import-in')?.click()}>IMPORT</button>
              <button className="btn btn-ghost" onClick={() => router.push('/templates')} data-tip="캐릭터 양식 관리">TEMPLATES</button>
              <button className="btn btn-dark" onClick={() => router.push('/worlds/new')}>＋ ADD WORLD</button>
            </>
          )}
        </div>
      </div>
      {isAdmin && sortMode && (
        <p className="hint" style={{ margin: '0 0 10px' }}>
          {filtering ? '검색·태그 선택을 풀어야 순서를 바꿀 수 있어요' : '카드를 끌어다 놓으면 순서가 바뀌어요 — 다 바꿨으면 DONE'}
        </p>
      )}
      <TagFilter counts={tagCounts(worlds.visible)} selected={tagSel} onToggle={toggleTag} onClear={clearTags} mode={tagMode} onToggleMode={toggleMode} />
      {worlds.loaded && list.length === 0 && <p className="hint" style={{ padding: '24px 4px' }}>{worlds.visible.length ? '조건에 맞는 세계관이 없어요' : '아직 등록된 세계관이 없어요'}</p>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))' }}>
        {list.map((w, i) => (
          <div key={w.id} role="link" tabIndex={0}
            {...dragProps(i)}
            onClick={() => { if (!sortOn) router.push(worldPath(w)); }}
            onKeyDown={e => { if (e.key === 'Enter' && !sortOn) router.push(worldPath(w)); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 18, padding: 14, background: 'var(--panel)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius)', cursor: sortOn ? 'var(--cur-grab,grab)' : 'var(--cur-pointer,pointer)',
              opacity: dragging === i ? .35 : w.visibility === 'private' ? .55 : 1, minWidth: 0,
              ...(sortOn ? {
                outline: dragging === i ? '2px solid var(--accent)' : '1.5px dashed rgba(201,106,115,.55)', outlineOffset: 3,
              } : null),
            }}>
            <div style={{ width: 92, height: 92, flex: 'none', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
              <CroppedBlobImg fileRef={w.imgId} crop={w.crop} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'calc(22px*var(--fs,1))', color: 'var(--ink)', lineHeight: 1.25, wordBreak: 'keep-all' }}>
                {w.name}
                {w.visibility !== 'public' && <span className="pill" style={{ marginLeft: 8, fontStyle: 'normal' }}>{w.visibility === 'member' ? '멤버' : '비공개'}</span>}
              </div>
              <div style={{ marginTop: 5, fontSize: 'calc(12.5px*var(--fs,1))', color: 'var(--faint)' }}>
                {w.sub ? `${w.sub} | ` : ''}캐릭터 {counts[w.id] ?? 0}명
              </div>
              {w.tags && w.tags.length > 0 && <TagList tags={w.tags} max={4} onPick={toggleTag} style={{ marginTop: 6, fontSize: 11 }} />}
            </div>
            <div style={{ flex: 'none', textAlign: 'right', display: 'grid', gap: 6, justifyItems: 'end' }}>
              <span style={{ fontSize: 'calc(11px*var(--fs,1))', letterSpacing: '.14em', color: 'var(--accent)' }}>{w.label || 'VIEW'} ›</span>
              {isAdmin && (
                <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => router.push(`/worlds/${w.id}/edit`)}>EDIT</button>
                  <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => del.ask(`「${w.name}」 세계관을 삭제할까요?`, async () => {
                      await worlds.save(worlds.list.filter(x => x.id !== w.id));
                      toast('삭제되었습니다');
                    }, '삭제하면 복구할 수 없습니다. 소속 캐릭터는 그대로 남고 세계관만 미지정이 됩니다.')}>DELETE</button>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {del.element}
    </section>
  );
}
