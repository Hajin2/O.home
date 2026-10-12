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
  const id = useMemo(() => `tpl-img-${Math.random().toString(36).slice(2)}`, []);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await putBlob(f)); } finally { setBusy(false); }
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

export function TplTabEditView({ tplId, values, startPage, onChange, onDelete, onBack }: {
  tplId: string;
  values: TplValues;
  startPage: number;
  onChange: (values: TplValues, tpl: CharTemplate) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const { list, loaded } = useTemplates();
  const tpl = list.find(t => t.id === tplId);
  const [page, setPage] = useState(startPage);
  const [bulk, setBulk] = useState<string | null>(null);   // 글로 한 번에 입력 — 열려 있으면 그 글
  const [bulkMsg, setBulkMsg] = useState('');

  const head = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn btn-ghost" onClick={onBack}>‹ 돌아가기</button>
      <b style={{ fontSize: 14 }}>양식 편집{tpl ? ` — ${tpl.name}` : ''}</b>
      <span className="hint" style={{ margin: 0 }}>이 화면의 내용은 프로필 [SAVE] 시 함께 저장됩니다</span>
      <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={onDelete}>양식 탭 삭제</button>
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

  const set = (key: string, v: TplValue) => onChange({ ...values, [key]: v }, tpl);
  const applyBulk = () => {
    if (bulk === null) return;
    const { values: next, unknown } = parseValuesText(tpl, bulk, values);
    onChange(next, tpl);
    setBulkMsg(unknown.length
      ? `적용했어요. 알아보지 못한 줄 ${unknown.length}개는 건너뛰었어요 — 「${unknown[0].slice(0, 30)}」${unknown.length > 1 ? ' 등' : ''}`
      : '적용했어요');
    setBulk(null);
  };
  const p = Math.min(page, tpl.pages.length - 1);
  const fields = tpl.fields.filter(f => (f.page ?? 0) === p);
  const preview = sanitizeHtml(renderTpl(tpl.pages[p].html, values));

  return (
    <div className="panel" data-tpl-editor style={{ padding: 24, display: 'grid', gap: 14 }}
      onKeyDown={e => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === 'b') { e.preventDefault(); wrapSelection('**'); }
        else if (k === 'i') { e.preventDefault(); wrapSelection('*'); }
      }}>
      {head}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <FmtBar />
        <button type="button" className="btn btn-ghost" style={{ ...small, marginLeft: 'auto' }}
          onClick={() => { setBulkMsg(''); setBulk(b => (b === null ? valuesToText(tpl, values) : null)); }}>
          {bulk === null ? '글로 한 번에 입력' : '닫기'}
        </button>
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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tpl.pages.map((x, i) => (
          <button key={i} className={`btn ${i === p ? 'btn-dark' : 'btn-ghost'}`} style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => setPage(i)}>{x.icon} {x.title || `탭 ${i + 1}`}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10 }}>
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
        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>미리보기</div>
          <div className="panel" style={{ padding: 18, maxHeight: '75vh', overflow: 'auto' }}>
            <div className="prose" dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        </div>
      </div>
      <button className="btn btn-dark" style={{ justifySelf: 'end' }} onClick={onBack}>완료 — 목록으로</button>
    </div>
  );
}
