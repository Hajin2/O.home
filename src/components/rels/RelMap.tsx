'use client';
// 자관 관계도 (포크 기능) — 밤하늘 성도처럼: 캐릭터는 자기 색으로 빛나는 별(초상), 자관은 별자리 선. /rels/map
//   · 2인 자관 = 두 별을 잇는 선 + 선 위 작은 별과 이름 / 3인+ 자관 = 네 갈래 별에서 멤버마다 점선
//   · 같은 두 사람 사이 자관이 여럿이면 선을 휘어 겹치지 않게
//   · 별을 누르면 그 관계만 밝아지고 왼쪽 아래 정보 카드(자관 목록·페이지 열기) / 자관 이름을 누르면 자관 페이지
//   · 끌어서 화면 이동 · 휠/버튼으로 확대 · 세계관 탭으로 거르기
//   · 관리자는 점을 끌어 배치를 바꾸고 「배치 저장」 — 방문자도 그 배치로 본다(메뉴 설정 relmapPos에 함께 저장).
//     저장한 적 없는 점은 자동 배치(서로 밀고 선은 당기는 방식)로 자리를 잡는다
// 볼 수 없는 자관·캐릭터는 그리지 않는다(서버가 애초에 안 주거나, 나만보기 자관은 관리자만).
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Relation, REL_SEED, Character, CHAR_SEED, relPath, charPath } from '@/lib/charStore';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { useMenuSettings, type MenuSettings } from '@/lib/menuStore';
import { useWorldTabs } from '@/components/chars/WorldTabs';
import { useToast } from '@/components/ui/Toast';

type Pos = Record<string, [number, number]>;
type WithPos = MenuSettings & { relmapPos?: Pos };

interface Node { id: string; kind: 'char' | 'hub' | 'label'; ch?: Character; rel?: Relation; x: number; y: number; pinned: boolean; init?: [number, number] }
interface Edge { id: string; a: string; b: string; rel: Relation; hub: boolean; label?: string }

const R = 30;          // 캐릭터 점 반지름
const HUB = 9;         // 다인 자관 마름모 반지름

/** 자동 배치 — 점끼리는 밀고 선은 당긴다. 저장된 자리(pinned)는 움직이지 않는다 */
function layout(nodes: Node[], edges: { a: string; b: string; len: number }[]) {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const free = nodes.filter(n => !n.pinned);
  if (!free.length) return;
  // 처음 자리: 원 위에 고르게 (항상 같은 결과가 나오게 무작위를 쓰지 않는다)
  const ring = free.filter(n => n.kind !== 'label');
  ring.forEach((n, i) => {
    const t = (i / ring.length) * Math.PI * 2;
    const r = 140 + ring.length * 14;
    n.x = Math.cos(t) * r; n.y = Math.sin(t) * r;
  });
  // 이름표 점은 양 끝의 가운데에서 시작 (init = [끝a 번호, 끝b 번호, 몇 번째] 대신 함수로 계산)
  free.filter(n => n.kind === 'label').forEach(n => { const f = (n as Node & { start?: () => [number, number] }).start; if (f) [n.x, n.y] = f(); });
  const vx = new Float64Array(nodes.length), vy = new Float64Array(nodes.length);
  for (let it = 0; it < 420; it++) {
    const cool = 1 - it / 420;
    vx.fill(0); vy.fill(0);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].pinned && nodes[j].pinned) continue;   // 둘 다 고정이면 계산할 필요 없음
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const ki = nodes[i].kind, kj = nodes[j].kind;
        const f = (ki === 'char' && kj === 'char' ? 14000 : ki === 'label' || kj === 'label' ? 4200 : 5000) / d2;
        const d = Math.sqrt(d2);
        vx[i] += (dx / d) * f; vy[i] += (dy / d) * f;
        vx[j] -= (dx / d) * f; vy[j] -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const i = idx.get(e.a)!, j = idx.get(e.b)!;
      if (nodes[i].pinned && nodes[j].pinned) continue;
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const f = (d - e.len) * 0.06;
      vx[i] += (dx / d) * f; vy[i] += (dy / d) * f;
      vx[j] -= (dx / d) * f; vy[j] -= (dy / d) * f;
    }
    nodes.forEach((n, i) => {
      if (n.pinned) return;
      vx[i] -= n.x * 0.004; vy[i] -= n.y * 0.004;   // 가운데로 살짝
      const step = Math.min(18 * cool + 1, Math.hypot(vx[i], vy[i]));
      const h = Math.hypot(vx[i], vy[i]) || 1;
      n.x += (vx[i] / h) * step; n.y += (vy[i] / h) * step;
    });
  }
}

export function RelMap() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [rels, , relsLoaded] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [chars, , charsLoaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [ms, patchMs] = useMenuSettings();
  const saved = (ms as WithPos).relmapPos ?? {};

  // 볼 수 있는 자관 · 거기 나오는 캐릭터
  const seeRels = useMemo(() => rels.filter(r => isAdmin || r.visibility !== 'private'), [rels, isAdmin]);
  const charById = useMemo(() => new Map(chars.map(c => [c.id, c])), [chars]);
  const used = useMemo(() => {
    const s = new Set<string>();
    seeRels.forEach(r => r.members.forEach(m => { if (charById.has(m.charId)) s.add(m.charId); }));
    return chars.filter(c => s.has(c.id));
  }, [seeRels, charById, chars]);
  const world = useWorldTabs(used);

  // 화면에 그릴 점·선
  const [drag, setDrag] = useState<Pos>({});   // 이번에 끌어 옮긴 자리 (저장 전)
  const autoRef = useRef<Pos>({});             // 자동 배치로 잡힌 자리 — 한 번 잡으면 유지(점 하나를 끌어도 나머지가 튀지 않게)
  // 지금 탭에 보이는 캐릭터 — 글자열로 비교해 탭 함수가 렌더마다 새로 만들어져도 배치를 다시 하지 않게
  const shownKey = used.filter(world.match).map(c => c.id).join(',');
  const base = useMemo(() => {
    const shown = new Set(shownKey ? shownKey.split(',') : []);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const springs: { a: string; b: string; len: number }[] = [];
    const posOf = (id: string) => saved[id] ?? autoRef.current[id];
    used.filter(c => shown.has(c.id)).forEach(c => {
      const p = posOf(c.id);
      nodes.push({ id: c.id, kind: 'char', ch: c, x: p?.[0] ?? 0, y: p?.[1] ?? 0, pinned: !!p });
    });
    const pairCount = new Map<string, Relation[]>();
    seeRels.forEach(r => {
      const mem = r.members.map(m => m.charId).filter(id => shown.has(id));
      if (mem.length < 2) return;
      if (mem.length === 2) {
        const key = [...mem].sort().join('|');
        const l = pairCount.get(key) ?? []; l.push(r); pairCount.set(key, l);
      } else {
        const hid = `hub:${r.id}`;
        const p = posOf(hid);
        nodes.push({ id: hid, kind: 'hub', rel: r, x: p?.[0] ?? 0, y: p?.[1] ?? 0, pinned: !!p });
        mem.forEach(cid => {
          edges.push({ id: `${r.id}:${cid}`, a: hid, b: cid, rel: r, hub: true });
          springs.push({ a: hid, b: cid, len: 120 });
        });
      }
    });
    const nodeAt = new Map(nodes.map(n => [n.id, n]));
    pairCount.forEach((list, key) => {
      const [a, b] = key.split('|');
      list.forEach((r, k) => {
        // 2인 자관마다 이름표 점 — 자동 배치가 이름표끼리·캐릭터와 겹치지 않게 밀어 준다. 선은 이 점을 지나도록 휜다
        const lid = `lab:${r.id}`;
        const off = (k - (list.length - 1) / 2) * 44;
        const lab: Node & { start?: () => [number, number] } = { id: lid, kind: 'label', rel: r, x: 0, y: 0, pinned: false };
        lab.start = () => {
          const A = nodeAt.get(a)!, B = nodeAt.get(b)!;
          const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
          return [(A.x + B.x) / 2 - (dy / d) * off, (A.y + B.y) / 2 + (dx / d) * off];
        };
        nodes.push(lab);
        edges.push({ id: r.id, a, b, rel: r, hub: false, label: lid });
        springs.push({ a: lid, b: a, len: 100 }, { a: lid, b, len: 100 });
      });
      springs.push({ a, b, len: 210 });
    });
    layout(nodes, springs);
    nodes.forEach(n => { if (n.kind !== 'label' && !saved[n.id]) autoRef.current[n.id] = [n.x, n.y]; });
    // 이름표 자리를 양 끝 기준(선 방향 u · 수직 v)으로 기억 — 점을 끌면 이름표가 계산 없이 따라온다
    const lab = new Map<string, { a: string; b: string; u: number; v: number }>();
    edges.forEach(e => {
      if (!e.label) return;
      const A = nodeAt.get(e.a)!, B = nodeAt.get(e.b)!, L = nodes.find(n => n.id === e.label)!;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      lab.set(e.label, { a: e.a, b: e.b, u: ((L.x - mx) * dx + (L.y - my) * dy) / d, v: (-(L.x - mx) * dy + (L.y - my) * dx) / d });
    });
    return { nodes, edges, lab };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [used, seeRels, shownKey, JSON.stringify(saved)]);

  // 화면에 그릴 자리 = 배치 결과 + 지금 끌어 옮긴 자리 (끄는 동안 다시 배치하지 않는다 — 큰 관계도도 가볍게)
  const graph = useMemo(() => {
    const nodes = base.nodes.map(n => {
      const p = drag[n.id];
      return p ? { ...n, x: p[0], y: p[1] } : { ...n };
    });
    const byId = new Map(nodes.map(n => [n.id, n]));
    base.lab.forEach((q, id) => {
      const L = byId.get(id), A = byId.get(q.a), B = byId.get(q.b);
      if (!L || !A || !B) return;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      L.x = (A.x + B.x) / 2 + (q.u * dx - q.v * dy) / d;
      L.y = (A.y + B.y) / 2 + (q.u * dy + q.v * dx) / d;
    });
    return { nodes, edges: base.edges, byId };
  }, [base, drag]);

  /* ---------- 보기(확대·이동) ---------- */
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, s: 1 });
  const [glide, setGlide] = useState(false);   // 자동으로 옮길 때만 부드럽게 (손으로 끌 때는 바로 따라오게)
  const glideOnce = () => { setGlide(true); setTimeout(() => setGlide(false), 320); };
  const fit = useCallback(() => {
    const el = boxRef.current;
    if (!el || !graph.nodes.length) return;
    const xs = graph.nodes.map(n => n.x), ys = graph.nodes.map(n => n.y);
    const minX = Math.min(...xs) - R - 60, maxX = Math.max(...xs) + R + 60;
    const minY = Math.min(...ys) - R - 40, maxY = Math.max(...ys) + R + 60;
    const w = el.clientWidth, h = el.clientHeight;
    const s = Math.min(1.4, Math.max(0.25, Math.min(w / (maxX - minX), h / (maxY - minY))));
    setView({ s, x: w / 2 - ((minX + maxX) / 2) * s, y: h / 2 - ((minY + maxY) / 2) * s });
  }, [graph.nodes]);
  const [focus, setFocus] = useState<string | null>(null);   // 누른 점 — 그 관계만 진하게
  const fitted = useRef(false);
  useEffect(() => { if (!fitted.current && graph.nodes.length) { fitted.current = true; fit(); } }, [graph.nodes.length, fit]);
  useEffect(() => { fitted.current = false; setFocus(null); }, [world.tab]);

  const zoomAt = (f: number, cx?: number, cy?: number) => setView(v => {
    const el = boxRef.current;
    const px = cx ?? (el ? el.clientWidth / 2 : 0), py = cy ?? (el ? el.clientHeight / 2 : 0);
    const s = Math.min(3, Math.max(0.2, v.s * f));
    return { s, x: px - (px - v.x) * (s / v.s), y: py - (py - v.y) * (s / v.s) };
  });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 끌기: 빈 곳 = 화면 이동 · (관리자) 점 = 자리 옮기기
  const dragRef = useRef<{ kind: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent, id?: string) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const n = id ? graph.byId.get(id) : undefined;
    dragRef.current = n && isAdmin
      ? { kind: 'node', id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false }
      : { kind: 'pan', id, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
    e.stopPropagation();
  };
  // 별마다 같은 함수를 넘겨, 움직이지 않는 별은 다시 그리지 않게 (큰 관계도에서 끌기가 가볍게)
  const downRef = useRef(onDown);
  downRef.current = onDown;
  const starDown = useCallback((e: React.PointerEvent, id: string) => downRef.current(e, id), []);
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.kind === 'pan') setView(v => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    else if (d.id) setDrag(p => ({ ...p, [d.id!]: [Math.round(d.ox + dx / view.s), Math.round(d.oy + dy / view.s)] }));
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.moved) return;
    // 누르기(끌지 않음) — 점이면 그 관계만 진하게 + 정보 카드, 빈 곳이면 풀기
    if (!d.id) { setFocus(null); return; }
    const next = focus === d.id ? null : d.id;
    setFocus(next);
    // 휴대폰 — 아래 정보 카드에 가리지 않게 고른 별을 화면 위쪽으로 옮긴다
    const el = boxRef.current, n = next ? graph.byId.get(next) : undefined;
    if (n && el && el.clientWidth < 560) {
      glideOnce();
      setView(v => ({ ...v, x: el.clientWidth / 2 - n.x * v.s, y: el.clientHeight * 0.26 - n.y * v.s }));
    }
  };

  const dirty = Object.keys(drag).length > 0;
  const savePos = () => {
    // 지금 화면의 모든 점 자리를 저장 — 자동 배치로 잡힌 점도 그대로 고정된다
    const next: Pos = { ...saved };
    graph.nodes.forEach(n => { if (n.kind !== 'label') next[n.id] = [Math.round(n.x), Math.round(n.y)]; });
    patchMs({ relmapPos: next } as unknown as Partial<MenuSettings>);
    setDrag({});
    toast('배치를 저장했어요 — 방문자도 이 배치로 봐요');
  };
  const resetPos = () => {
    const ids = new Set(graph.nodes.map(n => n.id));
    const next: Pos = {};
    Object.entries(saved).forEach(([k, v]) => { if (!ids.has(k)) next[k] = v; });
    patchMs({ relmapPos: next } as unknown as Partial<MenuSettings>);
    setDrag({}); autoRef.current = {}; fitted.current = false;
    toast('자동 배치로 되돌렸어요');
  };

  // 강조: 고른 점과 이어진 것만
  const near = useMemo(() => {
    if (!focus || !graph.byId.has(focus)) return null;   // 고른 점이 지금 안 보이면(세계관 탭 전환) 강조 없음
    const s = new Set<string>([focus]);
    graph.edges.forEach(e => {
      if (e.a === focus || e.b === focus) { s.add(e.a); s.add(e.b); if (e.label) s.add(e.label); }
    });
    return s;
  }, [focus, graph.edges]);
  const onEdge = (e: Edge) => !near || (near.has(e.a) && near.has(e.b) && (e.a === focus || e.b === focus));

  // 성도 배경 — 가운데(자동 배치의 중심)를 도는 옅은 동심원·방사선. 지도와 함께 움직이고 커진다
  const sky = useMemo(() => {
    let r = 0;
    graph.nodes.forEach(n => { r = Math.max(r, Math.hypot(n.x, n.y)); });
    const rings: number[] = [];
    for (let k = 170; k <= r + 260; k += 170) rings.push(k);
    return { rings, outer: rings[rings.length - 1] ?? 340 };
  }, [graph.nodes]);

  // 정보 카드 — 고른 캐릭터의 자관들 / 고른 다인 자관의 멤버
  const card = useMemo(() => {
    const n = focus ? graph.byId.get(focus) : undefined;
    if (!n) return null;
    if (n.kind === 'char') {
      const c = n.ch!;
      const links = seeRels.filter(r => r.members.some(m => m.charId === c.id))
        .map(r => ({ r, with: r.members.filter(m => m.charId !== c.id).map(m => charById.get(m.charId)?.name).filter(Boolean) as string[] }));
      return { kind: 'char' as const, c, links };
    }
    if (n.kind === 'hub') {
      const r = n.rel!;
      return { kind: 'hub' as const, r, names: r.members.map(m => charById.get(m.charId)?.name).filter(Boolean) as string[] };
    }
    return null;
  }, [focus, graph.byId, seeRels, charById]);

  const loading = !relsLoaded || !charsLoaded;
  const tint = (r: Relation) => (r.themeMode === 'custom' && r.themeColor) || STAR_LINE;
  const nChars = graph.nodes.filter(n => n.kind === 'char').length;
  const nRels = new Set(graph.edges.map(e => e.rel.id)).size;

  // 지도 내용 — 화면 이동·확대(view)와 따로 만들어 둔다. 끌어서 화면을 움직일 때 선·이름을 다시 그리지 않게
  const layer = useMemo(() => (
    <>
          <svg className="relmap-svg" width="1" height="1" overflow="visible" aria-hidden>
            <g className="relmap-chart">
              {sky.rings.map(r => <circle key={r} cx={0} cy={0} r={r} />)}
              {Array.from({ length: 12 }, (_, i) => {
                const t = (i / 12) * Math.PI * 2;
                return <line key={i} x1={Math.cos(t) * 60} y1={Math.sin(t) * 60} x2={Math.cos(t) * sky.outer} y2={Math.sin(t) * sky.outer} />;
              })}
            </g>
            {graph.edges.map(e => {
              const A = graph.byId.get(e.a)!, B = graph.byId.get(e.b)!;
              const dim = !onEdge(e);
              const lit = !!near && !dim;
              if (e.hub) {
                return <line key={e.id} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className={`relmap-ln${lit ? ' lit' : ''}`}
                  style={{ stroke: tint(e.rel), opacity: dim ? 0.08 : undefined }} strokeDasharray="2 5" />;
              }
              // 이름표 점을 지나는 곡선 — 조절점 = 2×이름표 − 양 끝의 가운데
              const L = graph.byId.get(e.label!)!;
              const cx = 2 * L.x - (A.x + B.x) / 2, cy = 2 * L.y - (A.y + B.y) / 2;
              return <path key={e.id} d={`M${A.x},${A.y} Q${cx},${cy} ${B.x},${B.y}`} className={`relmap-ln${lit ? ' lit' : ''}`}
                style={{ stroke: tint(e.rel), opacity: dim ? 0.08 : undefined }} />;
            })}
          </svg>
          {/* 2인 자관 이름 — 선 위에 작은 별과 함께 */}
          {graph.edges.filter(e => !e.hub).map(e => {
            const L = graph.byId.get(e.label!)!;
            return (
              <button key={`l-${e.id}`} type="button" className={`relmap-label${onEdge(e) ? '' : ' dim'}`}
                style={{ left: L.x, top: L.y, ['--rc' as string]: tint(e.rel) }}
                onPointerDown={ev => ev.stopPropagation()}
                onClick={() => router.push(relPath(e.rel))} title={`「${e.rel.name}」 자관 페이지로`}>
                <i aria-hidden />{e.rel.name}
              </button>
            );
          })}
          {graph.nodes.filter(n => n.kind !== 'label').map(n => {
            const dim = !!near && !near.has(n.id);
            if (n.kind === 'hub') {
              return (
                <div key={n.id} className={`relmap-hub${dim ? ' dim' : ''}${focus === n.id ? ' on' : ''}`}
                  style={{ left: n.x, top: n.y, ['--rc' as string]: tint(n.rel!) }}
                  onPointerDown={e => starDown(e, n.id)} title={`${n.rel!.name} (${n.rel!.members.length}인)`}>
                  <i /><span>{n.rel!.name}</span>
                </div>
              );
            }
            const c = n.ch!;
            return <Star key={n.id} id={n.id} x={n.x} y={n.y} name={c.name} color={c.color || '#9aa3b5'}
              thumbId={c.thumbId} thumbCrop={c.thumbCrop} thumbClass={c.thumbClass}
              dim={dim} on={focus === n.id} onDown={starDown} />;
          })}
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [graph, near, focus, sky, starDown]);

  return (
    <div className="relmap-wrap">
      <style>{CSS}</style>
      {world.element}
      <div className="relmap-bar">
        <span className="hint" style={{ margin: 0 }}>
          캐릭터 {nChars}명, 자관 {nRels}개
          <span className="relmap-tip">{isAdmin ? ' — 별을 끌어 자리를 옮길 수 있어요' : ''}</span>
        </span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {isAdmin && dirty && <button className="btn btn-dark" onClick={savePos}>배치 저장</button>}
          {isAdmin && Object.keys(saved).length > 0 && !dirty && <button className="btn btn-ghost" onClick={resetPos}>자동 배치로</button>}
        </div>
      </div>
      <div ref={boxRef} className="relmap" onPointerDown={e => onDown(e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { dragRef.current = null; }}>
        {loading && <div className="relmap-empty">불러오는 중…</div>}
        {!loading && graph.nodes.length === 0 && <div className="relmap-empty">자관에 캐릭터를 두 명 이상 넣으면 여기에 이어져요</div>}
        <div className={`relmap-stage${glide ? ' glide' : ''}`} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
          {layer}
        </div>

        {/* 확대·축소·맞춤 — 지도 오른쪽 위 */}
        <div className="relmap-zoom" onPointerDown={e => e.stopPropagation()}>
          <button type="button" aria-label="확대" title="확대" onClick={() => zoomAt(1.2)}>
            <svg viewBox="0 0 16 16" aria-hidden><path d="M8 3.5v9M3.5 8h9" /></svg>
          </button>
          <button type="button" aria-label="축소" title="축소" onClick={() => zoomAt(1 / 1.2)}>
            <svg viewBox="0 0 16 16" aria-hidden><path d="M3.5 8h9" /></svg>
          </button>
          <button type="button" aria-label="전체 보기" title="전체 보기" onClick={() => { glideOnce(); fit(); }}>
            <svg viewBox="0 0 16 16" aria-hidden><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" /></svg>
          </button>
        </div>

        {/* 고른 별의 정보 카드 */}
        {card && (
          <div className="relmap-card" onPointerDown={e => e.stopPropagation()}>
            <button type="button" className="x" aria-label="닫기" onClick={() => setFocus(null)}>
              <svg viewBox="0 0 16 16" aria-hidden><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
            {card.kind === 'char' ? (
              <>
                <div className="who" style={{ ['--cc' as string]: card.c.color || '#9aa3b5' }}>
                  <div className="face"><CroppedBlobImg fileRef={card.c.thumbId} crop={card.c.thumbCrop} ph={card.c.thumbClass} /></div>
                  <div style={{ minWidth: 0 }}>
                    <h5>{card.c.name}</h5>
                    {card.c.sub && <p>{card.c.sub}</p>}
                  </div>
                </div>
                <ul>
                  {card.links.map(({ r, with: w }) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => router.push(relPath(r))} style={{ ['--rc' as string]: tint(r) }}>
                        <i aria-hidden /><span>{r.name}</span><small>{w.join(', ')}</small>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="go" onClick={() => router.push(charPath(card.c))}>캐릭터 페이지 열기</button>
              </>
            ) : (
              <>
                <h5 style={{ paddingRight: 24 }}>{card.r.name}</h5>
                <p>{card.names.join(', ')}</p>
                <button type="button" className="go" onClick={() => router.push(relPath(card.r))}>자관 페이지 열기</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 캐릭터 별 하나 — 자리·상태가 그대로면 다시 그리지 않는다 */
const Star = React.memo(function Star({ id, x, y, name, color, thumbId, thumbCrop, thumbClass, dim, on, onDown }: {
  id: string; x: number; y: number; name: string; color: string;
  thumbId?: string; thumbCrop?: Character['thumbCrop']; thumbClass?: string;
  dim: boolean; on: boolean; onDown: (e: React.PointerEvent, id: string) => void;
}) {
  return (
    <div className={`relmap-node${dim ? ' dim' : ''}${on ? ' on' : ''}`}
      style={{ left: x, top: y, ['--cc' as string]: color }}
      onPointerDown={e => onDown(e, id)} title={name}>
      <div className="face"><CroppedBlobImg fileRef={thumbId} crop={thumbCrop} ph={thumbClass} /></div>
      <b>{name}</b>
    </div>
  );
});

/* 밤하늘 성도 팔레트 — 사이트 테마와 상관없이 지도 판은 늘 밤이다(별이 보이도록) */
const SKY = '#141a29';
const SKY_EDGE = '#0d111b';
const STAR = '#efe7d2';        // 별빛(따뜻한 흰색) — 이름·작은 별
const STAR_DIM = '#97a0b4';    // 옅은 글씨
const STAR_LINE = '#c7cfe0';   // 테마색 없는 자관 선

const CSS = `
.relmap-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px;min-height:30px}
.relmap-bar .btn{height:30px;padding:0 12px;font-size:12px}
.relmap{position:relative;height:min(74vh,740px);min-height:440px;overflow:hidden;border-radius:var(--radius,16px);
  touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;color:${STAR};
  background:
    radial-gradient(1px 1px at 12% 18%, rgba(239,231,210,.75) 50%, transparent 51%),
    radial-gradient(1px 1px at 72% 12%, rgba(239,231,210,.55) 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 38% 64%, rgba(239,231,210,.6) 50%, transparent 51%),
    radial-gradient(1px 1px at 88% 58%, rgba(239,231,210,.5) 50%, transparent 51%),
    radial-gradient(1px 1px at 22% 86%, rgba(239,231,210,.45) 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 58% 34%, rgba(239,231,210,.4) 50%, transparent 51%),
    radial-gradient(1px 1px at 6% 52%, rgba(239,231,210,.5) 50%, transparent 51%),
    radial-gradient(1px 1px at 94% 90%, rgba(239,231,210,.45) 50%, transparent 51%),
    radial-gradient(ellipse at 50% 42%, ${SKY} 0%, ${SKY_EDGE} 100%);
  background-size:260px 230px,310px 270px,370px 290px,230px 330px,290px 250px,410px 350px,330px 390px,270px 300px,100% 100%;
  box-shadow:inset 0 0 0 1px rgba(239,231,210,.08),0 18px 40px rgba(0,0,0,.28)}
.relmap:active{cursor:grabbing}
.relmap-stage{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.relmap-stage.glide{transition:transform .3s ease}
.relmap-svg{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.relmap-chart circle,.relmap-chart line{fill:none;stroke:rgba(199,207,224,.09);stroke-width:1;vector-effect:non-scaling-stroke}
.relmap-chart circle:nth-child(even){stroke-dasharray:1 6}
.relmap-ln{fill:none;stroke-width:1.4;opacity:.55;transition:opacity .2s;vector-effect:non-scaling-stroke}
.relmap-ln.lit{opacity:1;stroke-width:2.2;filter:drop-shadow(0 0 4px currentColor)}
.relmap-empty{position:absolute;inset:0;display:grid;place-items:center;color:${STAR_DIM};font-family:var(--serif);font-size:15px;letter-spacing:.04em;text-align:center;padding:24px}

/* 캐릭터 = 별: 초상 + 자기 색 테두리 + 그 색으로 번지는 빛 */
.relmap-node{position:absolute;width:${R * 2}px;margin-left:-${R}px;margin-top:-${R}px;display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:opacity .2s}
.relmap-node .face{position:relative;isolation:isolate;width:${R * 2}px;height:${R * 2}px;border-radius:50%;overflow:hidden;background:#1e2536;
  box-shadow:0 0 0 2px ${SKY},0 0 0 3.5px var(--cc),0 0 22px 2px color-mix(in srgb,var(--cc) 45%,transparent);transition:box-shadow .2s,transform .2s}
.relmap-node .face img{width:100%;height:100%;object-fit:cover}
.relmap-node b{margin-top:8px;font-family:var(--serif);font-weight:600;font-size:13.5px;letter-spacing:.06em;white-space:nowrap;color:${STAR};
  text-shadow:0 0 6px ${SKY},0 0 2px ${SKY},0 1px 0 ${SKY}}
.relmap-node:hover .face{transform:scale(1.06)}
.relmap-node.on .face{box-shadow:0 0 0 2px ${SKY},0 0 0 3.5px var(--cc),0 0 0 9px color-mix(in srgb,var(--cc) 22%,transparent),0 0 34px 6px color-mix(in srgb,var(--cc) 55%,transparent)}
.relmap-node.dim,.relmap-hub.dim{opacity:.18}

/* 다인 자관 = 네 갈래 별 */
.relmap-hub{position:absolute;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-${HUB}px);cursor:pointer;transition:opacity .2s}
.relmap-hub i{width:${HUB * 2 + 6}px;height:${HUB * 2 + 6}px;margin-top:-3px;background:var(--rc);
  clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 6px var(--rc))}
.relmap-hub span{margin-top:5px;font-family:var(--serif);font-style:italic;font-size:12.5px;letter-spacing:.03em;white-space:nowrap;color:${STAR};
  text-shadow:0 0 6px ${SKY},0 0 2px ${SKY}}
.relmap-hub.on i{transform:scale(1.25)}

/* 2인 자관 이름 — 상자 없이 선 위에 작은 별 + 기울임 세리프 */
.relmap-label{position:absolute;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;padding:4px 6px;
  font-family:var(--serif);font-style:italic;font-size:12.5px;letter-spacing:.02em;white-space:nowrap;color:${STAR_DIM};cursor:pointer;transition:opacity .2s,color .15s;
  text-shadow:0 0 5px ${SKY},0 0 2px ${SKY},0 0 1px ${SKY}}
.relmap-label i{width:7px;height:7px;background:var(--rc);transform:rotate(45deg);flex-shrink:0;box-shadow:0 0 6px var(--rc)}
.relmap-label:hover,.relmap-label:focus-visible{color:${STAR}}
.relmap-label:focus-visible{outline:1px solid ${STAR_DIM};outline-offset:2px;border-radius:4px}
.relmap-label.dim{opacity:.14}

/* 확대 버튼 */
.relmap-zoom{position:absolute;top:14px;right:14px;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;
  background:rgba(13,17,27,.72);box-shadow:inset 0 0 0 1px rgba(239,231,210,.12);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.relmap-zoom button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:${STAR};cursor:pointer}
.relmap-zoom button + button{border-top:1px solid rgba(239,231,210,.1)}
.relmap-zoom button:hover{background:rgba(239,231,210,.08)}
.relmap-zoom svg,.relmap-card svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}

/* 정보 카드 */
.relmap-card{position:absolute;left:14px;bottom:14px;width:min(300px,calc(100% - 28px));max-height:calc(100% - 28px);overflow:auto;padding:16px 16px 14px;
  border-radius:14px;background:rgba(13,17,27,.86);color:${STAR};box-shadow:inset 0 0 0 1px rgba(239,231,210,.14),0 14px 34px rgba(0,0,0,.4);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);cursor:default;animation:fade .18s}
.relmap-card .x{position:absolute;top:10px;right:10px;width:26px;height:26px;border:0;border-radius:50%;background:transparent;color:${STAR_DIM};display:grid;place-items:center;cursor:pointer}
.relmap-card .x:hover{color:${STAR};background:rgba(239,231,210,.08)}
.relmap-card .who{display:flex;align-items:center;gap:12px;padding-right:22px}
.relmap-card .who .face{position:relative;isolation:isolate;width:46px;height:46px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 0 0 2px #0d111b,0 0 0 3px var(--cc)}
.relmap-card .who .face img{width:100%;height:100%;object-fit:cover}
.relmap-card h5{margin:0;font-family:var(--serif);font-size:18px;font-weight:600;letter-spacing:.05em;line-height:1.25}
.relmap-card p{margin:3px 0 0;font-size:12px;color:${STAR_DIM};line-height:1.5}
.relmap-card ul{list-style:none;margin:12px 0 0;padding:10px 0 0;border-top:1px solid rgba(239,231,210,.1);display:grid;gap:2px}
.relmap-card li button{width:100%;display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:9px;text-align:left;border:0;background:transparent;
  color:${STAR};padding:6px 6px;border-radius:8px;cursor:pointer}
.relmap-card li button:hover{background:rgba(239,231,210,.07)}
.relmap-card li i{width:7px;height:7px;background:var(--rc);transform:rotate(45deg);box-shadow:0 0 6px var(--rc);grid-row:span 2}
.relmap-card li span{font-family:var(--serif);font-style:italic;font-size:13.5px}
.relmap-card li small{font-size:11px;color:${STAR_DIM};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.relmap-card .go{margin-top:12px;width:100%;height:34px;border-radius:9px;border:0;background:rgba(239,231,210,.12);color:${STAR};font-size:12.5px;cursor:pointer;letter-spacing:.02em}
.relmap-card .go:hover{background:rgba(239,231,210,.2)}
@media (max-width:560px){.relmap{height:70vh;min-height:380px}.relmap-tip{display:none}.relmap-card{left:10px;right:10px;bottom:10px;width:auto;max-height:46%;padding:12px 14px}.relmap-card .who .face{width:38px;height:38px}.relmap-card h5{font-size:16px}.relmap-card ul{margin-top:8px;padding-top:6px}.relmap-card li button{padding:4px 6px}.relmap-card .go{margin-top:8px}}
@media (prefers-reduced-motion:reduce){.relmap-node .face,.relmap-ln,.relmap-card{transition:none;animation:none}}
`;
