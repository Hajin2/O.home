'use client';
// TRPG 로그 책갈피 (포크 기능) — 로그를 읽다가 지금 위치에 이름 붙인 책갈피를 남기고, 누르면 그 자리로 간다.
//
// 저장 위치 — **각자 자기 것만** 보인다:
//   · 로그인한 사람  → 서버 표 bookmarks (공개범위 private = 본인·관리자만 읽기. 관리자 화면에서도 내 것만 걸러 보여 준다)
//   · 비로그인 방문자 → 그 브라우저(localStorage)에만
// 위치는 「몇 px」이 아니라 **몇 번째 문단(요소) + 그 안의 비율**로 기억한다 — 로그 상자(iframe)는 화면 폭에 따라
// 줄바꿈이 달라져 같은 대사가 다른 높이에 놓이기 때문(PC에서 저장 → 휴대폰에서 눌러도 같은 대사로).
// 일반 글 로그는 글자 위치(몇 번째 글자)로 기억한다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isServerMode } from '@/lib/backend';
import { fetchList, syncList } from '@/lib/db';
import { newId } from '@/lib/postStore';
import { useToast } from '@/components/ui/Toast';
import { explainDbError } from '@/lib/dbError';
import type { TrpgLog } from '@/lib/galleryStore';

const TABLE = 'bookmarks';
const LOCAL_KEY = 'ohome.logbm.v1';

/** 위치 — i: 로그 상자 안 요소 번호 · r: 그 요소 안 비율 · t: 그 자리 글 앞부분(로그가 고쳐져 번호가 밀렸을 때 찾는 용도)
 *  · c: 일반 글 로그의 글자 위치 · p: 전체 높이 대비 비율(마지막 수단) */
export interface BmAnchor { i?: number; r?: number; t?: string; c?: number; p: number }
export type LogBookmark = {
  id: string;
  logId: string;
  name: string;
  a: BmAnchor;
  date: string;
  authorId?: string;
  visibility: 'private';
};

/* ---------- 로그 상자 안에 넣는 스크립트 ---------- */
/** 로그 상자(iframe) 안 — 바깥이 묻는 좌표의 요소를 알려 주고(at), 저장한 위치의 높이를 계산해 준다(go).
 *  상자는 사이트와 분리돼 있어(널 오리진) 바깥에서 안을 직접 볼 수 없으므로 메시지로 주고받는다. */
export const LOG_BM_IFRAME = `<script>(function(){
var SKIP={SCRIPT:1,STYLE:1,LINK:1,META:1,NOSCRIPT:1,TEMPLATE:1};
function L(){var b=document.body;if(!b)return[];var a=b.getElementsByTagName('*'),o=[];for(var j=0;j<a.length;j++)if(!SKIP[a[j].tagName]&&!(a[j].className==='__bmf'||a[j].className==='__bmf __bmfc'))o.push(a[j]);return o;}
function sn(e){try{return ((e&&e.textContent)||'').replace(/\\s+/g,' ').trim().slice(0,60);}catch(x){return '';}}
function blk(e){var b=document.body;while(e&&e!==b&&e.parentElement){var d='';try{d=getComputedStyle(e).display;}catch(x){}
if(d!=='inline'&&d!=='contents'&&e.getBoundingClientRect().height>0)break;e=e.parentElement;}return e;}
function H(){var b=document.body;return Math.max(1,b?Math.max(b.scrollHeight,b.offsetHeight):1);}
function at(y){var b=document.body,de=document.documentElement;if(!b)return null;if(y<0)y=0;
var w=de.clientWidth||b.clientWidth||300,xs=[w/2,w/3,w*2/3,24],e=null;
for(var k=0;k<50&&!e;k++){var yy=y+k*10;if(yy>innerHeight)break;for(var q=0;q<xs.length&&!e;q++){var c=document.elementFromPoint(Math.round(xs[q]),yy);if(c&&c!==b&&c!==de)e=c;}}
var p=Math.min(1,Math.max(0,(y+scrollY)/H()));if(!e)return{p:p};
e=blk(e);var R=e.getBoundingClientRect();var r=R.height?Math.min(1,Math.max(0,(y-R.top)/R.height)):0;
return{i:L().indexOf(e),r:r,t:sn(e),p:p};}
function go(a){var list=L(),e=(a.i!=null&&a.i>=0)?list[a.i]:null;
if(a.t){var s=a.t.slice(0,30);if(!e||sn(e).slice(0,30)!==s){var best=null,bd=1e9;
for(var j=0;j<list.length;j++){var x=list[j];if(x.childElementCount>4)continue;if(sn(x).slice(0,30)===s){var d=Math.abs(j-(a.i||0));if(d<bd){bd=d;best=x;}}}
if(best)e=best;}}
var y;if(e){var R=e.getBoundingClientRect();y=R.top+scrollY+(a.r||0)*R.height;flash(e);}else y=(a.p||0)*H();
var de=document.documentElement;if(de.scrollHeight>innerHeight+4){scrollTo(0,Math.max(0,y-40));}
return y-scrollY;}
var PK=false,HL=null,ST=null;
function css(){if(ST)return;ST=document.createElement('style');
ST.textContent='.__bmhl{outline:2px solid rgba(214,158,46,.95)!important;outline-offset:2px!important;background-color:rgba(255,214,102,.16)!important;cursor:pointer!important}.__bmfl{background-color:rgba(255,214,102,.38)!important}mark.__bmf{background:rgba(255,214,102,.55)!important;color:inherit!important;border-radius:2px;padding:0!important}mark.__bmfc{background:#f2a33a!important;color:#111!important;box-shadow:0 0 0 2px rgba(242,163,58,.45)}';
(document.head||document.documentElement).appendChild(ST);}
function hl(e){if(HL&&HL!==e)HL.classList.remove('__bmhl');HL=e;if(e&&e.classList)e.classList.add('__bmhl');}
function flash(e){if(!e||!e.classList)return;css();e.classList.add('__bmfl');setTimeout(function(){e.classList.remove('__bmfl');},1400);}
function tg(ev){var e=ev.target;if(e&&e.nodeType!==1)e=e.parentElement;if(!e||e===document.body||e===document.documentElement)return null;return blk(e);}
addEventListener('mousemove',function(ev){if(PK)hl(tg(ev));},true);
addEventListener('mousedown',function(ev){if(PK){ev.stopPropagation();}},true);
addEventListener('click',function(ev){if(!PK)return;ev.preventDefault();ev.stopPropagation();var e=tg(ev);if(!e)return;
hl(null);var R=e.getBoundingClientRect();flash(e);
parent.postMessage({__bmPick:{i:L().indexOf(e),r:0,t:sn(e),p:Math.min(1,Math.max(0,(R.top+scrollY)/H()))}},'*');},true);
addEventListener('keydown',function(ev){if(PK&&ev.key==='Escape')parent.postMessage({__bmPickCancel:1},'*');},true);
var FM=[];
function fclear(){for(var j=0;j<FM.length;j++){var m=FM[j],p=m.parentNode;if(!p)continue;while(m.firstChild)p.insertBefore(m.firstChild,m);p.removeChild(m);p.normalize();}FM=[];}
function find(q){fclear();css();q=String(q||'').toLowerCase();if(!q||!document.body)return 0;
var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode;if(!p||SKIP[p.nodeName])return 2;return n.nodeValue&&n.nodeValue.toLowerCase().indexOf(q)>=0?1:2;}});
var nodes=[],n;while((n=w.nextNode()))nodes.push(n);
for(var a=0;a<nodes.length&&FM.length<3000;a++){var t=nodes[a],v=t.nodeValue,lv=v.toLowerCase(),i=lv.indexOf(q),cur=t;
while(i>=0&&FM.length<3000){var mid=cur.splitText(i);var rest=mid.splitText(q.length);var m=document.createElement('mark');m.className='__bmf';
mid.parentNode.insertBefore(m,mid);m.appendChild(mid);FM.push(m);cur=rest;lv=rest.nodeValue.toLowerCase();i=lv.indexOf(q);}}
return FM.length;}
function fgo(i){if(!FM.length)return null;for(var j=0;j<FM.length;j++)FM[j].className='__bmf';var m=FM[i];if(!m)return null;m.className='__bmf __bmfc';
var R=m.getBoundingClientRect(),y=R.top+scrollY;var de=document.documentElement;if(de.scrollHeight>innerHeight+4){scrollTo(0,Math.max(0,y-80));}return R.top+scrollY-scrollY+(de.scrollHeight>innerHeight+4?0:0);}
addEventListener('message',function(ev){if(ev.source!==parent)return;var d=ev.data;if(!d||!d.__bm)return;
var o={__bmR:d.k};try{if(d.__bm==='at')o.a=at(+d.y||0);else if(d.__bm==='go')o.y=go(d.a||{p:0});
else if(d.__bm==='pick'){PK=!!d.on;css();if(!PK)hl(null);}
else if(d.__bm==='find'){o.n=find(d.q);}else if(d.__bm==='findGo'){var r=fgo(+d.i||0);if(r!=null){o.y=FM[+d.i||0].getBoundingClientRect().top;}}else if(d.__bm==='findClear'){fclear();}}catch(x){o.err=1;}
parent.postMessage(o,'*');});
})();</scr${''}ipt>`;

/* ---------- 저장소 (각자 자기 것만) ---------- */

const readLocal = (): LogBookmark[] => {
  try { const raw = localStorage.getItem(LOCAL_KEY); return raw ? (JSON.parse(raw) as LogBookmark[]) : []; } catch { return []; }
};
const writeLocal = (l: LogBookmark[]) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(l)); } catch { /* 무시 */ } };

function errText(e: unknown): string {
  const msg = e instanceof Error ? e.message
    : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/bookmarks/.test(msg) && /(does not exist|relation|schema cache|pgrst205|could not find the table)/i.test(msg))
    return '서버에 책갈피 표가 아직 없어요 — 관리자가 Supabase에서 bookmarks.sql을 실행해야 해요';
  return explainDbError(msg) || msg || '다시 시도해 주세요';
}

export function useLogBookmarks() {
  const { user, ready } = useAuth();
  const uid = user?.id ?? null;
  const [list, setList] = useState<LogBookmark[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [server, setServer] = useState(false);       // 지금 서버에 저장 중인가
  const [noTable, setNoTable] = useState(false);     // 서버 표가 없어 브라우저에 대신 저장 중
  const [localCount, setLocalCount] = useState(0);   // 로그인 상태에서, 이 브라우저에 남은 비로그인 책갈피 수
  const ref = useRef<LogBookmark[]>([]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      let rows: LogBookmark[] = [];
      let srv = false;
      let missing = false;
      if (uid && isServerMode()) {
        try {
          rows = (await fetchList<LogBookmark>(TABLE)).filter(b => b.authorId === uid);   // 관리자는 남의 것도 받으므로 거른다
          srv = true;
        } catch (e) {
          console.error('[ohome] 책갈피 불러오기 실패', e);
          missing = true;
          rows = readLocal();
        }
      } else rows = readLocal();
      if (!alive) return;
      ref.current = rows; setList(rows); setServer(srv); setNoTable(missing);
      setLocalCount(srv ? readLocal().length : 0);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [uid, ready]);

  const save = useCallback(async (next: LogBookmark[]) => {
    const prev = ref.current;
    if (server) await syncList<LogBookmark>(TABLE, prev, next, uid);
    else writeLocal(next);
    ref.current = next; setList(next);
  }, [server, uid]);

  /** 이 브라우저에 남은 비로그인 책갈피를 내 계정으로 옮긴다 */
  const importLocal = useCallback(async () => {
    const local = readLocal();
    if (!server || !local.length) return 0;
    const moved = local.map(b => ({ ...b, id: newId(), authorId: uid ?? undefined, visibility: 'private' as const }));
    await save([...ref.current, ...moved]);
    writeLocal([]); setLocalCount(0);
    return moved.length;
  }, [server, save, uid]);

  return { list, loaded, server, noTable, localCount, uid, save, importLocal };
}

/* ---------- 위치 재기·이동 ---------- */

type Mode = 'frame' | 'plain';
const READ_LINE = 76;   // 화면(스크롤 영역) 맨 위에서 이만큼 아래를 「지금 읽는 줄」로 본다

export const mainEl = () => document.getElementById('appMain');
export function readLineY(): number {
  const m = mainEl();
  return (m ? Math.max(0, m.getBoundingClientRect().top) : 0) + READ_LINE;
}
export function scrollMainBy(dy: number, smooth = true) {
  const m = mainEl();
  if (m) m.scrollTo({ top: m.scrollTop + dy, behavior: smooth ? 'smooth' : 'auto' });
  else window.scrollBy({ top: dy, behavior: smooth ? 'smooth' : 'auto' });
}

export function ask<T>(frame: HTMLIFrameElement | null, msg: Record<string, unknown>, ms = 1500): Promise<T | null> {
  return new Promise(resolve => {
    const win = frame?.contentWindow;
    if (!win) { resolve(null); return; }
    const k = Math.random().toString(36).slice(2);
    let done = false;
    const on = (e: MessageEvent) => {
      if (e.source !== win) return;
      const d = e.data as { __bmR?: string };
      if (!d || d.__bmR !== k) return;
      done = true; window.removeEventListener('message', on); resolve(e.data as T);
    };
    window.addEventListener('message', on);
    win.postMessage({ ...msg, k }, '*');
    setTimeout(() => { if (!done) { window.removeEventListener('message', on); resolve(null); } }, ms);
  });
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  try {
    if (d.caretPositionFromPoint) { const p = d.caretPositionFromPoint(x, y); return p ? { node: p.offsetNode, offset: p.offset } : null; }
    if (d.caretRangeFromPoint) { const r = d.caretRangeFromPoint(x, y); return r ? { node: r.startContainer, offset: r.startOffset } : null; }
  } catch { /* 무시 */ }
  return null;
}

/** 일반 글 로그에서 글자 위치 c → 그 글자가 있는 화면 높이 */
function plainTopOf(el: HTMLElement, c: number): number | null {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const len = (node.textContent ?? '').length;
  const at = Math.max(0, Math.min(c, len - 1));
  try {
    const r = document.createRange();
    r.setStart(node, at); r.setEnd(node, Math.min(len, at + 1));
    const rect = r.getBoundingClientRect();
    return rect.height || rect.top ? rect.top : null;
  } catch { return null; }
}

/** 일반 글 로그에서 좌표 아래 줄(줄바꿈 기준 한 줄) — 시작 글자 위치와 화면 상자 */
function plainLineAt(el: HTMLElement, x: number, y: number): { s: number; rect: DOMRect } | null {
  const hit = caretAt(x, y);
  if (!hit || !el.contains(hit.node) || hit.node.nodeType !== Node.TEXT_NODE) return null;
  const text = hit.node.textContent ?? '';
  let a = hit.offset; while (a > 0 && text[a - 1] !== '\n') a--;
  let b = hit.offset; while (b < text.length && text[b] !== '\n') b++;
  try {
    const r = document.createRange();
    r.setStart(hit.node, a); r.setEnd(hit.node, Math.max(b, Math.min(text.length, a + 1)));
    return { s: a, rect: r.getBoundingClientRect() };
  } catch { return null; }
}

async function capture(mode: Mode, frame: HTMLIFrameElement | null): Promise<{ a: BmAnchor; snippet: string }> {
  const line = readLineY();
  if (mode === 'frame' && frame) {
    const fr = frame.getBoundingClientRect();
    const y = line - fr.top;
    if (y <= 0) return { a: { i: -1, p: 0 }, snippet: '' };
    const res = await ask<{ a?: BmAnchor | null }>(frame, { __bm: 'at', y });
    if (res?.a) return { a: res.a, snippet: res.a.t ?? '' };
    return { a: { p: Math.min(1, y / Math.max(1, fr.height)) }, snippet: '' };
  }
  const el = document.querySelector<HTMLElement>('.log-plain');
  if (!el) return { a: { p: 0 }, snippet: '' };
  const r = el.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
  if (line <= r.top) return { a: { c: 0, p: 0 }, snippet: '' };
  const hit = caretAt(r.left + 12, Math.min(line, r.bottom - 2));
  const text = el.textContent ?? '';
  if (hit && el.contains(hit.node)) {
    // 그 줄의 처음으로 당긴다 — 이름 기본값이 줄 중간에서 시작하지 않게
    let c = hit.offset;
    while (c > 0 && text[c - 1] !== '\n') c--;
    return { a: { c, p }, snippet: text.slice(c, c + 60).replace(/\s+/g, ' ').trim() };
  }
  return { a: { p }, snippet: '' };
}

async function jump(mode: Mode, frame: HTMLIFrameElement | null, a: BmAnchor, smooth = true): Promise<boolean> {
  const line = readLineY();
  if (mode === 'frame' && frame) {
    const res = await ask<{ y?: number }>(frame, { __bm: 'go', a });
    const fr = frame.getBoundingClientRect();
    const y = typeof res?.y === 'number' && isFinite(res.y) ? res.y : a.p * fr.height;
    scrollMainBy(fr.top + y - line, smooth);
    return !!res;
  }
  const el = document.querySelector<HTMLElement>('.log-plain');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const top = typeof a.c === 'number' ? plainTopOf(el, a.c) : null;
  scrollMainBy((top ?? r.top + a.p * r.height) - line, smooth);
  return true;
}

/* ---------- 화면 ---------- */

const fab: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', lineHeight: 1, position: 'relative',
  background: 'var(--panel-solid, #fff)', color: 'var(--ink, #333)', border: '1px solid var(--line, rgba(0,0,0,.14))',
  boxShadow: 'var(--sh-dd, 0 4px 14px rgba(0,0,0,.16))', cursor: 'var(--cur-pointer, pointer)', padding: 0,
};

const CSS = `
.lbm-pop{position:fixed;right:72px;bottom:92px;z-index:31;width:320px;max-height:min(62vh,520px);display:flex;flex-direction:column;
  background:var(--panel-solid,#fff);color:var(--ink,#222);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-lg,0 12px 40px rgba(0,0,0,.22));overflow:hidden}
.lbm-hd{display:flex;align-items:center;gap:8px;padding:12px 14px 10px;border-bottom:1px solid var(--line)}
.lbm-hd b{font-size:13px;letter-spacing:.04em}
.lbm-tabs{display:flex;gap:2px;margin-left:auto}
.lbm-tabs button{font-size:11px;padding:3px 8px;border-radius:6px;color:var(--faint);background:transparent;border:0;cursor:var(--cur-pointer,pointer)}
.lbm-tabs button.on{color:var(--ink);background:rgba(127,127,127,.14)}
.lbm-x{width:24px;height:24px;border:0;background:transparent;color:var(--faint);border-radius:6px;cursor:var(--cur-pointer,pointer);font-size:13px}
.lbm-x:hover{background:rgba(127,127,127,.12);color:var(--ink)}
.lbm-body{overflow:auto;padding:8px 8px 6px;flex:1;min-height:60px}
.lbm-add{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line)}
.lbm-add input{flex:1;min-width:0;font-size:12.5px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit}
.lbm-add .btn{font-size:11.5px;padding:0 12px;height:32px;white-space:nowrap}
.lbm-row{display:flex;align-items:center;gap:8px;padding:8px 8px;border-radius:9px;cursor:var(--cur-pointer,pointer)}
.lbm-row:hover{background:rgba(127,127,127,.09)}
.lbm-row .nm{flex:1;min-width:0}
.lbm-row .nm b{display:block;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbm-row .nm small{display:block;font-size:10.5px;color:var(--faint);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbm-row .pct{font-size:10.5px;color:var(--faint);flex-shrink:0;font-variant-numeric:tabular-nums}
.lbm-act{display:flex;gap:2px;flex-shrink:0}
.lbm-act button{font-size:10.5px;color:var(--faint);background:transparent;border:0;padding:3px 5px;border-radius:5px;cursor:var(--cur-pointer,pointer)}
.lbm-act button:hover{color:var(--ink);background:rgba(127,127,127,.14)}
.lbm-act button.warn{color:#c0392b}
.lbm-row input{flex:1;min-width:0;font-size:12.5px;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:transparent;color:inherit}
.lbm-grp{font-size:10.5px;color:var(--faint);letter-spacing:.06em;padding:8px 8px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbm-empty{font-size:12px;color:var(--faint);text-align:center;padding:18px 10px;line-height:1.6}
.lbm-ft{font-size:10.5px;color:var(--faint);padding:8px 14px 10px;border-top:1px solid var(--line);line-height:1.5}
.lbm-ft button{font-size:10.5px;text-decoration:underline;background:none;border:0;color:var(--ink);cursor:var(--cur-pointer,pointer);padding:0}
.lbm-n{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;font-size:9.5px;line-height:16px;text-align:center;
  background:var(--ink,#333);color:var(--panel-solid,#fff);font-family:var(--sans,inherit)}
.lbm-add2{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%}
.lbm-add2 .btn{font-size:11.5px;height:32px;padding:0 8px;white-space:nowrap}
.lbm-pick{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:41;display:flex;align-items:center;gap:10px;
  padding:9px 10px 9px 16px;border-radius:999px;background:var(--dd-bg,#222);color:var(--dd-fg,#fff);font-size:12.5px;
  box-shadow:0 10px 30px rgba(0,0,0,.3);white-space:nowrap;max-width:calc(100vw - 24px)}
.lbm-pick button{border:0;background:rgba(255,255,255,.14);color:inherit;border-radius:999px;padding:4px 10px;font-size:11.5px;cursor:var(--cur-pointer,pointer)}
.lbm-pick button:hover{background:rgba(255,255,255,.24)}
.lbm-hl{position:fixed;z-index:29;pointer-events:none;border-radius:4px;outline:2px solid rgba(214,158,46,.95);background:rgba(255,214,102,.16)}
.lbm-picking .log-plain{cursor:pointer}
@media (max-width:560px){.lbm-pop{left:12px;right:12px;bottom:84px;width:auto;max-height:58vh}.lbm-pick{top:64px;font-size:12px}}
`;

const Icon = ({ filled }: { filled?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
    <path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6l-4.5-3-4.5 3V3a.5.5 0 0 1 .5-.5z" />
  </svg>
);

/** 로그 상세의 떠 있는 버튼 줄(LogNav) 맨 위에 붙는 책갈피 버튼 + 목록 */
export function LogBookmarkButton({ log, logs, mode, frameRef }: {
  log: TrpgLog;
  logs: TrpgLog[];
  mode: Mode | null;                      // null — 위치를 잴 수 없는 표시 방식(원본 파일 대체 표시 등)이면 버튼을 숨긴다
  frameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const bm = useLogBookmarks();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'here' | 'all'>('here');
  const [draft, setDraft] = useState<{ a: BmAnchor; name: string } | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);          // 「줄 골라서 꽂기」 중
  const [hlRect, setHlRect] = useState<DOMRect | null>(null);   // 일반 글 로그에서 마우스 아래 줄 강조
  const popRef = useRef<HTMLDivElement>(null);
  const autoDone = useRef(false);

  const mine = useMemo(() => bm.list.filter(b => b.logId === log.id).sort((a, b) => a.a.p - b.a.p), [bm.list, log.id]);
  const titleOf = useMemo(() => new Map(logs.map(l => [l.id, l.title])), [logs]);
  const others = useMemo(() => {
    const groups = new Map<string, LogBookmark[]>();
    bm.list.filter(b => titleOf.has(b.logId)).forEach(b => { const g = groups.get(b.logId) ?? []; g.push(b); groups.set(b.logId, g); });
    return [...groups.entries()].map(([id, l]) => ({ id, title: titleOf.get(id) ?? '', items: l.sort((a, b) => a.a.p - b.a.p) }));
  }, [bm.list, titleOf]);

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    try { await fn(); } catch (e) { console.error('[ohome] 책갈피', e); toast(`${fail} — ${errText(e)}`); } finally { setBusy(false); }
  };

  const startAdd = async () => {
    if (!mode) return;
    const { a, snippet } = await capture(mode, frameRef.current);
    const name = snippet ? snippet.slice(0, 30) : a.p <= 0.001 ? '처음' : `책갈피 ${mine.length + 1}`;
    setDraft({ a, name });
  };
  const stopPick = useCallback(() => {
    setPicking(false); setHlRect(null);
    try { frameRef.current?.contentWindow?.postMessage({ __bm: 'pick', on: false, k: 'pick' }, '*'); } catch { /* 무시 */ }
  }, [frameRef]);
  const startPick = () => {
    if (!mode) return;
    setOpen(false); setDraft(null); setEdit(null); setPicking(true);
    if (mode === 'frame') {
      try { frameRef.current?.contentWindow?.postMessage({ __bm: 'pick', on: true, k: 'pick' }, '*'); } catch { /* 무시 */ }
    }
  };
  const picked = (a: BmAnchor, snippet: string) => {
    stopPick();
    setDraft({ a, name: snippet ? snippet.slice(0, 30) : `책갈피 ${mine.length + 1}` });
    setTab('here'); setOpen(true);
  };

  const commitAdd = () => {
    if (!draft) return;
    const item: LogBookmark = {
      id: newId(), logId: log.id, name: draft.name.trim().slice(0, 40) || `책갈피 ${mine.length + 1}`, a: draft.a,
      date: new Date().toISOString().slice(0, 10), authorId: bm.uid ?? undefined, visibility: 'private',
    };
    void run(async () => { await bm.save([...bm.list, item]); setDraft(null); toast('책갈피를 저장했어요'); }, '책갈피를 저장하지 못했어요');
  };
  const commitRename = () => {
    if (!edit) return;
    const name = edit.name.trim().slice(0, 40);
    if (!name) { setEdit(null); return; }
    void run(async () => { await bm.save(bm.list.map(b => (b.id === edit.id ? { ...b, name } : b))); setEdit(null); }, '이름을 바꾸지 못했어요');
  };
  const remove = (id: string) => {
    if (confirmDel !== id) { setConfirmDel(id); setTimeout(() => setConfirmDel(c => (c === id ? null : c)), 3000); return; }
    void run(async () => { await bm.save(bm.list.filter(b => b.id !== id)); setConfirmDel(null); }, '삭제하지 못했어요');
  };
  const goTo = (b: LogBookmark) => {
    if (!mode) return;
    void jump(mode, frameRef.current, b.a);
    if (window.matchMedia('(max-width:560px)').matches) setOpen(false);   // 휴대폰은 목록이 본문을 가리므로 닫는다
  };

  // 다른 로그의 책갈피를 눌러 들어온 경우(?bm=…) — 본문이 자리 잡을 때까지 기다렸다가 그 위치로
  useEffect(() => {
    if (autoDone.current || !bm.loaded || !mode) return;
    let id: string | null = null;
    try { id = new URLSearchParams(window.location.search).get('bm'); } catch { /* 무시 */ }
    if (!id) return;
    const target = bm.list.find(b => b.id === id && b.logId === log.id);
    autoDone.current = true;
    if (!target) return;
    let alive = true;
    (async () => {
      for (let n = 0; n < 16 && alive; n++) {
        await new Promise(r => setTimeout(r, 450));
        const fr = frameRef.current;
        if (mode === 'frame' && (!fr || fr.getBoundingClientRect().height < 260)) continue;   // 아직 높이 맞추는 중
        if (await jump(mode, fr, target.a, false)) break;
      }
      // 이미지가 늦게 붙으며 높이가 바뀔 수 있어 한 번 더 맞춘다
      await new Promise(r => setTimeout(r, 1400));
      if (alive) await jump(mode, frameRef.current, target.a, false);
      try {
        const url = new URL(window.location.href); url.searchParams.delete('bm');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch { /* 무시 */ }
    })();
    return () => { alive = false; };
  }, [bm.loaded, bm.list, mode, log.id, frameRef]);

  // 줄 골라서 꽂기 — 로그 상자에서 고른 줄을 받거나(상자 안 스크립트가 알려 줌), 일반 글 로그는 여기서 직접
  useEffect(() => {
    if (!picking || !mode) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') stopPick(); };
    document.addEventListener('keydown', key);
    document.documentElement.classList.add('lbm-picking');
    let cleanup = () => { /* */ };
    if (mode === 'frame') {
      const on = (e: MessageEvent) => {
        if (e.source !== frameRef.current?.contentWindow) return;
        const d = e.data as { __bmPick?: BmAnchor; __bmPickCancel?: number };
        if (d?.__bmPick) picked(d.__bmPick, d.__bmPick.t ?? '');
        else if (d?.__bmPickCancel) stopPick();
      };
      window.addEventListener('message', on);
      cleanup = () => window.removeEventListener('message', on);
    } else {
      const el = document.querySelector<HTMLElement>('.log-plain');
      if (el) {
        const move = (e: MouseEvent) => { const hit = plainLineAt(el, e.clientX, e.clientY); setHlRect(hit ? hit.rect : null); };
        const leave = () => setHlRect(null);
        const click = (e: MouseEvent) => {
          const hit = plainLineAt(el, e.clientX, e.clientY);
          if (!hit) return;
          e.preventDefault();
          const r = el.getBoundingClientRect();
          const text = el.textContent ?? '';
          picked({ c: hit.s, p: Math.min(1, Math.max(0, (hit.rect.top - r.top) / Math.max(1, r.height))) },
            text.slice(hit.s, hit.s + 60).replace(/\s+/g, ' ').trim());
        };
        const scroll = () => setHlRect(null);
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseleave', leave);
        el.addEventListener('click', click);
        mainEl()?.addEventListener('scroll', scroll, { passive: true });
        cleanup = () => {
          el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave);
          el.removeEventListener('click', click); mainEl()?.removeEventListener('scroll', scroll);
        };
      }
    }
    return () => { document.removeEventListener('keydown', key); document.documentElement.classList.remove('lbm-picking'); cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking, mode]);
  // 다른 화면으로 나가면 고르기 끄기
  useEffect(() => () => { try { frameRef.current?.contentWindow?.postMessage({ __bm: 'pick', on: false, k: 'pick' }, '*'); } catch { /* 무시 */ } }, [frameRef]);

  // 바깥을 누르면 닫기 · Esc
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if ((t as Element).closest?.('[data-lbm-fab]')) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); };
  }, [open]);

  if (!mode) return null;

  const row = (b: LogBookmark, other?: boolean) => {
    if (edit?.id === b.id) {
      return (
        <div key={b.id} className="lbm-row" style={{ cursor: 'default' }}>
          <input autoFocus value={edit.name} maxLength={40} onChange={e => setEdit({ id: b.id, name: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEdit(null); }} />
          <div className="lbm-act">
            <button type="button" onClick={commitRename} disabled={busy}>저장</button>
            <button type="button" onClick={() => setEdit(null)}>취소</button>
          </div>
        </div>
      );
    }
    const pct = `${Math.round(Math.min(1, Math.max(0, b.a.p)) * 100)}%`;
    const body = (
      <>
        <div className="nm"><b>{b.name}</b><small>{b.date.replace(/-/g, '.')}</small></div>
        <span className="pct" title="로그 안 대략적인 위치">{pct}</span>
      </>
    );
    return (
      <div key={b.id} className="lbm-row" role="button" tabIndex={0}
        onClick={() => (other ? undefined : goTo(b))}
        onKeyDown={e => { if (!other && e.key === 'Enter') goTo(b); }}>
        {other
          ? <Link href={`/trpg/${b.logId}?bm=${b.id}`} style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }} onClick={() => setOpen(false)}>{body}</Link>
          : body}
        <div className="lbm-act" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => { setConfirmDel(null); setEdit({ id: b.id, name: b.name }); }}>이름</button>
          <button type="button" className={confirmDel === b.id ? 'warn' : ''} onClick={() => remove(b.id)} disabled={busy}>
            {confirmDel === b.id ? '정말 삭제' : '삭제'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{CSS}</style>
      <button type="button" style={fab} data-lbm-fab aria-expanded={open} title="책갈피" aria-label="책갈피"
        onClick={() => { if (picking) stopPick(); setOpen(o => !o); setDraft(null); setEdit(null); }}>
        <Icon filled={mine.length > 0} />
        {mine.length > 0 && <span className="lbm-n">{mine.length}</span>}
      </button>
      {picking && (
        <div className="lbm-pick" role="status">
          <span>책갈피를 꽂을 줄을 누르세요</span>
          <button type="button" onClick={stopPick}>취소 (Esc)</button>
        </div>
      )}
      {picking && hlRect && (() => {
        const el = document.querySelector<HTMLElement>('.log-plain');
        const box = el?.getBoundingClientRect();
        return <div className="lbm-hl" style={{
          left: (box?.left ?? hlRect.left) - 6, width: (box?.width ?? hlRect.width) + 12,
          top: hlRect.top - 2, height: hlRect.height + 4,
        }} />;
      })()}
      {open && (
        <div ref={popRef} className="lbm-pop" role="dialog" aria-label="책갈피">
          <div className="lbm-hd">
            <b>책갈피</b>
            <div className="lbm-tabs">
              <button type="button" className={tab === 'here' ? 'on' : ''} onClick={() => setTab('here')}>이 로그 {mine.length}</button>
              <button type="button" className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>전체</button>
            </div>
            <button type="button" className="lbm-x" aria-label="닫기" onClick={() => setOpen(false)}>✕</button>
          </div>
          {tab === 'here' && (
            <div className="lbm-add">
              {draft ? (
                <>
                  <input autoFocus value={draft.name} maxLength={40} placeholder="책갈피 이름"
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setDraft(null); }} />
                  <button type="button" className="btn btn-dark" onClick={commitAdd} disabled={busy || !bm.loaded}>{busy ? '저장 중…' : '저장'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>취소</button>
                </>
              ) : (
                <div className="lbm-add2">
                  <button type="button" className="btn btn-dark" onClick={() => void startAdd()} disabled={!bm.loaded}
                    title="화면 위쪽, 지금 읽고 있는 줄에 꽂아요">＋ 지금 읽는 위치</button>
                  <button type="button" className="btn btn-ghost" onClick={startPick} disabled={!bm.loaded}
                    title="로그에서 원하는 줄을 눌러 꽂아요">줄 골라서 꽂기</button>
                </div>
              )}
            </div>
          )}
          <div className="lbm-body">
            {!bm.loaded && <div className="lbm-empty">불러오는 중…</div>}
            {bm.loaded && tab === 'here' && (mine.length
              ? mine.map(b => row(b))
              : <div className="lbm-empty">아직 책갈피가 없어요.<br />읽던 자리에 바로 꽂거나, 원하는 줄을 골라 꽂을 수 있어요.</div>)}
            {bm.loaded && tab === 'all' && (others.length
              ? others.map(g => (
                <div key={g.id}>
                  <div className="lbm-grp">{g.id === log.id ? `${g.title} (지금 로그)` : g.title}</div>
                  {g.items.map(b => row(b, g.id !== log.id))}
                </div>
              ))
              : <div className="lbm-empty">저장한 책갈피가 없어요.</div>)}
          </div>
          <div className="lbm-ft">
            {bm.server
              ? '내 계정에 저장돼요 · 다른 사람에게는 보이지 않아요'
              : bm.noTable
                ? '서버 준비 전이라 이 브라우저에만 저장 중이에요'
                : '이 브라우저에만 저장돼요 · 로그인하면 계정에 저장할 수 있어요'}
            {bm.server && bm.localCount > 0 && (
              <div style={{ marginTop: 4 }}>
                이 브라우저에 로그인 전 책갈피 {bm.localCount}개가 있어요 ·{' '}
                <button type="button" disabled={busy} onClick={() => void run(async () => {
                  const n = await bm.importLocal(); toast(`책갈피 ${n}개를 내 계정으로 옮겼어요`);
                }, '옮기지 못했어요')}>내 계정으로 옮기기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
