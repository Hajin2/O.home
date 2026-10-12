'use client';
// 세계관 편집 회원 지정 (세계관 편집 권한) — 관리자가 회원을 검색해 추가하면 그 회원은 이 세계관의
// 이름·소개·커버·문서 탭·태그를 고칠 수 있다. 공개범위·편집 회원·추가·삭제·정렬은 계속 관리자만.
// 캐릭터용 GrantsEditor를 고치지 않고 새 파일로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CharGrant } from '@/lib/charStore';
import { useMembers } from '@/lib/members';
import { KInput } from '@/components/ui/Kit';
import { useConfirmDelete } from '@/components/ui/Modal';

const POP_H = 192;

export function WorldEditorsEditor({ value, onChange }: {
  value: CharGrant[];
  onChange: (next: CharGrant[]) => void;
}) {
  const pool = useMembers().filter(p => p.id !== 'admin'); // 관리자는 항상 전권
  const del = useConfirmDelete();
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const openAt = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = window.innerHeight - r.bottom < POP_H + 10;
    setPos({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  };
  const open = pos !== null;
  const setOpen = (v: boolean) => (v ? openAt() : setPos(null));
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  const granted = value
    .map(g => ({ ...g, member: pool.find(p => p.id === g.userId) }))
    .filter(g => g.member);
  const needle = q.trim().toLowerCase();
  const matches = pool.filter(p =>
    !value.some(g => g.userId === p.id)
    && (p.nickname.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle)));

  const add = (userId: string) => onChange([...value.filter(g => g.userId !== userId), { userId, level: 'edit' }]);
  const remove = (userId: string) => onChange(value.filter(g => g.userId !== userId));

  return (
    <div style={{ display: 'grid', gap: 9 }}>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <KInput placeholder="닉네임·아이디 검색" value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {open && matches.length > 0 && typeof document !== 'undefined' && createPortal(
          <div style={{
            position: 'fixed', left: pos!.left, width: pos!.width, zIndex: 120,
            ...(pos!.bottom !== undefined ? { bottom: pos!.bottom } : { top: pos!.top }),
            background: 'var(--panel-solid)', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: 'var(--sh-dd)', padding: 4, maxHeight: 180, overflow: 'auto',
          }}>
            {matches.map(p => (
              <button key={p.id} type="button"
                style={{
                  display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                  padding: '7px 10px', borderRadius: 7, fontSize: 12.5, color: 'var(--ink)',
                }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { add(p.id); setQ(''); setOpen(false); }}>
                <span>{p.nickname}</span>
                <small style={{ color: 'var(--faint)' }}>{p.id}</small>
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>

      {granted.map(g => (
        <div key={g.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5 }}>
            {g.member!.nickname} <small style={{ color: 'var(--faint)' }}>{g.userId}</small>
          </span>
          <span className="fx" style={{ cursor: 'var(--cur-pointer,pointer)' }} data-tip="권한 해제"
            onClick={() => del.ask(`「${g.member!.nickname}」의 편집 권한을 해제하시겠습니까?`,
              () => remove(g.userId),
              '저장하면 이 회원은 더 이상 이 세계관을 편집할 수 없습니다.')}>✕</span>
        </div>
      ))}
      {granted.length === 0 && (
        <p className="hint" style={{ margin: 0 }}>편집 권한을 준 회원이 없습니다 — 위에서 검색해 추가</p>
      )}
      {del.element}
    </div>
  );
}
