'use client';
// IF 썰 (포크) — IF 페이지와 자관 페이지가 같이 쓰는 조각: 얼굴 · 캐릭터 고르기 · 역극형 반응 한 줄
import React, { useMemo, useState } from 'react';
import type { Character } from '@/lib/charStore';
import { splitAction, nameColor } from '@/lib/ifStore';
import { KInput } from '@/components/ui/Kit';
import { CroppedBlobImg } from '@/components/ui/CropEditor';

export const FAINT = 'var(--faint, #8a8f99)';
export const LINE = 'var(--line, rgba(0,0,0,.12))';

export function Face({ ch, name, size = 38 }: { ch?: Character; name: string; size?: number }) {
  // position: relative 필수 — 사진(CropImg)은 자기를 감싼 칸에 꽉 차도록 absolute로 그려진다.
  // 이게 없으면 사진이 페이지 전체를 덮어 아무것도 못 누른다 (첫 배포 때 실제로 겪음)
  const box: React.CSSProperties = { position: 'relative', flex: 'none', width: size, height: size, borderRadius: '50%', overflow: 'hidden' };
  if (ch?.thumbId) return <div style={box}><CroppedBlobImg fileRef={ch.thumbId} crop={ch.thumbCrop} /></div>;
  const label = ch?.name || name;
  return (
    <div style={{ ...box, background: ch?.color || nameColor(label), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * .4 }}>
      {label.slice(0, 1)}
    </div>
  );
}

/** 캐릭터 고르기 — 역극처럼 등록된 캐릭터에서 직접 고른다. prefer(자관 멤버)는 맨 앞에 ★ */
export function CharPicker({ chars, value, onChange, prefer = [] }: {
  chars: Character[]; value: string; onChange: (id: string) => void; prefer?: string[];
}) {
  const [k, setK] = useState('');
  const list = useMemo(() => {
    const key = k.trim().toLowerCase();
    const hit = chars.filter(c => !key || c.name.toLowerCase().includes(key) || (c.sub ?? '').toLowerCase().includes(key));
    const rank = (c: Character) => (c.id === value ? 0 : prefer.includes(c.id) ? 1 : 2);
    return hit.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [chars, k, prefer, value]);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <KInput placeholder="캐릭터 이름 검색" value={k} onChange={e => setK(e.target.value)} />
      <div className="light-scroll" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 168, overflowY: 'auto', padding: 2 }}>
        {list.map(c => (
          <button key={c.id} type="button" onClick={() => onChange(c.id === value ? '' : c.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 3px', borderRadius: 999, fontSize: 12.5,
              border: c.id === value ? '2px solid var(--accent, #333)' : `1px solid ${LINE}`,
              background: c.id === value ? 'color-mix(in srgb, var(--accent, #333) 12%, transparent)' : 'transparent',
              fontWeight: c.id === value ? 800 : 500,
            }}>
            <Face ch={c} name={c.name} size={24} />{c.name}{prefer.includes(c.id) && <span style={{ fontSize: 10, color: FAINT }}>★</span>}
          </button>
        ))}
        {list.length === 0 && <span style={{ fontSize: 12, color: FAINT }}>찾는 캐릭터가 없어요</span>}
      </div>
    </div>
  );
}

/** 별명 → 캐릭터 추측 (붙여넣기용) — 이름이 같거나, 이름에 별명이 든 캐릭터가 하나뿐일 때. 자관 멤버를 먼저 본다 */
export function guessChar(nick: string, chars: Character[], prefer: string[]): string {
  const n = nick.trim();
  if (!n) return '';
  const exact = chars.filter(c => c.name.trim() === n);
  if (exact.length === 1) return exact[0].id;
  for (const pool of [chars.filter(c => prefer.includes(c.id)), chars]) {
    const part = pool.filter(c => c.name.includes(n));
    if (part.length === 1) return part[0].id;
  }
  return '';
}

/** 반응 한 줄 — 역극 말풍선. (괄호)는 지문. note: 이름 옆 작은 글씨(별명·출처) */
export function ReactLine({ name, text, ch, note, tools }: {
  name: string; text: string; ch?: Character; note?: React.ReactNode; tools?: React.ReactNode;
}) {
  const parts = splitAction(text);
  const accent = ch?.color || nameColor(ch?.name || name);
  return (
    <div className="if-line" style={{ display: 'flex', gap: 10, padding: '7px 0', alignItems: 'flex-start' }}>
      <Face ch={ch} name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <b style={{ fontSize: 13 }}>{ch ? ch.name : name}</b>
          {note && <span style={{ fontSize: 11, color: FAINT }}>{note}</span>}
          {tools && <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 11, color: FAINT }}>{tools}</span>}
        </div>
        {parts.length === 0 && <span style={{ color: FAINT, fontSize: 13 }}>…</span>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          {parts.map((p, i) => p.kind === 'act'
            ? <div key={i} style={{ fontSize: 12.5, fontStyle: 'italic', color: FAINT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.s}</div>
            : <div key={i} style={{
                maxWidth: '100%', padding: '7px 12px', borderRadius: '4px 14px 14px 14px', lineHeight: 1.6, fontSize: 13.5,
                background: `color-mix(in srgb, ${accent} 14%, var(--bg, #fff))`, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{p.s}</div>)}
        </div>
      </div>
    </div>
  );
}

/** 질문 글 비교용 — 괄호·따옴표·문장부호·띄어쓰기를 빼고 본다 (같은 질문을 자관마다 조금 다르게 적어도 묶이게) */
export const normQ = (s: string) => s.replace(/[《》「」『』"'“”‘’\s?!？！.,。…~]/g, '').toLowerCase();
