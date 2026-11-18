'use client';
// 감상타래 별점 (포크, 사용자 요청) — 0.5 단위 5점 만점
import React from 'react';

/** 별점 표시 — 회색 별 다섯 위에 점수만큼 채운 별을 겹친다 */
export function Stars({ value, size = 14, showNum = true }: { value?: number; size?: number; showNum?: boolean }) {
  if (!value) return null;
  return (
    <span className="thr-stars" style={{ fontSize: size }} aria-label={`별점 ${value}점`}>
      <span className="bg">★★★★★<span className="fill" style={{ width: `${(value / 5) * 100}%` }}>★★★★★</span></span>
      {showNum && <b>{value.toFixed(1)}</b>}
    </span>
  );
}

/** 별점 고르기 — 별 하나를 왼쪽/오른쪽 반으로 나눠 0.5 단위로. 같은 점수를 다시 누르면 지운다 */
export function StarPicker({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <span className="thr-stars pick" style={{ fontSize: 24 }} onMouseLeave={() => setHover(null)}>
      <span className="bg">
        ★★★★★<span className="fill" style={{ width: `${(shown / 5) * 100}%` }}>★★★★★</span>
        <span className="hit">
          {Array.from({ length: 10 }, (_, i) => (i + 1) / 2).map(v => (
            <button key={v} type="button" aria-label={`${v}점`}
              onMouseEnter={() => setHover(v)}
              onClick={() => onChange(value === v ? undefined : v)} />
          ))}
        </span>
      </span>
      <b>{shown ? shown.toFixed(1) : '—'}</b>
    </span>
  );
}
