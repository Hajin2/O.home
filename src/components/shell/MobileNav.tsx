'use client';
// 폰 메뉴 (☰) — 포크 · 사용자 요청.
// 폰 폭(620px 이하)에서는 상단 메뉴 줄(.gnb)이 통째로 숨어서 다른 메뉴로 갈 길이 없었다.
// 로고 왼쪽에 ☰를 두고, 누르면 왼쪽에서 메뉴 패널이 나온다. 목록은 상단 바와 같은 buildMenu 결과
// (메뉴 관리의 순서·묶음·권한 그대로)를 받으므로 따로 설정할 것이 없다. PC에서는 버튼 자체가 안 보인다.
// 새 파일로 따로 둔 이유: 원작 저장소 업데이트(Sync fork)와 충돌하지 않게 (TopBar에서는 한 줄만 부른다).
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import type { MenuItem } from '@/lib/menu';

const CSS = `
.m-burger{display:none;width:34px;height:34px;margin-left:-6px;flex:none;place-items:center;background:transparent;color:var(--top-brand,#f2f3f5);cursor:var(--cur-pointer,pointer)}
.m-burger svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round}
@media (max-width:620px){.m-burger{display:grid}}
.m-nav-ov{position:fixed;inset:0;z-index:110;background:rgba(15,17,20,.45);animation:mnav-fade .16s ease}
.m-nav{position:fixed;left:0;top:0;bottom:0;z-index:111;width:min(280px,82vw);background:var(--panel-solid,#fbfbfc);color:var(--ink);
  box-shadow:10px 0 30px rgba(0,0,0,.22);display:flex;flex-direction:column;animation:mnav-in .2s ease;padding-bottom:env(safe-area-inset-bottom)}
.m-nav-head{height:56px;flex:none;display:flex;align-items:center;padding:0 18px;border-bottom:1px solid var(--line)}
.m-nav-head b{font-family:var(--serif);font-size:calc(18px*var(--fs,1));letter-spacing:.28em;font-weight:600}
.m-nav-head button{margin-left:auto;font-size:18px;color:var(--sub);background:transparent;padding:6px}
.m-nav-list{flex:1;overflow-y:auto;padding:6px 0;overscroll-behavior:contain}
.m-nav-list button{display:flex;align-items:center;width:100%;text-align:left;background:transparent;color:var(--ink);padding:12px 22px;font-size:calc(14.5px*var(--fs,1))}
.m-nav-list button.sub{padding:9px 22px 9px 36px;font-size:calc(13px*var(--fs,1));color:var(--sub)}
.m-nav-list button.on{font-weight:800;color:var(--ink);background:color-mix(in srgb,var(--ink) 7%,transparent)}
.m-nav-list .arr{margin-left:auto;color:var(--faint);font-size:11px}
.m-nav-list .nd{color:var(--accent);font-size:8px;margin-left:6px}
@keyframes mnav-in{from{transform:translateX(-100%)}to{transform:none}}
@keyframes mnav-fade{from{opacity:0}to{opacity:1}}
`;

export function MobileNav({ menu, nav, dotHrefs, title }: {
  menu: MenuItem[]; nav: (href: string) => void; dotHrefs: Set<string>; title?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [exp, setExp] = useState<Set<string>>(new Set());
  const isCur = (href: string) => {
    if (typeof window === 'undefined') return false;
    const cur = pathname + window.location.search;
    return href === cur || (!href.includes('?') && href === pathname);
  };
  // 열 때 — 지금 보는 메뉴가 든 묶음을 펼쳐 둔다
  useEffect(() => {
    if (!open) return;
    setExp(new Set(menu.filter(m => m.children?.some(c => isCur(c.href))).map(m => m.label)));
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // 페이지가 바뀌면 닫는다 (뒤로 가기 등)
  useEffect(() => { setOpen(false); }, [pathname]);

  const go = (href: string) => { setOpen(false); nav(href); };
  const toggle = (label: string) => setExp(s => { const n = new Set(s); if (n.has(label)) n.delete(label); else n.add(label); return n; });

  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="m-burger" aria-label="메뉴 열기" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="m-nav-ov" onClick={() => setOpen(false)} />
          <nav className="m-nav" aria-label="메뉴">
            <div className="m-nav-head">
              <b>{title || 'MENU'}</b>
              <button type="button" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="m-nav-list">
              {menu.map(item => item.children ? (
                <React.Fragment key={item.label}>
                  <button type="button" onClick={() => toggle(item.label)}>
                    {item.label}{item.children.some(c => dotHrefs.has(c.href)) && <small className="nd">●</small>}
                    <span className="arr">{exp.has(item.label) ? '▴' : '▾'}</span>
                  </button>
                  {exp.has(item.label) && item.children.map(c => (
                    <button key={c.href} type="button" className={`sub ${isCur(c.href) ? 'on' : ''}`} onClick={() => go(c.href)}>
                      {c.label}{dotHrefs.has(c.href) && <small className="nd">●</small>}
                    </button>
                  ))}
                </React.Fragment>
              ) : item.href ? (
                <button key={item.label} type="button" className={isCur(item.href) ? 'on' : ''} onClick={() => go(item.href!)}>
                  {item.label}{dotHrefs.has(item.href) && <small className="nd">●</small>}
                </button>
              ) : null)}
            </div>
          </nav>
        </>,
        document.body,
      )}
    </>
  );
}
