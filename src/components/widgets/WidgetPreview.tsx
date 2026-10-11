'use client';
// 위젯 「작동 예시」 — 사이트와 완전히 분리된 상자(iframe, sandbox="allow-scripts" · 널 오리진) 안에서 띄운다.
// · 케이브덕: 위젯 HTML의 {{상태값}} 자리에 예시 값을 채워 그대로 그린다
// · 티팟: 티팟과 같은 방식 — React + Babel을 상자 안에서 불러와 JSX를 그 자리에서 변환·실행하고,
//         Props 표의 예시값을 넣어 그린다. 채팅 연동 API(sendToChat 등)는 흉내만 낸다
// · 기타: HTML 그대로
// 위젯의 <style>·스크립트가 사이트 디자인에 새지 않고, 사이트 쿠키·저장소에도 닿지 못한다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Widget } from '@/lib/widgetStore';

// 티팟과 같은 런타임 (unpkg) — 버전 고정
export const VENDOR = {
  react: 'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  reactDom: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  babel: 'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js',
};

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** <script> 안에 문자열을 안전하게 넣기 — </script>로 끝나 버리지 않게 */
const jsStr = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** 상자 안 높이를 바깥에 알려 주는 작은 스크립트 — 접고 펴는 위젯도 높이가 따라간다 */
const reporter = (token: string) => `<script>(function(){var t=${jsStr(token)};function s(){var h=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0));parent.postMessage({__wp:t,h:h},'*');}
try{new ResizeObserver(s).observe(document.documentElement);}catch(e){}window.addEventListener('load',s);document.addEventListener('toggle',function(){setTimeout(s,0);},true);setInterval(s,800);s();})();</script>`;

const BASE_CSS = `html,body{margin:0;padding:0;background:transparent}
body{padding:14px;box-sizing:border-box;font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeInDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
summary::-webkit-details-marker{display:none}`;

/** 케이브덕 — {{키}}를 예시 값으로. 예시가 없으면 키 이름을 그대로 둔다(케이브덕 편집기 미리보기와 같은 느낌) */
export function fillCaveduck(w: Pick<Widget, 'html' | 'states' | 'userName' | 'charName'>): string {
  const ex = new Map((w.states ?? []).map(s => [s.key, s.example ?? '']));
  return (w.html ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, k: string) => {
    if (k === 'user') return esc(w.userName?.trim() || '유저');
    if (k === 'char') return esc(w.charName?.trim() || '캐릭터');
    const v = ex.get(k);
    return esc(v && v.trim() ? v : k);
  });
}

function caveDoc(w: Widget, token: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_CSS}</style></head><body>${fillCaveduck(w)}${reporter(token)}</body></html>`;
}

function htmlDoc(w: Widget, token: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_CSS}</style></head><body>${w.html ?? ''}${reporter(token)}</body></html>`;
}

/** 티팟 컴포넌트 이름 — 지정값, 없으면 코드에서 첫 PascalCase 함수/상수 */
export function teapotName(w: Pick<Widget, 'componentName' | 'jsx'>): string {
  if (w.componentName?.trim()) return w.componentName.trim();
  const m = (w.jsx ?? '').match(/function\s+([A-Z][A-Za-z0-9_]*)|(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/);
  return m ? (m[1] || m[2]) : '';
}

/** Props 표 예시값 → 실제 값 (타입대로) */
export function teapotProps(w: Pick<Widget, 'props'>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of w.props ?? []) {
    if (!p.name.trim()) continue;
    const raw = p.example ?? '';
    out[p.name.trim()] = p.type === 'number' ? (raw.trim() === '' ? 0 : Number(raw))
      : p.type === 'boolean' ? /^(true|1|yes|on|예|참)$/i.test(raw.trim())
      : raw;
  }
  return out;
}

function teapotDoc(w: Widget, token: string) {
  const name = teapotName(w);
  // 상자 안에서 도는 실행기 — 티팟 문서에 적힌 런타임 규칙을 따른다:
  //  · import 없이 훅을 바로 호출(useState…) · 채팅 연동 API · 주입된 requestAnimationFrame
  const runner = `
(function(){
  var root=document.getElementById('root');
  function fail(msg){root.innerHTML='<div class="wp-err"><b>미리보기를 띄우지 못했어요</b><pre></pre></div>';root.querySelector('pre').textContent=String(msg);}
  if(!window.React||!window.ReactDOM||!window.Babel){fail('React/Babel을 불러오지 못했어요 (인터넷 연결 또는 unpkg 접속을 확인해 주세요)');return;}
  var SRC=${jsStr(w.jsx ?? '')}, NAME=${jsStr(name)}, PROPS=${jsStr(teapotProps(w))};
  function toast(t){var d=document.createElement('div');d.className='wp-toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove();},2200);}
  var api={
    sendToChat:function(m){toast('채팅으로 보내기 → '+String(m==null?'':m));},
    sendToReroll:function(g){toast('다시 생성'+(g?' → '+g:''));},
    getPrevUserMessage:function(){return '';},
    getPrevCharMessage:function(){return '';},
    getPointerState:function(){return window.__ptr||{x:0,y:0,dx:0,dy:0,down:false,buttons:0};},
    isPointerDown:function(){return !!(window.__ptr&&window.__ptr.down);},
    requestAnimationFrame:window.requestAnimationFrame.bind(window),
    cancelAnimationFrame:window.cancelAnimationFrame.bind(window),
    ThreeCanvas:function(p){return React.createElement('div',{style:{height:(p&&p.height)||240,display:'grid',placeItems:'center',background:'#111',color:'#aaa',fontSize:12,borderRadius:8}},'3D(Three.js) 장면 — 홈페이지 미리보기에서는 표시하지 않아요');}
  };
  (function(){var lx=0,ly=0;window.__ptr={x:0,y:0,dx:0,dy:0,down:false,buttons:0};
    addEventListener('pointermove',function(e){window.__ptr={x:e.clientX,y:e.clientY,dx:e.clientX-lx,dy:e.clientY-ly,down:e.buttons>0,buttons:e.buttons};lx=e.clientX;ly=e.clientY;});
    addEventListener('pointerdown',function(e){window.__ptr.down=true;window.__ptr.buttons=e.buttons;});
    addEventListener('pointerup',function(){window.__ptr.down=false;window.__ptr.buttons=0;});})();
  var hooks=['useState','useEffect','useMemo','useCallback','useRef','useReducer','useLayoutEffect','useContext','useId','useTransition','useDeferredValue','Fragment'];
  var code;
  try{
    code=Babel.transform(SRC,{filename:'widget.tsx',presets:[['react',{runtime:'classic'}],['typescript',{isTSX:true,allExtensions:true}]]}).code;
  }catch(e){fail(e.message||e);return;}
  var names=['React'].concat(hooks,Object.keys(api));
  var vals=[React].concat(hooks.map(function(h){return React[h];}),Object.keys(api).map(function(k){return api[k];}));
  var Comp;
  try{
    Comp=Function.apply(null,names.concat([code+'\\n;return (typeof '+(NAME||'undefined')+'!=="undefined")?'+(NAME||'undefined')+':undefined;'])).apply(null,vals);
  }catch(e){fail(e.message||e);return;}
  if(typeof Comp!=='function'){fail('컴포넌트 「'+NAME+'」를 찾지 못했어요 — 컴포넌트 이름이 코드의 함수 이름과 같은지 확인해 주세요');return;}
  var Boundary=(function(){function B(p){React.Component.call(this,p);this.state={err:null};}
    B.prototype=Object.create(React.Component.prototype);B.prototype.constructor=B;
    B.getDerivedStateFromError=function(e){return {err:e};};
    B.prototype.render=function(){return this.state.err?React.createElement('div',{className:'wp-err'},React.createElement('b',null,'실행 중 오류'),React.createElement('pre',null,String(this.state.err&&this.state.err.message||this.state.err))):this.props.children;};
    return B;})();
  ReactDOM.createRoot(root).render(React.createElement(Boundary,null,React.createElement(Comp,PROPS)));
})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${BASE_CSS}
.wp-err{font:12px/1.5 system-ui,sans-serif;color:#c0392b;background:#fff4f2;border:1px solid #f5c6c0;border-radius:8px;padding:10px 12px}
.wp-err pre{white-space:pre-wrap;margin:6px 0 0;font:11px/1.45 ui-monospace,Menlo,monospace;color:#7f2b22}
.wp-toast{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);background:rgba(20,22,26,.86);color:#fff;font:12px system-ui,sans-serif;padding:7px 14px;border-radius:999px;z-index:99999;max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>
<script src="${VENDOR.react}"></script><script src="${VENDOR.reactDom}"></script><script src="${VENDOR.babel}"></script>
</head><body><div id="root"></div><script>${runner}</script>${reporter(token)}</body></html>`;
}

export function widgetDoc(w: Widget, token: string): string {
  if (w.platform === 'teapot') return teapotDoc(w, token);
  if (w.platform === 'caveduck') return caveDoc(w, token);
  return htmlDoc(w, token);
}

/** 작동 예시 상자. bg: 상자 바탕(채팅창 느낌) — 'light' | 'dark' */
export function WidgetPreview({ widget, bg = 'light', maxHeight, minHeight = 120 }: {
  widget: Widget; bg?: 'light' | 'dark'; maxHeight?: number; minHeight?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const token = useMemo(() => Math.random().toString(36).slice(2), []);
  const doc = useMemo(() => widgetDoc(widget, token), [widget, token]);
  const url = useMemo(() => URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' })), [doc]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [h, setH] = useState(widget.previewHeight || minHeight);

  useEffect(() => {
    if (widget.previewHeight) { setH(widget.previewHeight); return; }
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { __wp?: string; h?: number };
      if (!d || d.__wp !== token || typeof d.h !== 'number') return;
      setH(Math.max(minHeight, Math.min(d.h, 4000)));
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [token, minHeight, widget.previewHeight]);

  return (
    <div style={{
      borderRadius: 12, overflow: 'auto', maxHeight,
      background: bg === 'dark' ? '#1d2026' : '#eef0f3',
      border: '1px solid var(--line)',
    }}>
      <iframe ref={frame} src={url} title={`${widget.title} 작동 예시`} sandbox="allow-scripts"
        style={{ display: 'block', width: '100%', height: h, border: 0, background: 'transparent' }} />
    </div>
  );
}
