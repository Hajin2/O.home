'use client';
// 위젯 상세 (포크 기능)
//  ① 머리 카드 — 플랫폼·공개범위 · 이름 · 소개 · 태그 · 요약(상태값/Props 수·등록일) · [공유 링크로 가져가기] · 관리 버튼
//  ② 작동 예시 무대 — 창틀 모양 · PC/모바일 폭 · 밝게/어둡게 · 높이는 위젯에 맞춰 늘고 줄어든다
//     (간단 등록이면 대표 이미지를 자르지 않고)
//  ③ 설명 · (티팟) 채팅에서 부르는 태그 예시 · 상태값/Props 표 · 코드
// 코드·상태값/Props·호출 태그는 「방문자에게도 보여 주기」를 켠 위젯만 방문자에게 보인다 (관리자는 항상)
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useVisibleWidgets, PLATFORM_LABEL, PLATFORM_TINT, isLive, type Widget } from '@/lib/widgetStore';
import { useBlobUrl } from '@/lib/blobStore';
import { TagList } from '@/components/ui/TagList';
import { PageTitle } from '@/components/ui/PageText';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { WidgetPreview, teapotName } from '@/components/widgets/WidgetPreview';

const CSS = `
.wd{max-width:900px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
.wd > *{min-width:0}
.wd-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--sh-sm)}
.wd-hero{padding:22px 24px 18px}
.wd-pills{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.wd-pills .pill{font-weight:600}
.wd-title{margin:0;font-size:calc(24px*var(--fs,1));line-height:1.3;color:var(--ink);word-break:keep-all;letter-spacing:-.01em}
.wd-sub{margin:6px 0 0;color:var(--sub);font-size:calc(13.5px*var(--fs,1));line-height:1.6}
.wd-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}
.wd-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--faint)}
.wd-meta b{color:var(--sub);font-weight:600}
.wd-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.wd-cta{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 18px;border-radius:999px;font-weight:700;font-size:13px;text-decoration:none}
.wd-mini{border:1px solid var(--line);background:transparent;color:var(--faint);height:30px;padding:0 12px;border-radius:999px;font-size:11.5px;cursor:var(--cur-pointer,pointer);transition:.15s}
.wd-mini:hover{color:var(--ink);border-color:var(--sub)}
.wd-mini.del:hover{color:#a63a45;border-color:#a63a45}
.wd-stage{overflow:hidden}
.wd-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.wd-dots{display:flex;gap:6px;align-items:center}
.wd-dots i{width:10px;height:10px;border-radius:50%;display:block}
.wd-bar-t{font-size:12px;font-weight:700;color:var(--sub);letter-spacing:.04em;margin-left:8px}
.wd-seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}
.wd-seg button{border:0;background:transparent;color:var(--faint);font-size:11.5px;padding:5px 12px;cursor:var(--cur-pointer,pointer)}
.wd-seg button.on{background:var(--btn-dark,var(--ink));color:var(--btn-dark-fg,#fff)}
.wd-floor{padding:22px 16px;transition:background .2s}
.wd-floor.light{background:#eef0f3;background-image:radial-gradient(rgba(0,0,0,.06) 1px,transparent 1px);background-size:14px 14px}
.wd-floor.dark{background:#16181d;background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);background-size:14px 14px}
.wd-hint{font-size:11.5px;color:var(--faint);padding:10px 14px;border-top:1px solid var(--line);line-height:1.6}
.wd-sec{overflow:hidden}
.wd-sec > summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;cursor:var(--cur-pointer,pointer);font-weight:700;font-size:13px;color:var(--ink)}
.wd-sec > summary::-webkit-details-marker{display:none}
.wd-sec > summary .ar{transition:transform .2s;color:var(--faint);font-size:11px}
.wd-sec[open] > summary .ar{transform:rotate(90deg)}
.wd-sec > summary small{font-weight:400;color:var(--faint);font-size:11.5px}
.wd-body{padding:0 18px 16px}
.wd-note{padding:16px 20px;white-space:pre-wrap;font-size:13px;line-height:1.8;color:var(--sub)}
.wd-label{display:block;font-size:11px;font-weight:700;color:var(--faint);letter-spacing:.06em;margin-bottom:6px}
.wd-tbl{width:100%;border-collapse:collapse}
.wd-tbl th{text-align:left;font-size:11px;color:var(--faint);font-weight:600;padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.wd-tbl td{font-size:12.5px;color:var(--sub);padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;word-break:break-word}
.wd-tbl tr:last-child td{border-bottom:0}
.wd-tbl code{font-size:11.5px;background:rgba(127,127,127,.12);padding:1px 6px;border-radius:5px;white-space:nowrap}
.wd-code{position:relative}
.wd-code pre{margin:0;padding:14px 16px;max-height:460px;overflow:auto;background:#1d2026;color:#e6e8ee;border-radius:10px;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;white-space:pre}
.wd-code .cp{position:absolute;top:8px;right:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#e6e8ee;
  font-size:11px;padding:4px 10px;border-radius:999px;cursor:var(--cur-pointer,pointer)}
.wd-code .cp:hover{background:rgba(255,255,255,.18)}
@media (max-width:620px){.wd-seg.w{display:none}.wd-acts{width:100%}.wd-hero{padding:18px 16px 14px}.wd-title{font-size:calc(20px*var(--fs,1))}.wd-floor{padding:14px 8px}.wd-cta{width:100%;justify-content:center}}
`;

function CodeBlock({ code }: { code: string }) {
  const toast = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast('복사했어요'); }
    catch { toast('복사하지 못했어요 — 직접 선택해 복사해 주세요'); }
  };
  return (
    <div className="wd-code">
      <button className="cp" onClick={copy}>복사</button>
      <pre>{code}</pre>
    </div>
  );
}

/** 티팟 — 채팅에서 AI가 부르는 태그 예시 (Props 예시값으로) */
function callTag(w: Widget): string {
  const name = teapotName(w);
  if (!name) return '';
  const attrs = (w.props ?? []).filter(p => p.name.trim()).map(p => {
    const v = p.example ?? '';
    if (p.type === 'number') return `${p.name}={${v.trim() === '' ? 0 : Number(v)}}`;
    if (p.type === 'boolean') return `${p.name}={${/^(true|1|yes|on|예|참)$/i.test(v.trim())}}`;
    return `${p.name}="${v.replace(/"/g, '&quot;')}"`;
  });
  return attrs.length > 2 ? `<${name}\n  ${attrs.join('\n  ')}\n/>` : `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''} />`;
}

export default function WidgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const del = useConfirmDelete();
  const widgets = useVisibleWidgets();
  const [bg, setBg] = useState<'light' | 'dark'>('light');
  const [phone, setPhone] = useState(false);
  const w0 = widgets.visible.find(x => x.id === id);
  const imgUrl = useBlobUrl(w0?.imgId);   // 간단 등록 — 대표 이미지 원본 (훅이라 early return보다 먼저)

  if (!widgets.loaded) return <section className="page" />;
  const w = w0;
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
  const adminOnly = !w.showCode;   // 관리자에게만 보이는 칸 표시
  const code = w.platform === 'teapot' ? (w.jsx ?? '') : (w.html ?? '');
  const tag = w.platform === 'teapot' ? callTag(w) : '';
  const stateN = w.states?.length ?? 0;
  const propN = w.props?.length ?? 0;

  const remove = () => del.ask(`「${w.title}」 위젯을 삭제할까요?`, async () => {
    await widgets.save(widgets.list.filter(x => x.id !== w.id));
    toast('삭제되었습니다');
    router.push('/widgets');
  }, '삭제하면 복구할 수 없습니다. 플랫폼에 올린 원본은 그대로예요.');

  return (
    <section className="page">
      <style>{CSS}</style>
      <div className="page-head"><PageTitle href="/widgets">WIDGETS</PageTitle></div>
      {del.element}
      <div className="wd">
        {/* ① 머리 카드 */}
        <div className="wd-card wd-hero">
          <div className="wd-pills">
            <span className="pill" style={{ background: PLATFORM_TINT[w.platform], border: 0, color: '#2d3436' }}>{PLATFORM_LABEL[w.platform]}</span>
            {w.visibility !== 'public' && <span className="pill">{w.visibility === 'member' ? '멤버공개' : '나만보기'}</span>}
            {w.platform === 'teapot' && teapotName(w) && <code style={{ fontSize: 12, color: 'var(--faint)' }}>{`<${teapotName(w)} />`}</code>}
          </div>
          <h2 className="wd-title">{w.title}</h2>
          {w.sub && <p className="wd-sub">{w.sub}</p>}
          {w.tags && w.tags.length > 0 && <TagList tags={w.tags} href="/widgets" style={{ marginTop: 10 }} />}
          <div className="wd-foot">
            <div className="wd-meta">
              {w.platform === 'caveduck' && live && stateN > 0 && <span>상태값 <b>{stateN}</b>개</span>}
              {w.platform === 'teapot' && live && propN > 0 && <span>Props <b>{propN}</b>개</span>}
              <span>{live ? '작동 예시' : '이미지 소개'}</span>
              {w.date && <span>{w.date.replace(/-/g, '.')} 등록</span>}
            </div>
            <div className="wd-acts">
              {isAdmin && <button className="wd-mini" onClick={() => router.push(`/widgets/${w.id}/edit`)}>수정</button>}
              {isAdmin && <button className="wd-mini del" onClick={remove}>삭제</button>}
              {w.shareUrl && (
                <a className="btn btn-dark wd-cta" href={w.shareUrl} target="_blank" rel="noopener noreferrer">
                  {PLATFORM_LABEL[w.platform]}에서 가져가기 <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ② 작동 예시 무대 (간단 등록이면 대표 이미지) */}
        {live ? (
          <div className="wd-card wd-stage">
            <div className="wd-bar">
              <div className="wd-dots">
                <i style={{ background: '#ff6159' }} /><i style={{ background: '#ffbd2e' }} /><i style={{ background: '#28c941' }} />
                <span className="wd-bar-t">작동 예시</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div className="wd-seg w" role="group" aria-label="폭">
                  <button className={!phone ? 'on' : ''} onClick={() => setPhone(false)}>넓게</button>
                  <button className={phone ? 'on' : ''} onClick={() => setPhone(true)}>휴대폰</button>
                </div>
                <div className="wd-seg" role="group" aria-label="바탕">
                  <button className={bg === 'light' ? 'on' : ''} onClick={() => setBg('light')}>밝게</button>
                  <button className={bg === 'dark' ? 'on' : ''} onClick={() => setBg('dark')}>어둡게</button>
                </div>
              </div>
            </div>
            <div className={`wd-floor ${bg}`}>
              <WidgetPreview widget={w} bg={bg} bare width={phone ? 390 : undefined} minHeight={60} />
            </div>
            <div className="wd-hint">
              {w.platform === 'caveduck' ? '값은 예시예요 — 실제 채팅에서는 AI가 대화에 맞춰 채워요. 접고 펴기·스와이프도 그대로 눌러 볼 수 있어요.'
                : w.platform === 'teapot' ? '값은 Props 예시값이에요 — 실제 채팅에서는 AI가 넣어 불러요. 「채팅으로 보내기」 같은 버튼은 여기선 알림만 떠요.'
                : '사이트와 분리된 상자 안에서 그대로 작동해요.'}
            </div>
          </div>
        ) : imgUrl ? (
          <div className="wd-card wd-stage">
            <div className={`wd-floor ${bg}`} style={{ display: 'grid', placeItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt={`${w.title} 미리보기`} style={{ display: 'block', maxWidth: '100%', borderRadius: 10, boxShadow: '0 10px 30px -12px rgba(0,0,0,.35)' }} />
            </div>
          </div>
        ) : null}

        {/* ③ 설명 */}
        {w.note && (
          <div className="wd-card wd-note">
            <span className="wd-label">설명</span>{w.note}
          </div>
        )}

        {w.platform === 'teapot' && live && w.description && (
          <div className="wd-card wd-note">
            <span className="wd-label">AI가 부르는 때</span>{w.description}
          </div>
        )}

        {canCode && w.platform === 'teapot' && tag && (
          <div className="wd-card" style={{ padding: '16px 18px' }}>
            <span className="wd-label">채팅에서 이렇게 불러요{adminOnly && ' · 관리자만 보임'}</span>
            <CodeBlock code={tag} />
          </div>
        )}

        {canCode && w.platform === 'caveduck' && stateN > 0 && (
          <details className="wd-card wd-sec">
            <summary><span>상태값 · 지시사항 <small>{stateN}개{adminOnly && ' · 관리자만 보임'}</small></span><span className="ar">▶</span></summary>
            <div className="wd-body" style={{ overflowX: 'auto' }}>
              <table className="wd-tbl">
                <thead><tr><th>상태값</th><th>지시사항</th><th>예시 값</th></tr></thead>
                <tbody>{w.states!.map(s => (
                  <tr key={s.key}><td><code>{`{{${s.key}}}`}</code></td><td>{s.instruction}</td><td>{s.example}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        )}

        {canCode && w.platform === 'teapot' && propN > 0 && (
          <details className="wd-card wd-sec">
            <summary><span>Props <small>{propN}개{adminOnly && ' · 관리자만 보임'}</small></span><span className="ar">▶</span></summary>
            <div className="wd-body" style={{ overflowX: 'auto' }}>
              <table className="wd-tbl">
                <thead><tr><th>이름</th><th>타입</th><th>예시값</th><th>설명</th></tr></thead>
                <tbody>{w.props!.map(p => (
                  <tr key={p.name}><td><code>{p.name}</code></td><td>{p.type}</td><td>{p.example}</td><td>{p.description}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        )}

        {canCode && code.trim() && (
          <details className="wd-card wd-sec">
            <summary><span>{w.platform === 'teapot' ? 'JSX 코드' : '위젯 콘텐츠 (HTML)'} <small>{code.length.toLocaleString()}자{adminOnly && ' · 관리자만 보임'}</small></span><span className="ar">▶</span></summary>
            <div className="wd-body"><CodeBlock code={code} /></div>
          </details>
        )}
      </div>
    </section>
  );
}
