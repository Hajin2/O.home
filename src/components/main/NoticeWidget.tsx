'use client';
// 메인 위젯 「NOTICE」 (포크 기능) — 게시판 글을 메인에 공지란처럼 띄운다.
//   · 설정(편집모드 우클릭 > 설정): 어느 게시판 · 「공지·고른 태그 글만」 또는 「최근 글(공지 먼저)」 · 함께 띄울 태그(예: 업데이트) · 몇 개 · 위젯 제목
//   · 누르면 그 글로, 「전체 ›」는 그 게시판으로
//   · 메뉴에서 그 게시판을 비공개로 둔 사람에게는 위젯 자체가 안 보인다 · 비밀글은 볼 수 있는 사람(관리자·작성자)에게만
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게 (원작 파일에는 등록 몇 줄만).
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WidgetConf } from '@/lib/mainStore';
import { useMainStore } from '@/lib/mainStore';
import { useAuth } from '@/lib/auth';
import { useMenuSettings, canViewHref } from '@/lib/menuStore';
import { useBoards, boardHref, MAIN_BOARD_ID } from '@/lib/boardStore';
import { useLocalList, BOARD_SEED, type Post } from '@/lib/postStore';
import { Modal } from '@/components/ui/Modal';
import { KSelect, KStep, KInput } from '@/components/ui/Kit';

/** 태그 입력 — 쉼표로 구분. 입력 중에는 글자 그대로 두고, 칸을 벗어날 때 정리해서 저장한다 */
function TagsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => { setText(value.join(', ')); }, [value.join(',')]);   // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => onChange([...new Set(text.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean))]);
  return <KInput value={text} placeholder="업데이트" onChange={e => setText(e.target.value)} onBlur={commit}
    onKeyDown={e => { if (e.key === 'Enter') commit(); }} />;
}

/* 편집모드 우클릭 「설정」 → 이 위젯의 설정 창 (원작 위젯들과 같은 이벤트) */
function useEditEvent(id: string, onOpen: () => void) {
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail?.id === id) onOpen(); };
    window.addEventListener('ohome-widget-edit', h);
    return () => window.removeEventListener('ohome-widget-edit', h);
  }, [id, onOpen]);
}

const CSS = `
.ntc-row{display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px dashed var(--line);cursor:var(--cur-pointer,pointer);min-width:0}
.ntc-row:last-of-type{border-bottom:0}
.ntc-row:hover .t{text-decoration:underline;text-underline-offset:3px}
.ntc-row .pin{flex-shrink:0;font-size:10px;letter-spacing:.06em;padding:1px 7px;border-radius:999px;background:var(--accent,#a63a45);color:#fff;line-height:1.6}
.ntc-row .pin.tag{background:transparent;color:var(--accent,#a63a45);box-shadow:inset 0 0 0 1px var(--accent,#a63a45);max-width:7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ntc-row .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(12.5px*var(--fs,1))}
.ntc-row small{flex-shrink:0;color:var(--faint);font-size:calc(10.5px*var(--fs,1));font-variant-numeric:tabular-nums}
`;

export function NoticeWidget({ conf }: { conf: WidgetConf }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const [menuSet] = useMenuSettings();
  const { boards } = useBoards();
  const [posts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const [open, setOpen] = useState(false);
  useEditEvent(conf.id, useCallback(() => setOpen(true), []));

  const st = conf.settings as { boardId?: string; mode?: 'notice' | 'all'; count?: number; title?: string; tags?: string[] };
  const tags = (st.tags ?? []).map(t => t.trim()).filter(Boolean);
  const tagOf = (p: Post) => (p.tags ?? []).find(t => tags.includes(t));   // 고른 태그 중 이 글에 달린 것
  const boardId = boards.some(b => b.id === st.boardId) ? st.boardId! : MAIN_BOARD_ID;
  const mode = st.mode ?? 'notice';
  const count = Math.max(1, Math.min(10, st.count ?? 4));
  const title = (st.title ?? '').trim() || 'NOTICE';
  const board = boards.find(b => b.id === boardId);
  const set = (p: Partial<typeof st>) => updateWidget(conf.id, { settings: { ...conf.settings, ...p } }, { persist: true });

  const canRead = (p: Post) => !p.secret || isAdmin || (!!p.authorId && p.authorId === user?.id);
  const shown = posts
    .filter(p => (p.boardId ?? MAIN_BOARD_ID) === boardId && canRead(p))
    .filter(p => mode === 'all' || p.notice || !!tagOf(p))   // 공지로 고정한 글 + 고른 태그가 달린 글
    .sort((a, b) => (a.notice !== b.notice ? (a.notice ? -1 : 1) : 0) || b.date.localeCompare(a.date))
    .slice(0, count);

  // 훅을 모두 부른 뒤에 판정한다 — 메뉴에서 그 게시판이 비공개면 위젯을 띄우지 않는다
  if (!canViewHref(menuSet, boardHref(boardId), { loggedIn: !!user, isAdmin, id: user?.id })) return null;

  const fmt = (d: string) => (d ? d.slice(5, 10).replace('-', '.') : '');

  return (
    <div className="panel widget" style={{ margin: 0 }}>
      <style>{CSS}</style>
      <h4>{title} <span className="more" onClick={e => { e.stopPropagation(); if (!editOn) router.push(boardHref(boardId)); }}>전체 ›</span></h4>
      {shown.map(p => (
        <div key={p.id} className="ntc-row" onClick={() => { if (!editOn) router.push(`/board/${p.id}`); }}>
          {p.notice ? <span className="pin">공지</span> : tagOf(p) ? <span className="pin tag">{tagOf(p)}</span> : null}
          <span className="t">{p.secret ? '🔒 ' : ''}{p.title}</span>
          <small>{fmt(p.date)}</small>
        </div>
      ))}
      {shown.length === 0 && (
        <p className="hint">{mode === 'notice' ? `「${board?.name ?? '게시판'}」에 공지${tags.length ? `나 ${tags.map(t => `#${t}`).join(' ')} 태그가 달린` : '로 고정한'} 글이 없습니다` : '글이 없습니다'}</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} small title="NOTICE 위젯"
        desc="게시판 글을 메인에 공지란처럼 띄웁니다 — 「공지」로 고정한 글과 고른 태그(예: 업데이트)가 달린 글만, 또는 최근 글 전부"
        actions={<button className="btn btn-dark" onClick={() => setOpen(false)}>확인</button>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="cp-lb">위젯 제목</span>
            <KInput value={st.title ?? ''} placeholder="NOTICE" maxLength={24} onChange={e => set({ title: e.target.value })} />
          </label>
          <div style={{ display: 'grid', gap: 5 }}>
            <span className="cp-lb">게시판</span>
            <KSelect value={boardId} onChange={v => set({ boardId: v })} minWidth={200}
              options={boards.map(b => ({ value: b.id, label: b.name }))} />
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            <span className="cp-lb">보여 줄 글</span>
            <div className="mini-seg" style={{ justifySelf: 'start' }}>
              <button className={mode === 'notice' ? 'on' : ''} onClick={() => set({ mode: 'notice' })}>공지·고른 태그 글만</button>
              <button className={mode === 'all' ? 'on' : ''} onClick={() => set({ mode: 'all' })}>최근 글 (공지 먼저)</button>
            </div>
          </div>
          {mode === 'notice' && (
            <label style={{ display: 'grid', gap: 5 }}>
              <span className="cp-lb">함께 띄울 태그</span>
              <TagsField value={tags} onChange={v => set({ tags: v })} />
              <span className="hint" style={{ margin: 0 }}>이 태그가 달린 글도 공지처럼 떠요 — 쉼표로 여러 개 (예: 업데이트, 이벤트)</span>
            </label>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="cp-lb">몇 개까지</span>
            <KStep value={count} min={1} max={10} suffix="개" onChange={v => set({ count: v })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
