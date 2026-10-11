'use client';
// 위젯 등록/수정 폼 — 공통(플랫폼·제목·소개·공유 링크·태그·공개범위·썸네일·설명) + 플랫폼별 칸
// · 케이브덕: 상태값(키·지시사항·예시 값) 표 + 위젯 콘텐츠 HTML — 편집 화면 「통째로 복사」 붙여넣기로 한 번에 채우기
// · 티팟: 컴포넌트 이름·표시 이름·설명 + JSX 코드 + Props 표(이름·타입·예시값·설명) — 코드에서 Props 불러오기
// 오른쪽(좁은 화면은 아래)에 작동 예시가 바로바로 갱신된다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useEffect, useMemo, useState } from 'react';
import type { Visibility } from '@/lib/charStore';
import {
  type Widget, type WidgetPlatform, type WidgetMode, type CaveState, type TeapotProp, type TeapotPropType,
  PLATFORMS, PLATFORM_LABEL, parseCaveduckCopy, placeholdersOf,
} from '@/lib/widgetStore';
import { newId } from '@/lib/postStore';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { KInput, KSelect, KCheck } from '@/components/ui/Kit';
import { Modal } from '@/components/ui/Modal';
import { CropEditor, CropValue, CropImg } from '@/components/ui/CropEditor';
import { TagInput } from '@/components/ui/TagInput';
import { parseTags } from '@/lib/tagUtil';
import { fileDrop } from '@/lib/dnd';
import { useToast } from '@/components/ui/Toast';
import { WidgetPreview, teapotName } from './WidgetPreview';

const codeArea: React.CSSProperties = {
  width: '100%', minHeight: 260, height: 320, resize: 'vertical', boxSizing: 'border-box',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.5,
  whiteSpace: 'pre', overflow: 'auto', tabSize: 2,
};
const small: React.CSSProperties = { fontSize: 11, padding: '3px 9px' };
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--sub)', margin: '2px 0 -2px' };

/** 티팟 — 함수 시그니처의 구조 분해 `({ hp = 0, name = '…', ok = true })`에서 Props 뽑기 */
export function propsFromJsx(code: string): TeapotProp[] {
  const m = code.match(/(?:function\s+[A-Z]\w*\s*\(|(?:const|let|var)\s+[A-Z]\w*\s*=\s*\()\s*\{([\s\S]*?)\}\s*(?::[^)]*)?\)/);
  if (!m) return [];
  const body = m[1];
  // 최상위 쉼표로 나누기 (기본값 안의 괄호·따옴표는 건너뜀)
  const parts: string[] = [];
  let depth = 0, q: string | null = null, cur = '';
  for (const ch of body) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const out: TeapotProp[] = [];
  for (const raw of parts) {
    const p = raw.replace(/\/\/.*$/gm, '').trim();
    const mm = p.match(/^([A-Za-z_$][\w$]*)\s*(?:=\s*([\s\S]+))?$/);
    if (!mm) continue;
    const def = (mm[2] ?? '').trim();
    let type: TeapotPropType = 'string', example = '';
    if (/^-?\d+(\.\d+)?$/.test(def)) { type = 'number'; example = def; }
    else if (def === 'true' || def === 'false') { type = 'boolean'; example = def; }
    else if (/^(['"`])([\s\S]*)\1$/.test(def)) example = def.slice(1, -1);
    out.push({ name: mm[1], type, example, description: '' });
  }
  return out;
}

export function WidgetForm({ initial, onSave, onCancel }: {
  initial: Widget | null;
  onSave: (w: Widget) => void | Promise<void>;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [platform, setPlatform] = useState<WidgetPlatform>(initial?.platform ?? 'caveduck');
  // 등록 방식 — 새로 만들 땐 간단 등록부터 (예전 데이터는 작동 예시)
  const [mode, setMode] = useState<WidgetMode>(initial ? (initial.mode ?? 'live') : 'simple');
  const live = mode === 'live';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [sub, setSub] = useState(initial?.sub ?? '');
  const [shareUrl, setShareUrl] = useState(initial?.shareUrl ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '));
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? 'public');
  const [showCode, setShowCode] = useState(initial?.showCode ?? false);
  const [previewHeight, setPreviewHeight] = useState(initial?.previewHeight ? String(initial.previewHeight) : '');
  // 케이브덕
  const [states, setStates] = useState<CaveState[]>(initial?.states ?? []);
  const [html, setHtml] = useState(initial?.html ?? '');
  const [userName, setUserName] = useState(initial?.userName ?? '');
  const [charName, setCharName] = useState(initial?.charName ?? '');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // 티팟
  const [componentName, setComponentName] = useState(initial?.componentName ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [jsx, setJsx] = useState(initial?.jsx ?? '');
  const [props, setProps] = useState<TeapotProp[]>(initial?.props ?? []);
  // 썸네일 (16:9, 선택)
  const [ref, setRef] = useState<string | undefined>(initial?.imgId);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [crop, setCrop] = useState<CropValue | undefined>(initial?.crop);
  const [cropOpen, setCropOpen] = useState(false);
  const savedUrl = useBlobUrl(ref);
  const thumbUrl = fileUrl || savedUrl;
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  const pickFile = (f?: File) => {
    if (!f) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(f); setFileUrl(URL.createObjectURL(f)); setCrop(undefined); setCropOpen(true);
  };

  const build = (imgId?: string): Widget => ({
    id: initial?.id ?? newId(),
    title: title.trim(), platform,
    shareUrl: shareUrl.trim() || undefined, sub: sub.trim() || undefined, note: note.trim() || undefined,
    tags: parseTags(tagsText), visibility, showCode, mode,
    imgId, crop: imgId ? crop : undefined,
    previewHeight: Number(previewHeight) > 0 ? Math.round(Number(previewHeight)) : undefined,
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    ...(platform === 'caveduck' ? {
      states: states.filter(s => s.key.trim()).map(s => ({ key: s.key.trim(), instruction: s.instruction.trim(), example: s.example?.trim() || undefined })),
      html, userName: userName.trim() || undefined, charName: charName.trim() || undefined,
    } : {}),
    ...(platform === 'teapot' ? {
      componentName: componentName.trim() || teapotName({ jsx }) || undefined,
      displayName: displayName.trim() || undefined, description: description.trim() || undefined,
      jsx, props: props.filter(p => p.name.trim()),
    } : {}),
    ...(platform === 'etc' ? { html } : {}),
  });

  // 작동 예시 — 칠 때마다 상자를 새로 띄우면(티팟은 Babel까지 다시) 버벅이니 잠깐 멈췄을 때만 갱신
  const draft = build(ref);
  const draftKey = JSON.stringify([platform, html, states, userName, charName, jsx, props, componentName, previewHeight]);
  const [shown, setShown] = useState<Widget>(draft);
  useEffect(() => {
    const t = setTimeout(() => setShown(build(ref)), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // HTML에는 있는데 상태값 표에 없는 키
  const missingKeys = useMemo(() => {
    const have = new Set(states.map(s => s.key.trim()));
    return placeholdersOf(html).filter(k => k !== 'user' && k !== 'char' && !have.has(k));
  }, [html, states]);

  const applyPaste = () => {
    const r = parseCaveduckCopy(pasteText);
    if (!r.states.length && !r.html) { toast('상태값이나 위젯 콘텐츠를 찾지 못했어요 — 케이브덕 위젯 편집 화면을 통째로 복사해 붙여 주세요'); return; }
    // 이미 적어 둔 예시 값은 키가 같으면 살린다
    const ex = new Map(states.map(s => [s.key, s.example]));
    if (r.states.length) setStates(r.states.map(s => ({ ...s, example: ex.get(s.key) })));
    if (r.html) setHtml(r.html);
    setPasteOpen(false); setPasteText('');
    toast(`상태값 ${r.states.length}개${r.html ? ' · 위젯 콘텐츠' : ''}를 채웠어요`);
  };

  const setState = (i: number, p: Partial<CaveState>) => setStates(a => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setProp = (i: number, p: Partial<TeapotProp>) => setProps(a => a.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const submit = async () => {
    if (!title.trim()) { toast('위젯 이름을 입력해 주세요'); return; }
    if (live && platform === 'teapot' && jsx.trim() && !teapotName({ componentName, jsx })) { toast('컴포넌트 이름을 찾지 못했어요 — 컴포넌트 이름 칸을 채워 주세요'); return; }
    setBusy(true);
    try {
      const imgId = file ? await putBlob(file) : ref;
      await onSave(build(imgId));
    } finally { setBusy(false); }
  };

  const [pvBg, setPvBg] = useState<'light' | 'dark'>('light');

  return (
    <div className="panel wf" style={{ padding: 20 }}>
      <style>{`
        .wf-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start}
        .wf-side{position:sticky;top:80px}
        @media (max-width:900px){.wf-grid{grid-template-columns:1fr}.wf-side{position:static}}
        .wf-tbl{display:grid;gap:6px}
        .wf-row{display:grid;gap:6px;align-items:center}
        .wf-row.cave{grid-template-columns:90px minmax(0,1.3fr) minmax(0,1fr) 26px}
        .wf-row.prop{grid-template-columns:110px 92px minmax(0,1fr) minmax(0,1fr) 26px}
        .wf-row .x{border:0;background:transparent;color:var(--faint);cursor:var(--cur-pointer,pointer);font-size:14px}
        .wf-row .x:hover{color:#a63a45}
        .wf-head{font-size:10.5px;color:var(--faint);letter-spacing:.04em}
        @media (max-width:620px){.wf-row.cave,.wf-row.prop{grid-template-columns:1fr 1fr}.wf-row .x{justify-self:end}}
      `}</style>
      <div className="wf-grid">
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {PLATFORMS.map(p => (
              <button key={p} className={`btn ${platform === p ? 'btn-dark' : 'btn-ghost'}`} style={{ fontSize: 12, padding: '5px 14px' }}
                onClick={() => setPlatform(p)}>{PLATFORM_LABEL[p]}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {([['simple', '간단 등록', '공유 링크 + 스크린샷·GIF만'], ['live', '작동 예시까지', '코드를 붙여 넣어 직접 눌러 볼 수 있게']] as const).map(([m, t, d]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{
                  textAlign: 'left', padding: '9px 12px', borderRadius: 10, cursor: 'var(--cur-pointer,pointer)',
                  border: mode === m ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                  background: mode === m ? 'var(--panel-solid, #fff)' : 'transparent',
                }}>
                <b style={{ display: 'block', fontSize: 12.5, color: 'var(--ink)' }}>{mode === m ? '● ' : '○ '}{t}</b>
                <small style={{ fontSize: 11, color: 'var(--faint)' }}>{d}</small>
              </button>
            ))}
          </div>
          <KInput placeholder="위젯 이름" value={title} onChange={e => setTitle(e.target.value)} />
          <KInput placeholder="한 줄 소개 (목록에 표시)" value={sub} onChange={e => setSub(e.target.value)} />
          <KInput placeholder={platform === 'teapot' ? '공유 링크 (예: https://teapotchat.com/shared/…)' : platform === 'caveduck' ? '공유 링크 (예: https://caveduck.io/ko/widgets/share/…)' : '공유 링크'}
            value={shareUrl} onChange={e => setShareUrl(e.target.value)} />
          <textarea className="k-textarea" placeholder="설명·사용법 (선택 — 상세 화면에 표시)" value={note} onChange={e => setNote(e.target.value)}
            style={{ minHeight: 70, resize: 'vertical' }} />
          <TagInput value={tagsText} onChange={setTagsText} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <KSelect value={visibility} onChange={v => setVisibility(v as Visibility)}
              options={[{ value: 'public', label: '전체공개' }, { value: 'member', label: '멤버공개' }, { value: 'private', label: '나만보기' }]} />
            {live && <KCheck checked={showCode} onChange={setShowCode}
              label={platform === 'teapot' ? '코드·Props를 방문자에게도 보여 주기' : '코드·상태값을 방문자에게도 보여 주기'} />}
          </div>

          {/* 썸네일 */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div {...fileDrop(fl => pickFile(fl[0]))}
              onClick={() => (thumbUrl ? setCropOpen(true) : document.getElementById('widget-thumb-in')?.click())}
              style={{ width: 128, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer', flex: 'none' }}>
              {thumbUrl ? <CropImg src={thumbUrl} crop={crop} /> : <div className="ph" style={{ width: '100%', height: '100%' }}><span style={{ fontSize: 10 }}>16:9</span></div>}
            </div>
            <input id="widget-thumb-in" type="file" accept="image/*" hidden onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            <div style={{ display: 'grid', gap: 4 }}>
              <span className="hint" style={{ margin: 0 }}>{live
                ? '목록 썸네일 (선택) — 없으면 케이브덕은 작동 예시를 작게, 티팟은 컴포넌트 이름을 보여 줘요'
                : '대표 이미지 — 스크린샷이나 GIF. 상세 화면에는 자르지 않은 원본이 크게, 목록에는 16:9로 잘라 보여 줘요'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" style={small} onClick={() => document.getElementById('widget-thumb-in')?.click()}>이미지</button>
                {thumbUrl && <button className="btn btn-ghost" style={small} onClick={() => { setFile(null); setFileUrl(''); setRef(undefined); setCrop(undefined); }}>제거</button>}
              </div>
            </div>
          </div>

          {/* ---------- 케이브덕 ---------- */}
          {live && platform === 'caveduck' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
                <div style={label}>상태값 · 지시사항 · 예시 값 ({states.length})</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-dark" style={small} onClick={() => setPasteOpen(true)}>편집 화면 붙여넣기로 채우기</button>
                  <button className="btn btn-ghost" style={small} onClick={() => setStates(a => [...a, { key: '', instruction: '' }])}>＋ 상태값</button>
                </div>
              </div>
              <p className="hint" style={{ margin: 0 }}>예시 값은 홈페이지 미리보기에서만 쓰여요 — 비워 두면 그 자리에 상태값 이름이 그대로 보여요.</p>
              {states.length > 0 && (
                <div className="wf-tbl">
                  <div className="wf-row cave wf-head"><span>상태값</span><span>지시사항</span><span>예시 값 (미리보기)</span><span /></div>
                  {states.map((s, i) => (
                    <div key={i} className="wf-row cave">
                      <KInput value={s.key} placeholder="이름" onChange={e => setState(i, { key: e.target.value })} />
                      <KInput value={s.instruction} placeholder="지시사항" onChange={e => setState(i, { instruction: e.target.value })} />
                      <KInput value={s.example ?? ''} placeholder="예: 72%" onChange={e => setState(i, { example: e.target.value })} />
                      <button className="x" aria-label="삭제" onClick={() => setStates(a => a.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {missingKeys.length > 0 && (
                <div className="hint" style={{ margin: 0 }}>
                  HTML에 있는데 표에 없는 상태값: {missingKeys.map(k => `{{${k}}}`).join(' ')}{' '}
                  <button className="btn btn-ghost" style={small} onClick={() => setStates(a => [...a, ...missingKeys.map(k => ({ key: k, instruction: '' }))])}>표에 추가</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <KInput placeholder="{{user}} 자리 (기본: 유저)" value={userName} onChange={e => setUserName(e.target.value)} style={{ flex: 1 }} />
                <KInput placeholder="{{char}} 자리 (기본: 캐릭터)" value={charName} onChange={e => setCharName(e.target.value)} style={{ flex: 1 }} />
              </div>
              <div style={label}>위젯 콘텐츠 (HTML)</div>
              <textarea className="k-textarea" value={html} onChange={e => setHtml(e.target.value)} spellCheck={false}
                placeholder={'<div style="…">📅 {{날짜}} · 💗 {{호감도}}</div>'} style={codeArea} />
            </>
          )}

          {/* ---------- 티팟 ---------- */}
          {live && platform === 'teapot' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <KInput placeholder={`컴포넌트 이름 (비우면 코드에서: ${teapotName({ jsx }) || 'PascalCase'})`} value={componentName}
                  onChange={e => setComponentName(e.target.value)} style={{ flex: 1 }} />
                <KInput placeholder="표시 이름" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ flex: 1 }} />
              </div>
              <textarea className="k-textarea" placeholder="설명 — AI가 이 컴포넌트를 언제 호출하는지" value={description}
                onChange={e => setDescription(e.target.value)} style={{ minHeight: 60, resize: 'vertical' }} />
              <div style={label}>JSX 코드</div>
              <textarea className="k-textarea" value={jsx} onChange={e => setJsx(e.target.value)} spellCheck={false}
                placeholder={'function StatusBoard({ title = "전투", hp = 45, maxHp = 100 }) {\n  return <div>{title} {hp}/{maxHp}</div>;\n}'} style={codeArea} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={label}>Props ({props.length})</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-dark" style={small} onClick={() => {
                    const found = propsFromJsx(jsx);
                    if (!found.length) { toast('코드의 함수 시그니처에서 Props를 찾지 못했어요'); return; }
                    // 이미 적어 둔 예시·설명은 이름이 같으면 살린다
                    const old = new Map(props.map(p => [p.name, p]));
                    setProps(found.map(p => ({ ...p, ...(old.get(p.name) ? { type: old.get(p.name)!.type, example: old.get(p.name)!.example || p.example, description: old.get(p.name)!.description } : {}) })));
                    toast(`Props ${found.length}개를 불러왔어요`);
                  }}>코드에서 Props 불러오기</button>
                  <button className="btn btn-ghost" style={small} onClick={() => setProps(a => [...a, { name: '', type: 'string', example: '' }])}>＋ Prop</button>
                </div>
              </div>
              {props.length > 0 && (
                <div className="wf-tbl">
                  <div className="wf-row prop wf-head"><span>이름</span><span>타입</span><span>예시값 (미리보기)</span><span>설명</span><span /></div>
                  {props.map((p, i) => (
                    <div key={i} className="wf-row prop">
                      <KInput value={p.name} placeholder="camelCase" onChange={e => setProp(i, { name: e.target.value })} />
                      <KSelect value={p.type} onChange={v => setProp(i, { type: v as TeapotPropType })}
                        options={[{ value: 'string', label: '문자열' }, { value: 'number', label: '숫자' }, { value: 'boolean', label: '불리언' }]} />
                      <KInput value={p.example} placeholder="예시값" onChange={e => setProp(i, { example: e.target.value })} />
                      <KInput value={p.description ?? ''} placeholder="설명" onChange={e => setProp(i, { description: e.target.value })} />
                      <button className="x" aria-label="삭제" onClick={() => setProps(a => a.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---------- 기타 ---------- */}
          {live && platform === 'etc' && (
            <>
              <div style={label}>위젯 HTML</div>
              <textarea className="k-textarea" value={html} onChange={e => setHtml(e.target.value)} spellCheck={false} style={codeArea} />
            </>
          )}
        </div>

        {/* 간단 등록 — 대표 이미지 원본 미리보기 */}
        {!live && (
          <div className="wf-side" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <div style={label}>상세 화면 미리보기</div>
            {thumbUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={thumbUrl} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)', margin: '0 auto' }} />
              : <div className="hint" style={{ padding: 30, textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>왼쪽에서 스크린샷이나 GIF를 올리면 상세 화면에 이렇게 크게 나와요</div>}
          </div>
        )}
        {/* 작동 예시 */}
        {live && <div className="wf-side" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={label}>작동 예시 미리보기</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className={`btn ${pvBg === 'light' ? 'btn-dark' : 'btn-ghost'}`} style={small} onClick={() => setPvBg('light')}>밝게</button>
              <button className={`btn ${pvBg === 'dark' ? 'btn-dark' : 'btn-ghost'}`} style={small} onClick={() => setPvBg('dark')}>어둡게</button>
            </div>
          </div>
          {(platform === 'teapot' ? jsx.trim() : html.trim())
            ? <WidgetPreview widget={shown} bg={pvBg} maxHeight={720} />
            : <div className="hint" style={{ padding: 30, textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>{platform === 'teapot' ? 'JSX 코드를 넣으면 여기서 바로 작동해요' : '위젯 콘텐츠(HTML)를 넣으면 여기서 바로 작동해요'}</div>}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="hint" style={{ margin: 0 }}>상자 높이 고정(px, 선택)</span>
            <KInput value={previewHeight} onChange={e => setPreviewHeight(e.target.value.replace(/[^\d]/g, ''))} placeholder="자동" style={{ width: 90 }} />
          </div>
        </div>}
      </div>

      <div className="form-actions" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={onCancel}>CANCEL</button>
        <button className="btn btn-dark" onClick={submit} disabled={busy}>{initial ? 'SAVE' : 'ADD'}</button>
      </div>

      <Modal open={pasteOpen} title="케이브덕 편집 화면 붙여넣기" desc="케이브덕 위젯 편집 화면을 전체 선택(Ctrl+A)해 복사한 뒤 여기에 붙여 넣으면, 상태값·지시사항·위젯 콘텐츠를 나눠서 채워요."
        onClose={() => setPasteOpen(false)}
        actions={<>
          <button className="btn btn-ghost" onClick={() => setPasteOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={applyPaste}>채우기</button>
        </>}>
        <textarea className="k-textarea" value={pasteText} onChange={e => setPasteText(e.target.value)} spellCheck={false}
          placeholder={'상태값\n1\n지시사항\n턴수\n…\n위젯 콘텐츠\n<div …>'} style={{ ...codeArea, height: 300 }} />
      </Modal>

      {thumbUrl && <CropEditor open={cropOpen} src={thumbUrl} aspect="16:9" initial={crop}
        onClose={() => setCropOpen(false)} onApply={c => { setCrop(c); setCropOpen(false); }} />}
    </div>
  );
}
