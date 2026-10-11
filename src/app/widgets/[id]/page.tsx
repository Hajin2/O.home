'use client';
// 위젯 상세 (포크 기능) — 제목·플랫폼·소개·태그 · [공유 링크로 가져가기] · 작동 예시 · 설명
// 코드·상태값(케이브덕) / Props(티팟)는 「방문자에게도 보여 주기」를 켠 위젯만 방문자에게 보인다 (관리자는 항상)
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useVisibleWidgets, PLATFORM_LABEL, PLATFORM_TINT, isLive } from '@/lib/widgetStore';
import { useBlobUrl } from '@/lib/blobStore';
import { TagList } from '@/components/ui/TagList';
import { PageTitle } from '@/components/ui/PageText';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { WidgetPreview, teapotName } from '@/components/widgets/WidgetPreview';

const sec: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' };
const sum: React.CSSProperties = { padding: '12px 16px', cursor: 'var(--cur-pointer,pointer)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: 'var(--faint)', fontWeight: 600, padding: '6px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontSize: 12.5, color: 'var(--sub)', padding: '7px 10px', borderBottom: '1px solid var(--line)', verticalAlign: 'top', wordBreak: 'break-word' };

function CodeBlock({ code }: { code: string }) {
  const toast = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast('코드를 복사했어요'); }
    catch { toast('복사하지 못했어요 — 직접 선택해 복사해 주세요'); }
  };
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost" onClick={copy} style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, padding: '3px 10px', zIndex: 1 }}>코드 복사</button>
      <pre style={{
        margin: 0, padding: '14px 16px', maxHeight: 460, overflow: 'auto', background: '#1d2026', color: '#e6e8ee',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre',
      }}>{code}</pre>
    </div>
  );
}

export default function WidgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const del = useConfirmDelete();
  const widgets = useVisibleWidgets();
  const [bg, setBg] = useState<'light' | 'dark'>('light');
  const w0 = widgets.visible.find(x => x.id === id);
  const imgUrl = useBlobUrl(w0?.imgId);   // 간단 등록 — 대표 이미지 원본 (훅이라 early return보다 먼저)

  if (!widgets.loaded) return <section className="page" />;
  const w = widgets.visible.find(x => x.id === id);
  if (!w) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href="/widgets">WIDGETS</PageTitle></div>
        <div className="panel" style={{ maxWidth: 420, margin: '0 auto', padding: '34px 26px', display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 30, lineHeight: 1 }} aria-hidden>🔒</div>
          <p className="hint" style={{ margin: 0 }}>없는 위젯이거나 볼 수 있는 권한이 없어요</p>
          <button className="btn btn-ghost" onClick={() => router.push('/widgets')}>목록으로</button>
        </div>
      </section>
    );
  }

  const live = isLive(w);
  const canCode = live && (isAdmin || !!w.showCode);
  const code = w.platform === 'teapot' ? (w.jsx ?? '') : (w.html ?? '');

  return (
    <section className="page">
      <div className="page-head"><PageTitle href="/widgets">WIDGETS</PageTitle></div>
      {del.element}
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gap: 16 }}>
        {/* 머리 */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <span className="pill" style={{ background: PLATFORM_TINT[w.platform], border: 0, color: '#2d3436' }}>{PLATFORM_LABEL[w.platform]}</span>
              {w.visibility !== 'public' && <span className="pill">{w.visibility === 'member' ? '멤버공개' : '나만보기'}</span>}
              {w.platform === 'teapot' && teapotName(w) && <code style={{ fontSize: 12, color: 'var(--faint)' }}>{`<${teapotName(w)} />`}</code>}
            </div>
            <h2 style={{ margin: 0, fontSize: 'calc(22px*var(--fs,1))', color: 'var(--page-title, var(--ink))', wordBreak: 'keep-all' }}>{w.title}</h2>
            {w.sub && <p style={{ margin: '4px 0 0', color: 'var(--page-desc, var(--faint))', fontSize: 13 }}>{w.sub}</p>}
            {w.tags && w.tags.length > 0 && <TagList tags={w.tags} href="/widgets" style={{ marginTop: 8 }} />}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {w.shareUrl && (
              <a className="btn btn-dark" href={w.shareUrl} target="_blank" rel="noopener noreferrer">공유 링크로 가져가기 ↗</a>
            )}
            {isAdmin && <button className="btn btn-ghost" onClick={() => router.push(`/widgets/${w.id}/edit`)}>EDIT</button>}
            {isAdmin && (
              <button className="btn btn-ghost" onClick={() => del.ask(`「${w.title}」 위젯을 삭제할까요?`, async () => {
                await widgets.save(widgets.list.filter(x => x.id !== w.id));
                toast('삭제되었습니다');
                router.push('/widgets');
              }, '삭제하면 복구할 수 없습니다. 플랫폼에 올린 원본은 그대로예요.')}>DELETE</button>
            )}
          </div>
        </div>

        {/* 간단 등록 — 대표 이미지(스크린샷·GIF)를 자르지 않고 크게 */}
        {!live && imgUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imgUrl} alt={`${w.title} 미리보기`} style={{ display: 'block', maxWidth: '100%', margin: '0 auto', borderRadius: 12, border: '1px solid var(--line)' }} />
        )}
        {/* 작동 예시 */}
        {live && <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <b style={{ fontSize: 13, color: 'var(--page-title, var(--ink))' }}>작동 예시</b>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={`btn ${bg === 'light' ? 'btn-dark' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setBg('light')}>밝게</button>
              <button className={`btn ${bg === 'dark' ? 'btn-dark' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setBg('dark')}>어둡게</button>
            </div>
          </div>
          {code.trim()
            ? <WidgetPreview widget={w} bg={bg} />
            : <div className="hint" style={{ padding: 30, textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>등록된 위젯 코드가 없어요</div>}
          <p className="hint" style={{ margin: 0 }}>
            {w.platform === 'caveduck' ? '값은 예시예요 — 실제 채팅에서는 AI가 대화에 맞춰 채워요.'
              : w.platform === 'teapot' ? 'Props는 예시값이에요 — 실제 채팅에서는 AI가 값을 넣어 불러요. 채팅으로 보내기 같은 버튼은 여기선 알림만 떠요.'
              : '사이트와 분리된 상자 안에서 그대로 작동해요.'}
          </p>
        </div>}

        {w.note && (
          <div style={{ ...sec, padding: '14px 16px', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--sub)' }}>{w.note}</div>
        )}

        {/* 티팟 설명 */}
        {w.platform === 'teapot' && w.description && (
          <div style={{ ...sec, padding: '12px 16px', fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.6 }}>
            <b style={{ display: 'block', fontSize: 11, color: 'var(--faint)', marginBottom: 2 }}>AI 호출 설명</b>{w.description}
          </div>
        )}

        {canCode && w.platform === 'caveduck' && (w.states?.length ?? 0) > 0 && (
          <details style={sec}>
            <summary style={sum}>상태값 · 지시사항 ({w.states!.length}){!w.showCode && <small style={{ color: 'var(--faint)', fontWeight: 400 }}> — 관리자만 보임</small>}</summary>
            <div style={{ overflowX: 'auto', padding: '0 6px 8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>상태값</th><th style={th}>지시사항</th><th style={th}>예시 값</th></tr></thead>
                <tbody>{w.states!.map(s => (
                  <tr key={s.key}><td style={{ ...td, whiteSpace: 'nowrap' }}><code>{`{{${s.key}}}`}</code></td><td style={td}>{s.instruction}</td><td style={td}>{s.example}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        )}

        {canCode && w.platform === 'teapot' && (w.props?.length ?? 0) > 0 && (
          <details style={sec}>
            <summary style={sum}>Props ({w.props!.length}){!w.showCode && <small style={{ color: 'var(--faint)', fontWeight: 400 }}> — 관리자만 보임</small>}</summary>
            <div style={{ overflowX: 'auto', padding: '0 6px 8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>이름</th><th style={th}>타입</th><th style={th}>예시값</th><th style={th}>설명</th></tr></thead>
                <tbody>{w.props!.map(p => (
                  <tr key={p.name}><td style={{ ...td, whiteSpace: 'nowrap' }}><code>{p.name}</code></td><td style={td}>{p.type}</td><td style={td}>{p.example}</td><td style={td}>{p.description}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        )}

        {canCode && code.trim() && (
          <details style={sec}>
            <summary style={sum}>코드 보기{!w.showCode && <small style={{ color: 'var(--faint)', fontWeight: 400 }}> — 관리자만 보임</small>}</summary>
            <div style={{ padding: '0 12px 12px' }}><CodeBlock code={code} /></div>
          </details>
        )}
      </div>
    </section>
  );
}
