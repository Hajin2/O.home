'use client';
// 캐릭터 양식 관리 (관리자 전용) — 양식 코드(.json)를 붙여 넣거나 파일로 불러와 등록하고, 세계관에 연결한다.
// 캐릭터 편집 화면의 「＋ 양식으로 추가」에서 여기 등록된 양식을 고른다.
// 새 파일로 따로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게.
import React, { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTemplates, type CharTemplate } from '@/lib/tplStore';
import { parseTplCode, renderTpl, type TplCode, type TplField, type TplValues } from '@/lib/tplRender';
import { useWorldList } from '@/lib/worldStore';
import { newId } from '@/lib/postStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { KSelect, KTextarea } from '@/components/ui/Kit';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

/** 미리보기용 예시 값 — 칸 이름·안내 글로 채운다 */
function sampleOf(fields: TplField[]): TplValues {
  const one = (f: TplField): unknown => {
    const t = f.ph || f.label;
    if (f.type === 'list') return [`${f.label} 1`, `${f.label} 2`];
    if (f.type === 'badge') return { text: t, strong: true };
    if (f.type === 'group') return [Object.fromEntries((f.sub ?? []).map(s => [s.key, one(s)]))];
    if (f.type === 'image') return '';
    return t;
  };
  return Object.fromEntries(fields.filter(f => f.type !== 'heading').map(f => [f.key, one(f)])) as TplValues;
}

function Preview({ code }: { code: TplCode }) {
  const [p, setP] = useState(0);
  const values = useMemo(() => sampleOf(code.fields), [code]);
  const page = code.pages[Math.min(p, code.pages.length - 1)];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {code.pages.map((x, i) => (
          <button key={i} className={`btn ${i === p ? 'btn-dark' : 'btn-ghost'}`} style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => setP(i)}>{x.icon} {x.title || `탭 ${i + 1}`}</button>
        ))}
      </div>
      <div className="panel" style={{ padding: 20, maxWidth: 420, maxHeight: 560, overflow: 'auto' }}>
        <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTpl(page.html, values)) }} />
      </div>
      <p className="hint" style={{ margin: 0 }}>미리보기는 칸 이름으로 채운 예시예요. 실제 캐릭터에서는 입력한 값이 들어갑니다.</p>
    </div>
  );
}

function TemplateForm({ initial, onSave, onCancel }: {
  initial: CharTemplate | null;
  onSave: (t: CharTemplate) => void;
  onCancel: () => void;
}) {
  const worlds = useWorldList();
  const [raw, setRaw] = useState(() => (initial
    ? JSON.stringify({ name: initial.name, fields: initial.fields, pages: initial.pages }, null, 1)
    : ''));
  const [worldId, setWorldId] = useState(initial?.worldId ?? '');
  const parsed = useMemo(() => (raw.trim() ? parseTplCode(raw) : null), [raw]);

  const loadFile = async (f?: File) => { if (f) setRaw(await f.text()); };
  const submit = () => {
    if (!parsed?.code) return;
    onSave({
      ...parsed.code,
      id: initial?.id ?? newId(),
      worldId: worldId || undefined,
      visibility: 'public',
      date: initial?.date ?? new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="panel" style={{ padding: 20, display: 'grid', gap: 12 }}>
      <b style={{ fontSize: 14 }}>{initial ? '양식 수정' : '양식 추가'}</b>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input id="tpl-file-in" type="file" accept="application/json,.json,.txt" hidden
          onChange={e => { void loadFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn btn-ghost" onClick={() => document.getElementById('tpl-file-in')?.click()}>양식 파일 불러오기</button>
        <span className="hint" style={{ margin: 0 }}>또는 아래에 양식 코드를 붙여 넣기</span>
      </div>
      <KTextarea value={raw} onChange={e => setRaw(e.target.value)} placeholder='{ "name": "…", "fields": [ … ], "pages": [ … ] }'
        style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 11.5, minHeight: 120, maxHeight: 260, overflow: 'auto' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12 }}>연결할 세계관</span>
        <KSelect value={worldId} onChange={setWorldId} minWidth={200}
          options={[{ value: '', label: '공통 (세계관 없음)' }, ...worlds.list.map(w => ({ value: w.id, label: w.name }))]} />
      </div>
      <p className="hint" style={{ margin: 0 }}>세계관을 연결하면 그 세계관 캐릭터에서 이 양식이 목록 맨 위에 보여요. 다른 캐릭터에서도 쓸 수는 있어요.</p>

      {parsed && parsed.errors.length > 0 && (
        <div style={{ color: 'var(--accent, #c0392b)', fontSize: 12.5, display: 'grid', gap: 3 }}>
          {parsed.errors.map((e, i) => <div key={i}>· {e}</div>)}
        </div>
      )}
      {parsed?.code && (
        <>
          <div style={{ fontSize: 12.5 }}>
            <b>{parsed.code.name}</b> · 탭 {parsed.code.pages.length}개 · 입력칸 {parsed.code.fields.filter(f => f.type !== 'heading').length}개
          </div>
          <Preview code={parsed.code} />
        </>
      )}

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>CANCEL</button>
        <button className="btn btn-dark" onClick={submit} disabled={!parsed?.code}>{initial ? 'SAVE' : 'ADD'}</button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const tpls = useTemplates();
  const worlds = useWorldList();
  const del = useConfirmDelete();
  const [editing, setEditing] = useState<CharTemplate | 'new' | null>(null);

  if (!tpls.loaded) return <section className="page" />;
  if (!isAdmin) return <section className="page"><div className="page-head"><PageTitle>TEMPLATES</PageTitle><p>관리자 전용</p></div></section>;

  const worldName = (id?: string) => (id ? worlds.list.find(w => w.id === id)?.name ?? '(지워진 세계관)' : '공통');

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>TEMPLATES</PageTitle>
        <p>캐릭터 양식 — 캐릭터 편집의 「＋ 양식으로 추가」에서 골라 써요</p>
        <div className="head-actions">
          {!editing && <button className="btn btn-dark" onClick={() => setEditing('new')}>＋ ADD TEMPLATE</button>}
        </div>
      </div>

      {editing && (
        <div style={{ marginBottom: 16 }}>
          <TemplateForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
            onSave={async t => {
              await tpls.save(editing === 'new' ? [...tpls.list, t] : tpls.list.map(x => (x.id === t.id ? t : x)));
              toast(editing === 'new' ? '양식이 등록되었습니다' : '저장되었습니다 — 이 양식을 쓰는 캐릭터에 바로 반영돼요');
              setEditing(null);
            }} />
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {tpls.list.map(t => (
          <div key={t.id} className="panel" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <b style={{ fontSize: 14 }}>{t.name}</b>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                {worldName(t.worldId)} · 탭 {t.pages.map(p => `${p.icon} ${p.title}`).join(' / ')} · 입력칸 {t.fields.filter(f => f.type !== 'heading').length}개
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => setEditing(t)}>EDIT</button>
            <button className="btn btn-ghost" onClick={() => del.ask(`양식 「${t.name}」을 삭제하시겠습니까?`, async () => {
              await tpls.save(tpls.list.filter(x => x.id !== t.id));
              toast('삭제되었습니다');
            }, '이 양식으로 만든 캐릭터 탭은 마지막으로 저장한 모습 그대로 남지만, 더는 칸을 고칠 수 없게 됩니다.')}>DELETE</button>
          </div>
        ))}
        {tpls.list.length === 0 && !editing && (
          <p className="hint">등록된 양식이 없어요 — ＋ ADD TEMPLATE으로 양식 파일을 불러오세요</p>
        )}
      </div>
      {del.element}
    </section>
  );
}
