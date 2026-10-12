'use client';
// 캐릭터 양식 탭 — 「＋ 양식으로 추가」 고르기 · 양식 칸 입력 화면 (캐릭터 편집에서 쓴다).
// 같은 양식으로 만든 탭들은 값을 공유하므로, 입력 화면은 탭 하나가 아니라 묶음(group) 전체를 편집한다.
// 새 파일로 따로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게.
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useTemplateChoices, useTemplates, type CharTemplate } from '@/lib/tplStore';
import {
  emptyOf, renderTpl, valuesToText, parseValuesText,
  type BadgeValue, type TplField, type TplValue, type TplValues,
} from '@/lib/tplRender';
import { putBlob } from '@/lib/blobStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { KInput, KTextarea } from '@/components/ui/Kit';
import { useWorldList } from '@/lib/worldStore';
import type { CharTab } from '@/lib/charStore';
import { newId } from '@/lib/postStore';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/* ---------- 양식 고르기 ---------- */

export function TplPicker({ worldId, onPick }: {
  worldId?: string;
  onPick: (t: CharTemplate) => void;
}) {
  const { isAdmin } = useAuth();
  const { sorted, loaded } = useTemplateChoices(worldId);
  const worlds = useWorldList();
  const [open, setOpen] = useState(false);
  const wname = (id?: string) => (id ? worlds.list.find(w => w.id === id)?.name ?? '' : '공통');

  if (!open) {
    return (
      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, justifySelf: 'center' }}
        onClick={() => setOpen(true)}>＋ 양식으로 추가</button>
    );
  }
  return (
    <div style={{ border: '1.5px solid var(--line)', borderRadius: 8, padding: 10, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ fontSize: 12.5 }}>양식 고르기</b>
        {isAdmin && <Link href="/templates" style={{ fontSize: 11, color: 'var(--faint)' }}>양식 관리 ›</Link>}
        <span className="fx" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>✕</span>
      </div>
      {!loaded && <p className="hint" style={{ margin: 0 }}>불러오는 중…</p>}
      {loaded && sorted.length === 0 && (
        <p className="hint" style={{ margin: 0 }}>
          등록된 양식이 없어요{isAdmin ? ' — 세계관 화면의 TEMPLATES에서 양식을 등록하세요' : ''}
        </p>
      )}
      {sorted.map(t => (
        <button key={t.id} type="button" className="btn btn-ghost"
          style={{ justifyContent: 'space-between', display: 'flex', width: '100%', textAlign: 'left', fontSize: 12.5, padding: '7px 10px' }}
          onClick={() => { onPick(t); setOpen(false); }}>
          <span>{t.name}</span>
          <small style={{ color: 'var(--faint)' }}>
            {worldId && t.worldId === worldId ? '★ ' : ''}{wname(t.worldId)} · 탭 {t.pages.length}개
          </small>
        </button>
      ))}
    </div>
  );
}

/** 양식을 처음 고를 때의 값 — 이름 칸이 있으면 캐릭터 이름을 미리 채운다 */
export function initialValues(t: CharTemplate, charName: string): TplValues {
  const v: TplValues = {};
  for (const f of t.fields) if (f.type !== 'heading') v[f.key] = emptyOf(f);
  if (charName.trim() && t.fields.some(f => f.key === 'name' && f.type === 'text')) v.name = charName.trim();
  return v;
}

/** 양식의 탭들(pages 중 only에 든 것, 없으면 전부)을 캐릭터 탭으로 — 같은 group으로 묶는다 */
export function tabsFromTpl(t: CharTemplate, values: TplValues, group = newId(), only?: number[]): CharTab[] {
  return t.pages.flatMap((p, i) => (only && !only.includes(i) ? [] : [{
    id: newId(), icon: p.icon, title: p.title, html: renderTpl(p.html, values),
    tpl: { id: t.id, page: i, group, values },
  }]));
}

/* ---------- 칸 입력 ---------- */

const small: React.CSSProperties = { fontSize: 11, padding: '3px 8px' };
const box: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 };

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n;
}

function ListInput({ value, onChange, ph }: { value: string[]; onChange: (v: string[]) => void; ph?: string }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {value.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <KTextarea value={s} rows={1} placeholder={ph} style={{ flex: 1 }}
            onChange={e => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="btn btn-ghost" style={small} onClick={() => onChange(move(value, i, -1))} disabled={i === 0}>↑</button>
          <button className="btn btn-ghost" style={small} onClick={() => onChange(move(value, i, 1))} disabled={i === value.length - 1}>↓</button>
          <span className="fx" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</span>
        </div>
      ))}
      <button className="btn btn-ghost" style={{ ...small, justifySelf: 'start' }} onClick={() => onChange([...value, ''])}>＋ 줄 추가</button>
    </div>
  );
}

function BadgeInput({ value, onChange, ph }: { value: BadgeValue; onChange: (v: BadgeValue) => void; ph?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <KInput value={value.text} placeholder={ph} style={{ flex: 1 }} onChange={e => onChange({ ...value, text: e.target.value })} />
      <div className="mini-seg">
        <button className={value.strong ? 'on' : ''} onClick={() => onChange({ ...value, strong: true })}>강조</button>
        <button className={!value.strong ? 'on' : ''} onClick={() => onChange({ ...value, strong: false })}>보통</button>
      </div>
    </div>
  );
}

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const id = useMemo(() => `tpl-img-${Math.random().toString(36).slice(2)}`, []);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await putBlob(f)); }
    catch (e) { console.error('[ohome] 양식 이미지 올리기 실패', e); toast('이미지를 올리지 못했어요 — 다시 시도해 주세요'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {/^(https?:|data:)/.test(value) && <img src={value} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />}
      <input id={id} type="file" accept="image/*" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <button className="btn btn-ghost" style={small} disabled={busy} onClick={() => document.getElementById(id)?.click()}>
        {busy ? '올리는 중…' : value ? '이미지 바꾸기' : '이미지 올리기'}
      </button>
      {value && <button className="btn btn-ghost" style={small} onClick={() => onChange('')}>제거</button>}
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: TplField; value: TplValue | undefined; onChange: (v: TplValue) => void }) {
  const v = value ?? emptyOf(f);
  switch (f.type) {
    case 'text':
      return <KInput value={typeof v === 'string' ? v : ''} placeholder={f.ph} onChange={e => onChange(e.target.value)} />;
    case 'long':
      return <KTextarea value={typeof v === 'string' ? v : ''} placeholder={f.ph} rows={2} onChange={e => onChange(e.target.value)} />;
    case 'list':
      return <ListInput value={Array.isArray(v) ? (v as string[]) : []} onChange={onChange} ph={f.ph} />;
    case 'badge':
      return <BadgeInput value={(v && typeof v === 'object' && !Array.isArray(v) ? v : { text: '', strong: false }) as BadgeValue} onChange={onChange} ph={f.ph} />;
    case 'image':
      return <ImageInput value={typeof v === 'string' ? v : ''} onChange={onChange} />;
    case 'group': {
      const items = (Array.isArray(v) ? v : []) as Record<string, unknown>[];
      const blank = () => Object.fromEntries((f.sub ?? []).map(s => [s.key, emptyOf(s)]));
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((it, i) => (
            <div key={i} style={box}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <b style={{ fontSize: 12 }}>{f.label} {i + 1}</b>
                <button className="btn btn-ghost" style={{ ...small, marginLeft: 'auto' }} onClick={() => onChange(move(items, i, -1))} disabled={i === 0}>↑</button>
                <button className="btn btn-ghost" style={small} onClick={() => onChange(move(items, i, 1))} disabled={i === items.length - 1}>↓</button>
                <span className="fx" data-tip="이 묶음 삭제" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</span>
              </div>
              {(f.sub ?? []).map(s => (
                <div key={s.key} style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{s.label}</span>
                  <FieldInput f={s} value={it[s.key] as TplValue | undefined}
                    onChange={nv => onChange(items.map((x, j) => (j === i ? { ...x, [s.key]: nv } : x)))} />
                </div>
              ))}
            </div>
          ))}
          <button className="btn btn-ghost" style={{ ...small, justifySelf: 'start' }} onClick={() => onChange([...items, blank()])}>＋ {f.label} 추가</button>
        </div>
      );
    }
    default:
      return null;
  }
}

/* ---------- 서식 (굵게·기울임·취소선) ---------- */

/** 지금 커서가 있는 입력칸의 선택 글을 기호로 감싼다 — 이미 감싸져 있으면 벗긴다.
 *  React가 관리하는 칸이라 값을 직접 넣고 input 이벤트를 보내 onChange가 돌게 한다. */
function wrapSelection(mark: string) {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  if (!el.closest('[data-tpl-editor]')) return;
  const v = el.value;
  const a = el.selectionStart ?? 0;
  const b = el.selectionEnd ?? a;
  const sel = v.slice(a, b);
  const n = mark.length;
  let next: string; let s0: number; let s1: number;
  if (v.slice(a - n, a) === mark && v.slice(b, b + n) === mark) {
    next = v.slice(0, a - n) + sel + v.slice(b + n); s0 = a - n; s1 = b - n;
  } else if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= n * 2) {
    const inner = sel.slice(n, sel.length - n);
    next = v.slice(0, a) + inner + v.slice(b); s0 = a; s1 = a + inner.length;
  } else {
    next = v.slice(0, a) + mark + sel + mark + v.slice(b); s0 = a + n; s1 = b + n;
  }
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s0, s1); });
}

function FmtBar() {
  const btn = (mark: string, label: React.ReactNode, tip: string) => (
    <button type="button" className="btn btn-ghost" style={{ ...small, minWidth: 30 }} data-tip={tip}
      onMouseDown={e => { e.preventDefault(); wrapSelection(mark); }}>{label}</button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {btn('**', <b>B</b>, '굵게 (Ctrl+B)')}
      {btn('*', <i>I</i>, '기울임 (Ctrl+I)')}
      {btn('~~', <s>S</s>, '취소선')}
      <span className="hint" style={{ margin: '0 0 0 4px' }}>글자를 선택하고 누르세요</span>
    </div>
  );
}

/* ---------- 양식 탭 편집 화면 ---------- */

/** tab: 지금 연 양식 탭 · tabs/setTabs: 캐릭터의 탭 전체 (같은 묶음을 함께 고친다) · onOpen: 다른 탭 열기 */
export function TplTabEditView({ tab, tabs, setTabs, onOpen, onDelete, onBack }: {
  tab: CharTab;
  tabs: CharTab[];
  setTabs: React.Dispatch<React.SetStateAction<CharTab[]>>;
  onOpen: (tabId: string) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const { list, loaded } = useTemplates();
  const info = tab.tpl!;
  const { group, values } = info;
  const tpl = list.find(t => t.id === info.id);
  const [bulk, setBulk] = useState<string | null>(null);   // 글로 한 번에 입력 — 열려 있으면 그 글
  const [bulkMsg, setBulkMsg] = useState('');
  const del = useConfirmDelete();

  // 같은 묶음의 탭들 — 양식 순서대로
  const groupTabs = tabs.filter(x => x.tpl?.group === group).sort((a, b) => a.tpl!.page - b.tpl!.page);
  const patchTab = (id: string, patch: Partial<CharTab>) => setTabs(l => l.map(x => (x.id === id ? { ...x, ...patch } : x)));

  const head = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn btn-ghost" onClick={onBack}>‹ 돌아가기</button>
      <b style={{ fontSize: 14 }}>양식 편집{tpl ? ` — ${tpl.name}` : ''}</b>
      <span className="hint" style={{ margin: 0 }}>이 화면의 내용은 프로필 [SAVE] 시 함께 저장됩니다</span>
      <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={onDelete}>
        {groupTabs.length > 1 ? `양식 탭 ${groupTabs.length}개 모두 삭제` : '양식 탭 삭제'}
      </button>
    </div>
  );
  if (!loaded) return <div className="panel" style={{ padding: 24 }}>{head}</div>;
  if (!tpl) {
    return (
      <div className="panel" style={{ padding: 24, display: 'grid', gap: 12 }}>
        {head}
        <p className="hint" style={{ margin: 0 }}>
          이 탭을 만든 양식이 삭제되어 더는 칸을 고칠 수 없어요. 탭은 마지막으로 저장한 모습 그대로 보입니다.
        </p>
      </div>
    );
  }

  const setValues = (next: TplValues) => setTabs(l => l.map(x => (x.tpl?.group === group
    ? { ...x, tpl: { ...x.tpl, values: next }, html: renderTpl(tpl.pages[x.tpl.page]?.html ?? '', next) }
    : x)));
  const set = (key: string, v: TplValue) => setValues({ ...values, [key]: v });
  const applyBulk = () => {
    if (bulk === null) return;
    const { values: next, unknown } = parseValuesText(tpl, bulk, values);
    setValues(next);
    setBulkMsg(unknown.length
      ? `적용했어요. 알아보지 못한 줄 ${unknown.length}개는 건너뛰었어요 — 「${unknown[0].slice(0, 30)}」${unknown.length > 1 ? ' 등' : ''}`
      : '적용했어요');
    setBulk(null);
  };

  // 양식에는 있는데 이 묶음에 없는 탭 — 「이 탭만 빼기」로 뺐거나, 양식에 나중에 새로 생긴 탭
  const have = new Set(groupTabs.map(x => x.tpl!.page));
  const missing = tpl.pages.map((_, i) => i).filter(i => !have.has(i));
  const addMissing = () => {
    const made = tabsFromTpl(tpl, values, group, missing);
    setTabs(l => {
      // 묶음의 마지막 탭 바로 뒤에 끼워 넣는다
      let at = -1;
      l.forEach((x, i) => { if (x.tpl?.group === group) at = i; });
      return at < 0 ? [...l, ...made] : [...l.slice(0, at + 1), ...made, ...l.slice(at + 1)];
    });
  };
  const removeThis = () => {
    const next = groupTabs.find(x => x.id !== tab.id);
    del.ask(`「${tab.title || '제목 없음'}」 탭만 빼시겠습니까?`, () => {
      if (next) onOpen(next.id);
      setTabs(l => l.filter(x => x.id !== tab.id));
    }, '입력한 칸 내용은 묶음에 그대로 남아요 — 이 화면의 「빠진 탭 다시 넣기」로 언제든 되살릴 수 있어요.', '빼기');
  };

  const p = tpl.pages[info.page] ? info.page : 0;
  const fields = tpl.fields.filter(f => (f.page ?? 0) === p);
  const preview = sanitizeHtml(renderTpl(tpl.pages[p].html, values));

  return (
    <div className="panel tpl-ed" data-tpl-editor style={{ padding: 24, display: 'grid', gap: 14, overflow: 'visible' }}
      onKeyDown={e => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === 'b') { e.preventDefault(); wrapSelection('**'); }
        else if (k === 'i') { e.preventDefault(); wrapSelection('*'); }
      }}>
      <style>{`
        /* 서식 버튼·탭 고르기 줄은 스크롤해도 화면 위에 붙어 있게 */
        .tpl-ed .tpl-bar{position:sticky;top:0;z-index:6;margin:0 -24px;padding:10px 24px;display:grid;gap:10px;
          background:var(--panel-solid,#fff);border-bottom:1px solid var(--line)}
        .tpl-ed .tpl-pages{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
        .tpl-ed .tpl-pages::-webkit-scrollbar{display:none}
        .tpl-ed .tpl-pages .btn{flex-shrink:0;font-size:12px;padding:4px 12px}
        .tpl-ed .tpl-name{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        .tpl-ed .tpl-name .k-input{min-width:0}
        @media (max-width:640px){.tpl-ed{padding:16px!important}.tpl-ed .tpl-bar{margin:0 -16px;padding:8px 16px}}
      `}</style>
      {head}
      <div className="tpl-bar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <FmtBar />
          <button type="button" className="btn btn-ghost" style={{ ...small, marginLeft: 'auto' }}
            onClick={() => { setBulkMsg(''); setBulk(b => (b === null ? valuesToText(tpl, values) : null)); }}>
            {bulk === null ? '글로 한 번에 입력' : '닫기'}
          </button>
        </div>
        <div className="tpl-pages" role="tablist">
          {groupTabs.map(x => (
            <button key={x.id} role="tab" aria-selected={x.id === tab.id}
              className={`btn ${x.id === tab.id ? 'btn-dark' : 'btn-ghost'}`}
              onClick={() => onOpen(x.id)}>{x.icon} {x.title || tpl.pages[x.tpl!.page]?.title || `탭 ${x.tpl!.page + 1}`}</button>
          ))}
        </div>
      </div>
      {bulkMsg && <p className="hint" style={{ margin: 0 }}>{bulkMsg}</p>}
      {bulk !== null && (
        <div style={{ ...box, gap: 10 }}>
          <p className="hint" style={{ margin: 0 }}>
            지금 내용이 글로 들어 있어요. 고치거나 통째로 바꿔 붙여 넣고 [적용]을 누르면 칸이 채워져요.
            「칸 이름: 내용」 · 여러 줄 글은 다음 줄부터 · 목록은 「- 」로 시작 · 묶음은 「[이름]」으로 시작 · 뱃지 끝에 「(강조)」
          </p>
          <KTextarea value={bulk} onChange={e => setBulk(e.target.value)}
            style={{ fontSize: 12.5, minHeight: 240, maxHeight: '60vh', overflow: 'auto', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setBulk(null)}>CANCEL</button>
            <button className="btn btn-dark" onClick={applyBulk}>적용</button>
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5 }}>
            양식에 있지만 이 캐릭터에 없는 탭: {missing.map(i => `${tpl.pages[i].icon} ${tpl.pages[i].title || `탭 ${i + 1}`}`).join(' · ')}
          </span>
          <button className="btn btn-ghost" style={{ ...small, marginLeft: 'auto' }} onClick={addMissing}>
            {missing.length > 1 ? `${missing.length}개 ` : ''}다시 넣기
          </button>
        </div>
      )}

      {/* 이 탭의 이름 — 캐릭터 화면 탭 줄·편집 목록에 보이는 이름 (양식 원래 이름에서 바꿔도 됨) */}
      <div className="tpl-name">
        <span style={{ fontSize: 11.5, color: 'var(--faint)', width: '100%' }}>탭 이름 · 아이콘</span>
        <KInput value={tab.icon} maxLength={2} style={{ width: 52, textAlign: 'center' }} aria-label="아이콘"
          onChange={e => patchTab(tab.id, { icon: e.target.value })} />
        <KInput value={tab.title} placeholder={tpl.pages[p].title || '탭 이름'} style={{ flex: 1, minWidth: 160 }} aria-label="탭 이름"
          onChange={e => patchTab(tab.id, { title: e.target.value })} />
        {(tab.title !== tpl.pages[p].title || tab.icon !== tpl.pages[p].icon) && (
          <button className="btn btn-ghost" style={small} data-tip="양식에 정해진 이름·아이콘으로"
            onClick={() => patchTab(tab.id, { title: tpl.pages[p].title, icon: tpl.pages[p].icon })}>원래대로</button>
        )}
        {groupTabs.length > 1 && (
          <button className="btn btn-ghost" style={small} data-tip="이 탭만 캐릭터에서 빼기 (내용은 남음)" onClick={removeThis}>이 탭만 빼기</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          {fields.map((f, i) => (f.type === 'heading'
            ? <div key={`h${i}`} style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', marginTop: i ? 10 : 0, paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>{f.label}</div>
            : (
              <div key={f.key} style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{f.label}</span>
                <FieldInput f={f} value={values[f.key]} onChange={v => set(f.key, v)} />
              </div>
            )))}
          {fields.length === 0 && <p className="hint" style={{ margin: 0 }}>이 탭에는 입력할 칸이 없어요</p>}
        </div>
        <div className="tpl-prev" style={{ position: 'sticky', top: 110, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>미리보기</div>
          <div className="panel" style={{ padding: 18, maxHeight: 'calc(100vh - 150px)', overflow: 'auto' }}>
            <div className="prose" dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        </div>
      </div>
      <button className="btn btn-dark" style={{ justifySelf: 'end' }} onClick={onBack}>완료 — 목록으로</button>
      {del.element}
    </div>
  );
}
