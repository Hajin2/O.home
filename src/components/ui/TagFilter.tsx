'use client';
// 자유 태그 필터 칩 줄 — 목록 위에 둔다. 여러 개를 고르면 방식(모두 포함 / 하나라도)을 고를 수 있고,
// 태그마다 정해 둔 색을 쓴다.
// 접기 (포크 개선): 기본은 **한 줄만** 보이고, 넘치면 오른쪽 끝의 「펼치기 ▾」로 전부 / 「접기 ▴」로 다시 한 줄.
//   접힌 상태에서도 고른 태그는 앞쪽으로 당겨 늘 보이게. 펼침 여부는 보는 사람 브라우저에 기억(모든 목록 공통).
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { TagMode } from '@/lib/tagUtil';
import { useTagColors, tagChip } from '@/lib/tagColors';

const OPEN_KEY = 'ohome.tagrow.open';
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } };

export function TagFilter({ counts, selected, onToggle, onClear, mode, onToggleMode, showLink = true }: {
  counts: [string, number][];
  selected: string[];
  onToggle: (t: string) => void;
  onClear: () => void;
  mode?: TagMode;
  onToggleMode?: () => void;
  showLink?: boolean;   // 「태그 모아보기」 링크 — 모아보기 화면 자신에서는 끈다
}) {
  const [colors] = useTagColors();
  const [open, setOpenState] = useState(false);
  const [more, setMore] = useState(false);      // 한 줄을 넘치는가 (접기 버튼을 보일지)
  const [rowH, setRowH] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // 펼침 여부는 처음 그린 뒤에 읽는다 (서버 렌더와 어긋나지 않게)
  useLayoutEffect(() => { setOpenState(readOpen()); }, []);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* 무시 */ }
  };

  // 한 줄 높이를 재고, 넘치는지 확인 — 창 크기가 바뀌어도 다시
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const first = box.firstElementChild as HTMLElement | null;
      if (!first) { setMore(false); return; }
      const h = first.offsetHeight + 4;   // 위아래 여유 (올렸을 때 살짝 뜨는 효과가 잘리지 않게)
      setRowH(h);
      // 첫 칩과 다른 줄(위치가 더 아래)에 놓인 칩이 있으면 넘친다
      const top = first.offsetTop;
      setMore(Array.from(box.children).some(c => (c as HTMLElement).offsetTop > top + 2));
    };
    measure();
    let ro: ResizeObserver | null = null;
    try { ro = new ResizeObserver(measure); ro.observe(box); } catch { /* 무시 */ }
    return () => { ro?.disconnect(); };
  }, [counts, selected, open]);

  if (counts.length === 0) return null;

  // 고른 태그는 앞으로 — 접혀 있어도 보이게
  const ordered = open ? counts : [
    ...counts.filter(([t]) => selected.includes(t)),
    ...counts.filter(([t]) => !selected.includes(t)),
  ];
  const collapsed = !open && more;

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', margin: '0 0 14px' }}>
      <div ref={boxRef} className="tag-row"
        style={{
          flex: 1, minWidth: 0, paddingTop: 2,
          ...(!open && rowH ? { maxHeight: rowH, overflow: 'hidden' } : null),
        }}>
        {selected.length > 0 && <div className="tag" onClick={onClear}>선택 해제 ✕</div>}
        {selected.length > 1 && onToggleMode && (
          <div className="tag" onClick={onToggleMode} data-tip="누르면 전환">
            {mode === 'or' ? '하나라도 포함' : '모두 포함'} ⇄
          </div>
        )}
        {ordered.map(([t, n]) => {
          const on = selected.includes(t);
          return (
            <div key={t} className={`tag ${on ? 'on' : ''}`} style={tagChip(colors, t, on)} onClick={() => onToggle(t)}>
              #{t} <small>{n}</small>
            </div>
          );
        })}
        {/* 펼쳤을 때는 맨 끝에 접기 · 모아보기 */}
        {open && more && <div className="tag" onClick={() => setOpen(false)}>접기 ▴</div>}
        {open && showLink && <Link href="/tags" className="tag" style={{ textDecoration: 'none' }}>태그 모아보기 →</Link>}
      </div>
      {/* 접혀 있을 때는 오른쪽 끝에 고정 — 줄이 넘쳐도 늘 보이게 */}
      {!open && (
        <div className="tag-row" style={{ flexWrap: 'nowrap', flexShrink: 0, paddingTop: 2 }}>
          {collapsed && <div className="tag" onClick={() => setOpen(true)} data-tip={`태그 ${counts.length}개 전부 보기`}>펼치기 ▾</div>}
          {showLink && <Link href="/tags" className="tag" style={{ textDecoration: 'none' }}>태그 모아보기 →</Link>}
        </div>
      )}
    </div>
  );
}
