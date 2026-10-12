'use client';
// 캐릭터 여러 명 한 번에 등록 (포크) — 양식 하나를 고르고, 「글로 한 번에 입력」 형식의 글을
// 캐릭터마다 붙여 넣거나(.txt 여러 개) 한 파일에 「===== 이름 =====」 줄로 나눠 넣으면
// 이름마다 캐릭터를 만들고 양식 탭을 채운다. 같은 세계관에 같은 이름이 이미 있으면 새로 만들지 않고
// 그 캐릭터의 양식 탭을 채운다(없으면 추가, 있으면 내용 교체).
// 새 파일로 따로 둔 이유: 원작/기존 홈 업데이트(Sync fork)와 충돌하지 않게.
import React, { Suspense, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { Character, CHAR_SEED, type CharTab, type Visibility } from '@/lib/charStore';
import { useSectionParam, secStamp, secQuery } from '@/lib/sectionStore';
import { useEditableWorlds, canEditChar, creatorGrants } from '@/lib/charAccess';
import { useTemplateChoices, type CharTemplate } from '@/lib/tplStore';
import { parseValuesText, renderTpl, filled, type TplValues } from '@/lib/tplRender';
import { initialValues } from '@/components/chars/TplTabs';
import { KSelect, KTextarea } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

interface Block { name: string; text: string }

/** 「===== 이름 =====」 줄로 나눈다 — 나누는 줄이 없으면 글 전체가 한 명 */
function splitBlocks(text: string, fallbackName = ''): Block[] {
  const re = /^={3,}\s*(.*?)\s*={3,}\s*$/gm;
  const marks = [...text.matchAll(re)];
  if (!marks.length) return text.trim() ? [{ name: fallbackName, text }] : [];
  return marks.map((m, i) => ({
    name: m[1].trim(),
    text: text.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : text.length),
  })).filter(b => b.text.trim());
}

type Plan =
  | { kind: 'new'; name: string; values: TplValues; unknown: number }
  | { kind: 'update'; name: string; values: TplValues; unknown: number; target: Character }
  | { kind: 'skip'; name: string; why: string };

function tabsFor(tpl: CharTemplate, values: TplValues, group = newId()): CharTab[] {
  return tpl.pages.map((p, i) => ({
    id: newId(), icon: p.icon, title: p.title, html: renderTpl(p.html, values),
    tpl: { id: tpl.id, page: i, group, values },
  }));
}

/** 기존 캐릭터에 양식 탭 채우기 — 같은 양식 탭이 있으면 그 묶음의 값만 바꾸고, 없으면 뒤에 붙인다 */
function applyToChar(ch: Character, tpl: CharTemplate, values: TplValues): Character {
  const group = ch.tabs.find(t => t.tpl?.id === tpl.id)?.tpl?.group;
  if (!group) return { ...ch, tabs: [...ch.tabs, ...tabsFor(tpl, values)] };
  return {
    ...ch,
    tabs: ch.tabs.map(t => (t.tpl?.group === group
      ? { ...t, html: renderTpl(tpl.pages[t.tpl.page]?.html ?? '', values), tpl: { ...t.tpl, values } }
      : t)),
  };
}

function BulkInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const sec = useSectionParam('chars');
  const [chars, setChars, loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const editable = useEditableWorlds();
  const [worldId, setWorldId] = useState('');
  const wid = worldId || (isAdmin ? '' : editable.worlds[0]?.id ?? '');
  const { sorted: tpls, loaded: tplLoaded } = useTemplateChoices(wid || undefined);
  const [tplId, setTplId] = useState('');
  const tpl = tpls.find(t => t.id === tplId) ?? tpls[0];
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Block[]>([]);
  const [busy, setBusy] = useState(false);

  const blocks = useMemo(() => [...files, ...splitBlocks(text)], [files, text]);

  const plans: Plan[] = useMemo(() => {
    if (!tpl) return [];
    const seen = new Set<string>();
    return blocks.map(b => {
      const { values, unknown } = parseValuesText(tpl, b.text, initialValues(tpl, b.name));
      const name = (typeof values.name === 'string' && values.name.trim()) || b.name.trim();
      if (!name) return { kind: 'skip', name: '(이름 없음)', why: '이름을 찾지 못했어요 — 「이름:」 줄이나 「===== 이름 =====」 줄이 필요해요' } as Plan;
      if (seen.has(name)) return { kind: 'skip', name, why: '위에 같은 이름이 이미 있어요' } as Plan;
      seen.add(name);
      if (typeof values.name !== 'string' || !values.name.trim()) values.name = name;
      const filledCount = Object.values(values).filter(filled).length;
      if (filledCount <= 1) return { kind: 'skip', name, why: '채울 내용이 없어요' } as Plan;
      const target = chars.find(c => c.name.trim() === name && (c.worldId ?? '') === wid);
      if (target) {
        if (!canEditChar(target, user?.id, isAdmin)) return { kind: 'skip', name, why: '이미 있는 캐릭터인데 편집 권한이 없어요' } as Plan;
        return { kind: 'update', name, values, unknown: unknown.length, target } as Plan;
      }
      return { kind: 'new', name, values, unknown: unknown.length } as Plan;
    });
  }, [blocks, tpl, chars, wid, user?.id, isAdmin]);

  if (!loaded || !editable.loaded) return <section className="page" />;
  if (!editable.canAdd) {
    return <section className="page"><div className="page-head"><PageTitle>BULK ADD</PageTitle><p>캐릭터를 추가할 권한이 없습니다</p></div></section>;
  }

  const loadFiles = async (list: FileList | null) => {
    if (!list) return;
    const got: Block[] = [];
    for (const f of Array.from(list)) {
      const t = await f.text();
      // 파일 이름 앞부분을 이름 후보로 (예: 「권이안_인사관리카드.txt」 → 권이안)
      const guess = f.name.replace(/\.[^.]+$/, '').split(/[_\s-]/)[0] ?? '';
      got.push(...splitBlocks(t, guess));
    }
    setFiles(prev => [...prev, ...got]);
  };

  const go = async () => {
    if (!tpl) return;
    const todo = plans.filter(p => p.kind !== 'skip');
    if (!todo.length) return;
    setBusy(true);
    try {
      let next = [...chars];
      for (const p of todo) {
        if (p.kind === 'update') {
          next = next.map(c => (c.id === p.target.id ? applyToChar(c, tpl, p.values) : c));
        } else if (p.kind === 'new') {
          const team = typeof p.values.team === 'string' ? p.values.team : '';
          const c: Character = {
            id: newId(), name: p.name, sub: team, color: '#5d636d', themeMode: 'default',
            colors: [], colorTipMode: 'hex', specs: [], tabs: tabsFor(tpl, p.values), basicHtml: '',
            visibility, thumbClass: '', arts: [], own: true, worldId: wid || undefined,
            authorId: user?.id, grants: creatorGrants(user?.id, isAdmin), ...secStamp(sec.id),
          };
          next.push(c);
        }
      }
      setChars(next);
      const n = todo.filter(p => p.kind === 'new').length;
      const u = todo.length - n;
      toast(`${n ? `${n}명 등록` : ''}${n && u ? ' · ' : ''}${u ? `${u}명 양식 갱신` : ''} — 그림은 각 캐릭터 편집에서 넣어 주세요`);
      router.push('/chars' + secQuery('chars', sec.id));
    } finally { setBusy(false); }
  };

  const worldOptions = isAdmin
    ? [{ value: '', label: '소속 세계관 없음' }, ...editable.worlds.map(w => ({ value: w.id, label: w.name }))]
    : editable.worlds.map(w => ({ value: w.id, label: w.name }));
  const nNew = plans.filter(p => p.kind === 'new').length;
  const nUpd = plans.filter(p => p.kind === 'update').length;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={'/chars' + secQuery('chars', sec.id)}>BULK ADD</PageTitle>
        <p>캐릭터 여러 명 한 번에 등록 — 양식을 고르고 캐릭터별 글을 넣으면 이름마다 캐릭터가 생겨요</p>
      </div>
      <div className="panel" style={{ padding: 20, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12 }}>세계관</span>
          <KSelect value={wid} onChange={setWorldId} options={worldOptions} minWidth={180} />
          <span style={{ fontSize: 12, marginLeft: 8 }}>양식</span>
          {tplLoaded && tpls.length === 0
            ? <span className="hint" style={{ margin: 0 }}>등록된 양식이 없어요</span>
            : <KSelect value={tpl?.id ?? ''} onChange={setTplId} options={tpls.map(t => ({ value: t.id, label: t.name }))} minWidth={220} />}
          <span style={{ fontSize: 12, marginLeft: 8 }}>새 캐릭터 공개범위</span>
          <KSelect value={visibility} onChange={v => setVisibility(v as Visibility)} minWidth={120}
            options={[{ value: 'public', label: '전체공개' }, { value: 'member', label: '멤버공개' }, { value: 'private', label: '나만보기' }]} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input id="bulk-files-in" type="file" accept=".txt,text/plain" multiple hidden
            onChange={e => { void loadFiles(e.target.files); e.target.value = ''; }} />
          <button className="btn btn-ghost" onClick={() => document.getElementById('bulk-files-in')?.click()}>글 파일 불러오기 (여러 개)</button>
          {files.length > 0 && (
            <>
              <span className="hint" style={{ margin: 0 }}>파일에서 {files.length}명</span>
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setFiles([])}>파일 비우기</button>
            </>
          )}
        </div>
        <KTextarea value={text} onChange={e => setText(e.target.value)}
          placeholder={'또는 여기에 붙여 넣기 — 여러 명이면 사이에 「===== 이름 =====」 줄을 넣어 나눠요\n\n===== 권이안 =====\n이름: 권이안\n직급: 대리\n…'}
          style={{ fontSize: 12.5, minHeight: 160, maxHeight: '45vh', overflow: 'auto', lineHeight: 1.6 }} />

        {plans.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <b style={{ fontSize: 12.5 }}>미리보기 — 새로 {nNew}명 · 기존 캐릭터 갱신 {nUpd}명</b>
            {plans.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ minWidth: 90, fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: p.kind === 'skip' ? 'var(--accent, #c0392b)' : 'var(--faint)' }}>
                  {p.kind === 'new' && '새로 등록'}
                  {p.kind === 'update' && '이미 있는 캐릭터 — 양식 탭 채우기'}
                  {p.kind === 'skip' && `건너뜀 — ${p.why}`}
                  {p.kind !== 'skip' && p.unknown > 0 && ` · 알아보지 못한 줄 ${p.unknown}개`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={() => router.push('/chars' + secQuery('chars', sec.id))}>CANCEL</button>
          <button className="btn btn-dark" disabled={busy || !tpl || nNew + nUpd === 0} onClick={() => void go()}>
            {nNew + nUpd > 0 ? `${nNew + nUpd}명 등록` : '등록'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function CharBulkPage() {
  return <Suspense fallback={<section className="page" />}><BulkInner /></Suspense>;
}
