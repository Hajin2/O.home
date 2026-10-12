'use client';
// 캐릭터 편집의 「추가 탭」 목록 (포크) — 왼쪽 손잡이(⋮⋮)를 잡고 끌어 순서 바꾸기 (마우스·터치 모두).
// 양식 탭은 「양식 · 양식 이름」으로 표시한다.
// 새 파일로 따로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게 — 원작 CharEditForm에서는 이 컴포넌트 한 줄만 부른다.
import React, { useRef, useState } from 'react';
import type { CharTab } from '@/lib/charStore';
import { useTemplates } from '@/lib/tplStore';

export function TabRows({ tabs, onReorder, onEdit, onDelete }: {
  tabs: CharTab[];
  onReorder: (next: CharTab[]) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const templates = useTemplates();
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; order: CharTab[]; dy: number; y0: number } | null>(null);
  const shown = drag?.order ?? tabs;
  const tplName = (t: CharTab) => templates.list.find(x => x.id === t.tpl?.id)?.name;

  const start = (e: React.PointerEvent, id: string) => {
    if (tabs.length < 2) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, order: tabs, dy: 0, y0: e.clientY });
  };
  const moveTo = (e: React.PointerEvent) => {
    if (!drag || !boxRef.current) return;
    const rows = Array.from(boxRef.current.querySelectorAll<HTMLElement>('[data-tab-row]'));
    // 끌고 있는 줄을 뺀 나머지 줄 중, 가운데가 손가락보다 위에 있는 줄 수 = 새 자리
    let idx = 0;
    rows.forEach(r => {
      if (r.dataset.tabRow === drag.id) return;
      const b = r.getBoundingClientRect();
      if (b.top + b.height / 2 < e.clientY) idx++;
    });
    const cur = drag.order.find(t => t.id === drag.id)!;
    const rest = drag.order.filter(t => t.id !== drag.id);
    const order = [...rest.slice(0, idx), cur, ...rest.slice(idx)];
    // 줄이 자리를 옮기면 기준 위치도 옮겨 손가락 아래에 붙어 있게
    const oldIdx = drag.order.findIndex(t => t.id === drag.id);
    let y0 = drag.y0;
    if (idx !== oldIdx) {
      const me = rows.find(r => r.dataset.tabRow === drag.id);
      const h = (me?.offsetHeight ?? 46) + 8;
      y0 += (idx - oldIdx) * h;
    }
    setDrag({ ...drag, order, y0, dy: e.clientY - y0 });
  };
  const end = () => {
    if (!drag) return;
    const changed = drag.order.some((t, i) => t.id !== tabs[i]?.id);
    if (changed) onReorder(drag.order);
    setDrag(null);
  };

  return (
    <div ref={boxRef} style={{ display: 'grid', gap: 8, minWidth: 0, ...(drag ? { userSelect: 'none', WebkitUserSelect: 'none' } : null) }}>
      <style>{`
        .tab-row{display:flex;gap:8px;align-items:center;border:1.5px solid var(--line);border-radius:8px;padding:8px 10px 8px 4px;background:var(--panel-solid,#fff)}
        .tab-row.dragging{position:relative;z-index:3;box-shadow:var(--sh-md);border-color:var(--ink-3,var(--faint))}
        .tab-grip{width:22px;height:30px;flex-shrink:0;display:grid;place-items:center;color:var(--faint);cursor:grab;touch-action:none;border-radius:6px;opacity:.65}
        .tab-grip:hover{opacity:1;background:rgba(127,127,127,.12)}
        .tab-grip.off{visibility:hidden}
        .tab-row.dragging .tab-grip{cursor:grabbing;opacity:1}
        .tab-row .meta{color:var(--faint);font-size:10.5px;flex:0 1 auto;min-width:24px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tab-row b{flex:0 1 auto}
        .tab-row{min-width:0}
        @media (max-width:520px){.tab-row .meta .nm{display:none}}
      `}</style>
      {shown.map(t => {
        const on = drag?.id === t.id;
        const name = t.tpl ? tplName(t) : undefined;
        return (
          <div key={t.id} data-tab-row={t.id} className={`tab-row${on ? ' dragging' : ''}`}
            style={on ? { transform: `translateY(${drag!.dy}px)` } : undefined}>
            <span className={`tab-grip${tabs.length < 2 ? ' off' : ''}`} data-tip="끌어서 순서 바꾸기" aria-label="끌어서 순서 바꾸기"
              onPointerDown={e => start(e, t.id)} onPointerMove={moveTo} onPointerUp={end} onPointerCancel={end}>
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="3" r="1.4" /><circle cx="7.5" cy="3" r="1.4" /><circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" /><circle cx="2.5" cy="13" r="1.4" /><circle cx="7.5" cy="13" r="1.4" /></svg>
            </span>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: '#eef0f2', display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0 }}>{t.icon}</span>
            <b style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || '(제목 없음)'}</b>
            {t.subtitle && <small style={{ color: 'var(--faint)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subtitle}</small>}
            <small className="meta" title={name}>
              {t.tpl ? <>양식{name && <span className="nm"> · {name}</span>}</> : t.html ? `${t.html.length.toLocaleString()}자` : '비어 있음'}
            </small>
            <button className="btn btn-dark" style={{ marginLeft: 'auto', height: 27, padding: '0 12px', fontSize: 11, flexShrink: 0 }}
              onClick={() => onEdit(t.id)}>편집 ›</button>
            <span className="fx" onClick={() => onDelete(t.id)}>✕</span>
          </div>
        );
      })}
    </div>
  );
}
