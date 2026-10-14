'use client';
// 세계관 등록/수정 폼 — 이름·한 줄 소개·커버(1:1)·문서 탭(각 탭 HTML 에디터)·태그·공개범위
// 편집 회원(세계관 편집 권한): 공개범위와 편집 회원 칸은 관리자에게만 보인다. 편집 회원이 저장하면
// 두 값과 작성자는 원래 값 그대로 저장된다 (서버 규칙도 바꾸지 못하게 막는다).
import React, { useEffect, useState } from 'react';
import type { Visibility, CharGrant } from '@/lib/charStore';
import type { World, WorldTab } from '@/lib/worldStore';
import { newId } from '@/lib/postStore';
import { putBlob, getBlob, useBlobUrl } from '@/lib/blobStore';
import { KInput, KSelect } from '@/components/ui/Kit';
import { CropEditor, CropValue, CropImg } from '@/components/ui/CropEditor';
import { HtmlRichEditor } from '@/components/ui/HtmlRichEditor';
import { TagInput } from '@/components/ui/TagInput';
import { parseTags } from '@/lib/tagUtil';
import { fileDrop } from '@/lib/dnd';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { WorldEditorsEditor } from '@/components/worlds/WorldEditorsEditor';

export function WorldForm({ initial, onSave, onCancel }: {
  initial: World | null;
  onSave: (w: World) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const [grants, setGrants] = useState<CharGrant[]>(initial?.grants ?? []);
  const [name, setName] = useState(initial?.name ?? '');
  const [sub, setSub] = useState(initial?.sub ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '));
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? 'public');
  const [tabs, setTabs] = useState<WorldTab[]>(initial?.tabs?.length ? initial.tabs : [{ id: newId(), title: '개요', html: '' }]);
  const [cur, setCur] = useState(0);
  // 커버: 새 파일(file) 또는 저장된 blob(ref)
  const [ref, setRef] = useState<string | undefined>(initial?.imgId);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [crop, setCrop] = useState<CropValue | undefined>(initial?.crop);
  const [cropOpen, setCropOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const savedUrl = useBlobUrl(ref);
  const coverUrl = fileUrl || savedUrl;

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  const pickFile = (f?: File) => {
    if (!f) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(f); setFileUrl(URL.createObjectURL(f)); setCrop(undefined); setCropOpen(true);
  };
  const removeCover = () => { setFile(null); setFileUrl(''); setRef(undefined); setCrop(undefined); };

  const setTab = (i: number, patch: Partial<WorldTab>) => setTabs(t => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addTab = () => { setTabs(t => [...t, { id: newId(), title: `탭 ${t.length + 1}`, html: '' }]); setCur(tabs.length); };
  const delTab = (i: number) => {
    if (tabs.length <= 1) { toast('탭은 하나 이상 필요해요'); return; }
    if (!window.confirm(`「${tabs[i].title || '제목 없음'}」 탭을 삭제할까요?`)) return;
    setTabs(t => t.filter((_, j) => j !== i)); setCur(c => Math.max(0, Math.min(c, tabs.length - 2)));
  };
  const moveTab = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= tabs.length) return;
    setTabs(t => { const n = [...t]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    setCur(j);
  };

  const submit = async () => {
    if (!name.trim()) { toast('세계관 이름을 입력해 주세요'); return; }
    setBusy(true);
    try {
      const imgId = file ? await putBlob(file) : ref;
      onSave({
        id: initial?.id ?? newId(),
        name: name.trim(), sub: sub.trim() || undefined, label: label.trim() || undefined,
        imgId, crop: imgId ? crop : undefined,
        tabs, tags: parseTags(tagsText), visibility,
        date: initial?.date ?? new Date().toISOString().slice(0, 10),
        // 작성자는 처음 값을 그대로 — 없으면(예전 세계관) 지금 저장하는 관리자로 채운다
        authorId: initial?.authorId ?? (isAdmin ? user?.id : undefined),
        // 편집 회원 목록·공개범위는 관리자만 바꾼다 — 편집 회원이 저장할 때는 원래 값 유지
        ...(isAdmin
          ? { grants: grants.length ? grants : undefined }
          : { grants: initial?.grants, visibility: initial?.visibility ?? visibility }),
      });
    } finally { setBusy(false); }
  };

  const t = tabs[Math.min(cur, tabs.length - 1)];
  return (
    <div className="panel" style={{ display: 'grid', gap: 14, padding: 20 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 120, flex: 'none' }}>
          <div className="thumb" {...fileDrop(fl => pickFile(fl[0]))}
            style={{ width: 120, height: 120, position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--line)' }}
            onClick={() => (coverUrl ? setCropOpen(true) : document.getElementById('world-cover-in')?.click())}>
            {coverUrl ? <CropImg src={coverUrl} crop={crop} /> : <div className="ph" style={{ width: '100%', height: '100%' }}><span>1:1 커버</span></div>}
          </div>
          <input id="world-cover-in" type="file" accept="image/*" hidden onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => document.getElementById('world-cover-in')?.click()}>이미지</button>
            {coverUrl && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={removeCover}>제거</button>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 8 }}>
          <KInput placeholder="세계관 이름" value={name} onChange={e => setName(e.target.value)} />
          <KInput placeholder="한 줄 소개 (목록에 표시)" value={sub} onChange={e => setSub(e.target.value)} />
          <KInput placeholder="목록 오른쪽 글자 (비우면 VIEW)" value={label} onChange={e => setLabel(e.target.value)} />
          <TagInput value={tagsText} onChange={setTagsText} />
          {isAdmin && <>
          <KSelect value={visibility} onChange={v => setVisibility(v as Visibility)}
            options={[
              { value: 'public', label: '전체공개' },
              { value: 'member', label: '멤버공개' },
              { value: 'private', label: '나만보기' },
            ]} />
          <p className="hint" style={{ margin: 0 }}>공개범위는 서버에서 지켜져요 — 나만보기는 다른 사람에게 목록·주소·캐릭터 수 모두 보이지 않습니다.</p>
          </>}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {tabs.map((x, i) => (
            <button key={x.id} className={`btn ${i === cur ? 'btn-dark' : 'btn-ghost'}`} style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={() => setCur(i)}>{x.title || '제목 없음'}</button>
          ))}
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} onClick={addTab}>＋ 탭</button>
        </div>
        {t && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <KInput placeholder="탭 제목 (예: 개요 · 등장인물 · 용어)" value={t.title} onChange={e => setTab(cur, { title: e.target.value })} style={{ flex: 1 }} />
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => moveTab(cur, -1)} disabled={cur === 0}>←</button>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => moveTab(cur, 1)} disabled={cur === tabs.length - 1}>→</button>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => delTab(cur)}>탭 삭제</button>
            </div>
            <HtmlRichEditor key={t.id} value={t.html} onChange={html => setTab(cur, { html })}
              placeholder="세계관 문서를 작성하세요 — 표·카드는 HTML 모드에서 코드를 붙여넣을 수 있어요" />
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>편집 회원</div>
          <p className="hint" style={{ margin: 0 }}>
            추가한 회원은 이 세계관의 이름·소개·커버·문서 탭·태그를 고칠 수 있어요. 공개범위·편집 회원·삭제·정렬은 관리자만 할 수 있습니다.
            나만보기 세계관은 편집 회원에게도 보이지 않으니, 맡길 세계관은 멤버공개 이상으로 두세요.
          </p>
          <WorldEditorsEditor value={grants} onChange={setGrants} />
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>CANCEL</button>
        <button className="btn btn-dark" onClick={submit} disabled={busy}>{initial ? 'SAVE' : 'ADD'}</button>
      </div>

      {coverUrl && <CropEditor open={cropOpen} src={coverUrl} aspect="1:1" initial={crop}
        onClose={() => setCropOpen(false)} onApply={c => { setCrop(c); setCropOpen(false); }} />}
    </div>
  );
}
