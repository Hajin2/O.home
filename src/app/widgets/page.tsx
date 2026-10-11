'use client';
// 위젯 공유 목록 (포크 기능) — 「전체 · 케이브덕 · 티팟 · 기타」 탭 + 태그 + 검색, 카드 2열(좁은 화면 1열)
// 카드 썸네일: 올린 이미지 → 없으면 케이브덕·기타는 작동 예시를 작게(조작 불가), 티팟은 컴포넌트 이름
// (티팟 미리보기는 상자마다 Babel을 띄워 무거워서 목록에서는 그리지 않는다)
// 관리자는 ORDER로 끌어다 놓아 순서 변경 (놓을 때 한 번만 저장).
import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useVisibleWidgets, widgetPath, PLATFORMS, PLATFORM_LABEL, PLATFORM_TINT, isLive, type Widget, type WidgetPlatform } from '@/lib/widgetStore';
import { SearchBar } from '@/components/ui/Kit';
import { TagFilter } from '@/components/ui/TagFilter';
import { TagList } from '@/components/ui/TagList';
import { tagCounts, matchTags, tagMatches, useTagFilter } from '@/lib/tagUtil';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { useToast } from '@/components/ui/Toast';
import { mergeInPlace } from '@/components/chars/WorldTabs';
import { WidgetPreview, teapotName } from '@/components/widgets/WidgetPreview';

function Thumb({ w }: { w: Widget }) {
  if (w.imgId) return <CroppedBlobImg fileRef={w.imgId} crop={w.crop} />;
  if (isLive(w) && w.platform !== 'teapot') {
    // 작동 예시를 작게 — 클릭은 카드로 (상자 안 조작 막음)
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ transform: 'scale(.62)', transformOrigin: 'top center', width: '161%', marginLeft: '-30.5%' }}>
          <WidgetPreview widget={{ ...w, previewHeight: undefined }} minHeight={260} />
        </div>
      </div>
    );
  }
  const name = isLive(w) && w.platform === 'teapot' ? (w.displayName || teapotName(w)) : '';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: PLATFORM_TINT[w.platform] }}>
      {name
        ? <code style={{ fontSize: 13, color: '#2d3436', opacity: .8 }}>{`<${teapotName(w) || name} />`}</code>
        : <span style={{ fontSize: 15, fontWeight: 700, color: '#2d3436', opacity: .75, padding: '0 16px', textAlign: 'center', wordBreak: 'keep-all' }}>{w.title}</span>}
    </div>
  );
}

export default function WidgetsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const widgets = useVisibleWidgets();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<WidgetPlatform | ''>('');
  const [tagSel, toggleTag, clearTags, tagMode, toggleMode] = useTagFilter();

  const inTab = useMemo(() => widgets.visible.filter(w => !tab || w.platform === tab), [widgets.visible, tab]);
  const shown = inTab
    .filter(w => matchTags(w, tagSel, tagMode))
    .filter(w => !q || w.title.toLowerCase().includes(q.toLowerCase()) || (w.sub ?? '').toLowerCase().includes(q.toLowerCase()) || tagMatches(w, q));
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    widgets.visible.forEach(w => { m[w.platform] = (m[w.platform] ?? 0) + 1; });
    return m;
  }, [widgets.visible]);

  /* 순서 바꾸기 — 세계관 목록과 같은 방식 (ORDER 켜고 끌어다 놓기, 놓을 때 한 번 저장).
     탭으로 걸러 본 상태에서도 다른 위젯 사이의 자리는 그대로 (mergeInPlace) */
  const [sortMode, setSortMode] = useState(false);
  const filtering = !!q || tagSel.length > 0;
  const sortOn = isAdmin && sortMode && !filtering;
  const [preview, setPreview] = useState<Widget[] | null>(null);
  const previewRef = useRef<Widget[] | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const setPv = (v: Widget[] | null) => { previewRef.current = v; setPreview(v); };
  const list = preview ?? shown;
  const finishDrag = async () => {
    const p = previewRef.current;
    dragIdx.current = null; setDragging(null);
    if (!p) return;
    if (!p.some((w, i) => w.id !== shown[i]?.id)) { setPv(null); return; }
    try { await widgets.save(mergeInPlace(widgets.list, p)); }
    catch (e) { toast(`순서를 저장하지 못했습니다 — ${e instanceof Error ? e.message : '다시 시도해 주세요'}`); }
    setPv(null);
  };
  const dragProps = (i: number): React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean } => !sortOn ? {} : {
    draggable: true,
    onDragStart: e => { dragIdx.current = i; setDragging(i); setPv(shown); try { e.dataTransfer.setData('text/plain', ''); } catch { /* 무시 */ } e.dataTransfer.effectAllowed = 'move'; },
    onDragOver: e => {
      e.preventDefault();
      const from = dragIdx.current;
      if (from == null || from === i || !previewRef.current) return;
      const n = [...previewRef.current]; const [m] = n.splice(from, 1); n.splice(i, 0, m);
      dragIdx.current = i; setDragging(i); setPv(n);
    },
    onDrop: e => e.preventDefault(),
    onDragEnd: () => { void finishDrag(); },
  };

  const tabBtn = (v: WidgetPlatform | '', label: string, n: number) => (
    <button key={v || 'all'} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''}
      onClick={() => { if (tab !== v) clearTags(); setTab(v); }}>{label}<small>{n}</small></button>
  );

  return (
    <section className="page">
      <style>{`
        .wtabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin-bottom:14px;overflow-x:auto;scrollbar-width:none}
        .wtabs::-webkit-scrollbar{display:none}
        .wtabs>button{flex-shrink:0;white-space:nowrap;font-family:var(--serif);letter-spacing:.14em;font-size:calc(14px*var(--fs,1));
          color:var(--page-desc,var(--faint));padding:6px 14px 11px;border-bottom:2px solid transparent;margin-bottom:-1px;transition:.15s;opacity:.85}
        .wtabs>button:hover{opacity:1;color:var(--page-title,var(--ink))}
        .wtabs>button.on{opacity:1;color:var(--page-title,var(--ink));border-bottom-color:var(--page-title,var(--ink))}
        .wtabs>button small{font-family:var(--sans,inherit);letter-spacing:0;font-size:11px;margin-left:6px;opacity:.7}
        .wg-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;cursor:var(--cur-pointer,pointer);transition:.2s;box-shadow:var(--sh-sm);min-width:0}
        .wg-card:hover{transform:translateY(-4px)}
        .wg-card .th{aspect-ratio:16/9;position:relative;overflow:hidden;background:#eef0f3}
        .wg-card .bd{padding:12px 16px 14px}
      `}</style>
      <div className="page-head">
        <PageTitle>WIDGETS</PageTitle>
        <EditableDesc k="widgets-desc" def="AI 채팅 플랫폼에서 만든 위젯 — 작동 예시를 보고, 공유 링크로 가져가세요" />
        <div className="head-actions">
          <SearchBar onSearch={setQ} />
          {isAdmin && (
            <>
              {widgets.visible.length > 1 && (
                <button className={`btn ${sortMode ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setSortMode(v => !v)}>{sortMode ? 'DONE' : 'ORDER'}</button>
              )}
              <button className="btn btn-dark" onClick={() => router.push('/widgets/new')}>＋ ADD WIDGET</button>
            </>
          )}
        </div>
      </div>
      {isAdmin && sortMode && (
        <p className="hint" style={{ margin: '0 0 10px' }}>
          {filtering ? '검색·태그 선택을 풀어야 순서를 바꿀 수 있어요' : '카드를 끌어다 놓으면 순서가 바뀌어요 — 다 바꿨으면 DONE'}
        </p>
      )}
      {widgets.visible.length > 0 && (
        <div className="wtabs" role="tablist" aria-label="플랫폼">
          {tabBtn('', '전체', widgets.visible.length)}
          {PLATFORMS.filter(p => counts[p]).map(p => tabBtn(p, PLATFORM_LABEL[p], counts[p]))}
        </div>
      )}
      <TagFilter counts={tagCounts(inTab)} selected={tagSel} onToggle={toggleTag} onClear={clearTags} mode={tagMode} onToggleMode={toggleMode} />
      {widgets.loaded && list.length === 0 && <p className="hint" style={{ padding: '24px 4px' }}>{widgets.visible.length ? '조건에 맞는 위젯이 없어요' : '아직 등록된 위젯이 없어요'}</p>}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
        {list.map((w, i) => (
          <div key={w.id} className="wg-card" role="link" tabIndex={0} {...dragProps(i)}
            onClick={() => { if (!sortOn) router.push(widgetPath(w)); }}
            onKeyDown={e => { if (e.key === 'Enter' && !sortOn) router.push(widgetPath(w)); }}
            style={{
              opacity: dragging === i ? .35 : w.visibility === 'private' ? .55 : 1,
              ...(sortOn ? { cursor: 'var(--cur-grab,grab)', outline: dragging === i ? '2px solid var(--accent)' : '1.5px dashed rgba(201,106,115,.55)', outlineOffset: 3 } : null),
            }}>
            <div className="th"><Thumb w={w} /></div>
            <div className="bd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span className="pill" style={{ background: PLATFORM_TINT[w.platform], border: 0, color: '#2d3436' }}>{PLATFORM_LABEL[w.platform]}</span>
                {w.visibility !== 'public' && <span className="pill">{w.visibility === 'member' ? '멤버' : '비공개'}</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 'calc(15px*var(--fs,1))', color: 'var(--ink)', wordBreak: 'keep-all' }}>{w.title}</div>
              {w.sub && <div style={{ fontSize: 'calc(12px*var(--fs,1))', color: 'var(--faint)', marginTop: 3 }}>{w.sub}</div>}
              {w.tags && w.tags.length > 0 && <TagList tags={w.tags} max={4} onPick={toggleTag} style={{ marginTop: 6, fontSize: 11 }} />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
