'use client';
// IF 썰 (포크) — 「만약 ○○한다면?」 질문을 누르면 캐릭터들 반응이 역극처럼 펼쳐진다.
//
// 자관 문답과 연동: 자관 답변의 진짜 자리는 자관 문답(qa_answers)이다.
//   · 여러 자관에 같은 질문이 있으면 IF 카드 하나에 자관별로 모아 보여 준다 (질문 글이 같으면 같은 질문)
//   · IF에 없는 자관 질문도 카드로 자동 등장한다
//   · IF에서 자관 묶음으로 반응을 달면 자관 문답에 답변으로 저장 — 자관 페이지에도 그대로 뜬다
//     그 자관에 질문이 아직 없으면: 자관을 고칠 수 있는 사람은 질문까지 추가, 아니면 IF 반응으로 저장
//     (IF 반응으로 저장한 것도 이 화면의 그 자관 묶음 안, 자관 페이지의 「IF 썰」 칸에 보인다)
// 회원 누구나 질문·반응 작성 · 자기 글은 자기가 수정/삭제 (관리자는 전부)
import React, { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import {
  Character, CHAR_SEED, Relation, REL_SEED, QaEntry, QaAnswerRow, QA_KEY, QA_SEED, answersFor,
  charGrant, findChar, hasRelGrant,
} from '@/lib/charStore';
import { canEditRel, stampRelEditors } from '@/lib/charAccess';
import {
  IfPost, IfReaction, IF_KEY, IF_REACT_KEY, IF_SEED, IF_REACT_SEED, reactionsFor, parseReactions,
} from '@/lib/ifStore';
import { Face, CharPicker, guessChar, ReactLine, normQ, FAINT, LINE } from '@/components/ifs/IfParts';
import { Modal, useConfirmDelete } from '@/components/ui/Modal';
import { KInput, KTextarea, KSelect } from '@/components/ui/Kit';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { useToast } from '@/components/ui/Toast';

/** 자관 하나(AU 하나)의 질문 */
interface QaRef { rel: Relation; auId: string; auLabel?: string; entry: QaEntry }
/** 화면의 카드 — IF 글이 있거나, 자관 질문만으로 생긴 것 */
interface Card { id: string; key: string; title: string; date: string; post?: IfPost; refs: QaRef[] }
/** 반응 한 줄 (어디에 저장돼 있든 같은 모양으로) */
interface Item {
  key: string; name: string; text: string; charId?: string; authorId?: string;
  ifr?: IfReaction;                       // IF 반응
  qaRowId?: string; legacy?: boolean;     // 자관 문답 답변 (분리 행 / 옛 자관 안)
}
interface Group { key: string; label?: string; rel?: Relation; locked?: boolean; items: Item[] }
type Row = { name: string; text: string; charId?: string; relId?: string; group?: string };

export default function IfPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const del = useConfirmDelete();
  const [posts, setPosts, loaded] = useLocalList<IfPost>(IF_KEY, IF_SEED);
  const [reacts, setReacts, rLoaded] = useLocalList<IfReaction>(IF_REACT_KEY, IF_REACT_SEED);
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels, setRels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [qaRows, setQaRows] = useLocalList<QaAnswerRow>(QA_KEY, QA_SEED);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  const canWrite = !!user;
  const mine = (authorId?: string) => isAdmin || (!!user && !!authorId && authorId === user.id);
  const charOf = (id?: string) => (id ? chars.find(c => c.id === id) : undefined);
  const sortedChars = useMemo(() => [...chars].filter(c => c.name?.trim()).sort((a, b) => a.name.localeCompare(b.name)), [chars]);
  const relByName = useMemo(() => new Map(rels.map(r => [r.name.trim(), r])), [rels]);
  const membersOf = (relId?: string) => (relId ? rels.find(r => r.id === relId)?.members.map(m => m.charId) ?? [] : []);
  /** 자관 페이지와 같은 기준 — 그 캐릭터로 답할 수 있는가 */
  const canAnswerAs = (cid?: string) => {
    if (!cid) return false;
    if (isAdmin) return true;
    const c = findChar(chars, cid);
    return !!user && !!c && (charGrant(c, user.id) !== null || c.authorId === user.id);
  };

  /* ---------- 자관 문답 → 질문 목록 ---------- */
  const qaRefs: QaRef[] = useMemo(() => {
    const out: QaRef[] = [];
    rels.forEach(rel => {
      if (rel.qaEnabled !== false) (rel.questions ?? []).forEach(entry => out.push({ rel, auId: 'base', entry }));
      rel.aus.filter(a => a.id !== 'base').forEach(au => {
        if (au.qaEnabled === false) return;
        (au.questions ?? []).forEach(entry => out.push({ rel, auId: au.id, auLabel: au.name || au.label, entry }));
      });
    });
    return out;
  }, [rels]);

  /* ---------- 카드 = IF 글 + 같은 질문의 자관 문답 ---------- */
  const cards: Card[] = useMemo(() => {
    const byKey = new Map<string, Card>();
    posts.forEach(p => {
      const key = normQ(p.title);
      if (!byKey.has(key)) byKey.set(key, { id: p.id, key, title: p.title, date: p.date, post: p, refs: [] });
    });
    qaRefs.forEach(ref => {
      const key = normQ(ref.entry.q);
      if (!key) return;
      let c = byKey.get(key);
      if (!c) { c = { id: `qa:${key}`, key, title: ref.entry.q, date: ref.entry.date, refs: [] }; byKey.set(key, c); }
      c.refs.push(ref);
      if (!c.post && ref.entry.date > c.date) c.date = ref.entry.date;
    });
    return [...byKey.values()];
  }, [posts, qaRefs]);

  const groupsOf = (c: Card): Group[] => {
    const groups: Group[] = [];
    const ifrs = c.post ? reactionsFor(reacts, c.post.id) : [];
    const used = new Set<string>();
    const ifItem = (r: IfReaction): Item => ({ key: r.id, name: r.name, text: r.text, charId: r.charId, authorId: r.authorId, ifr: r });
    // 자관별 — 자관 문답 답변 + 그 자관으로 단 IF 반응(질문 추가 권한이 없어 IF에 저장된 것)
    c.refs.forEach((ref, i) => {
      const locked = !!ref.rel.qaHide && !canEditRel(ref.rel, chars, user?.id, isAdmin) && !hasRelGrant(ref.rel.members, chars, user?.id);
      const items: Item[] = answersFor(qaRows, ref.rel.id, ref.auId, ref.entry.no, ref.entry.answers).map((a, j) => ({
        key: a.rowId ?? `legacy-${ref.rel.id}-${ref.auId}-${ref.entry.no}-${j}`,
        name: charOf(a.charId)?.name ?? '?', text: a.text, charId: a.charId, authorId: a.authorId,
        qaRowId: a.rowId, legacy: a.rowId === undefined,
      }));
      if (c.refs.findIndex(x => x.rel.id === ref.rel.id) === i) {
        ifrs.filter(r => r.relId === ref.rel.id).forEach(r => { items.push(ifItem(r)); used.add(r.id); });
      }
      groups.push({ key: `${ref.rel.id}|${ref.auId}`, label: ref.rel.name + (ref.auLabel ? ` · ${ref.auLabel}` : ''), rel: ref.rel, locked, items });
    });
    // 나머지 IF 반응 — 묶음 이름별(처음 나온 순서), 묶음 없는 건 맨 앞
    ifrs.filter(r => !used.has(r.id)).forEach(r => {
      const key = r.relId ? `rel:${r.relId}` : `g:${r.group ?? ''}`;
      let g = groups.find(x => x.key === key);
      if (!g) {
        const rel = r.relId ? rels.find(x => x.id === r.relId) : undefined;
        g = { key, label: rel?.name ?? r.group, rel, items: [] };
        if (!g.label) groups.unshift(g); else groups.push(g);
      }
      g.items.push(ifItem(r));
    });
    return groups.filter(g => g.items.length || g.rel);
  };

  // 검색 — 질문·상황·자관 이름 + 보이는 모든 반응(IF 반응·자관 문답 답변)의 캐릭터 이름·별명.
  // 답변을 가린 자관(비공개 답변)은 이름으로도 찾히지 않게 한다
  const list = (() => {
    const k = q.trim().toLowerCase();
    const hit = (s?: string) => !!s && s.toLowerCase().includes(k);
    return cards
      .filter(c => !k || hit(c.title) || hit(c.post?.situation) || c.refs.some(r => hit(r.rel.name))
        || groupsOf(c).some(g => !g.locked && g.items.some(it => hit(it.name) || hit(charOf(it.charId)?.name))))
      .sort((a, b) => b.date.localeCompare(a.date));
  })();

  const toggle = (id: string) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* ---------- 질문 등록/수정 ---------- */
  const [pOpen, setPOpen] = useState(false);
  const [pId, setPId] = useState<string | null>(null);
  const [pTitle, setPTitle] = useState('');
  const [pSit, setPSit] = useState('');
  const openNewPost = () => { setPId(null); setPTitle(''); setPSit(''); setPOpen(true); };
  const openEditPost = (p: IfPost) => { setPId(p.id); setPTitle(p.title); setPSit(p.situation ?? ''); setPOpen(true); };
  const newPost = (title: string, situation?: string): IfPost => ({
    id: newId(), title, situation, author: user?.nickname ?? '관리자', authorId: user?.id ?? 'admin',
    date: new Date().toISOString(), visibility: 'public',
  });

  const savePost = () => {
    const title = pTitle.trim().replace(/^《\s*|\s*》$/g, '');
    if (!title) { toast('질문을 입력해 주세요'); return; }
    if (pId) {
      setPosts(posts.map(p => p.id === pId ? { ...p, title, situation: pSit.trim() || undefined } : p));
      // IF가 메인 — 같은 질문으로 묶여 있던 자관 질문 글도 같이 고친다 (안 그러면 글이 달라져 카드가 갈라진다)
      const card = cards.find(c => c.post?.id === pId);
      const ok = (card?.refs ?? []).filter(r => canEditRel(r.rel, chars, user?.id, isAdmin));
      if (ok.length && card && card.title !== title) {
        const hit = (relId: string, auId: string, no: number) => ok.some(r => r.rel.id === relId && r.auId === auId && r.entry.no === no);
        const next = rels.map(rel => (!ok.some(r => r.rel.id === rel.id) ? rel : {
          ...rel,
          questions: (rel.questions ?? []).map(e => (hit(rel.id, 'base', e.no) ? { ...e, q: title } : e)),
          aus: rel.aus.map(au => (au.id === 'base' || !au.questions ? au
            : { ...au, questions: au.questions.map(e => (hit(rel.id, au.id, e.no) ? { ...e, q: title } : e)) })),
        }));
        setRels(stampRelEditors(next, rels, chars));
      }
      setPOpen(false);
      return;
    }
    const same = cards.find(c => c.key === normQ(title));
    if (same?.post) { toast('같은 질문이 이미 있어요 — 그 카드에 반응을 달아 주세요'); setOpen(s => new Set(s).add(same.id)); setPOpen(false); return; }
    const p = newPost(title, pSit.trim() || undefined);
    setPosts([...posts, p]);
    const cardId = p.id;
    setOpen(s => new Set(s).add(cardId));
    setPOpen(false);
  };
  /* ---------- 카드 삭제 — IF가 메인: IF 글 + 반응 + 같은 질문의 자관 문답(질문·답변)까지 전부 ----------
     자관 질문을 지우는 건 자관을 고치는 일이라 그 자관을 고칠 수 있는 사람만 된다(서버 규칙).
     권한 없는 자관이 섞여 있으면 그 자관 것만 남기고 알려 준다. */
  const canDelCard = (c: Card) => isAdmin
    || (c.post ? mine(c.post.authorId) : c.refs.length > 0 && c.refs.every(r => canEditRel(r.rel, chars, user?.id, isAdmin)));
  const removeCard = (c: Card) => {
    const relNames = [...new Set(c.refs.map(r => r.rel.name))];
    del.ask(`《${c.title}》를 삭제하시겠습니까?`, () => {
      if (c.post) {
        const pid = c.post.id;
        setPosts(posts.filter(x => x.id !== pid));
        setReacts(reacts.filter(r => !(r.ifId === pid && mine(r.authorId))));
      }
      const ok = c.refs.filter(r => canEditRel(r.rel, chars, user?.id, isAdmin));
      const kept = c.refs.length - ok.length;
      if (ok.length) {
        const gone = (relId: string, auId: string, no: number) => ok.some(r => r.rel.id === relId && r.auId === auId && r.entry.no === no);
        const next = rels.map(rel => {
          if (!ok.some(r => r.rel.id === rel.id)) return rel;
          return {
            ...rel,
            questions: (rel.questions ?? []).filter(e => !gone(rel.id, 'base', e.no)),
            aus: rel.aus.map(au => (au.id === 'base' || !au.questions ? au
              : { ...au, questions: au.questions.filter(e => !gone(rel.id, au.id, e.no)) })),
          };
        });
        setRels(stampRelEditors(next, rels, chars));
        // 그 질문의 자관 답변 — 지울 수 있는 것만 (남의 답변은 서버 규칙상 관리자만. 질문이 없어지면 어디에도 안 보인다)
        setQaRows(qaRows.filter(r => !(gone(r.relId, r.auId, r.no) && (isAdmin || mine(r.authorId)))));
      }
      if (kept) toast(`편집 권한이 없는 자관 ${kept}곳의 질문은 남겨 뒀어요 — 그 자관 주인이 지울 수 있어요`);
    }, relNames.length
      ? <>IF 반응과 함께 <b>{relNames.join(', ')}</b> 자관의 QUESTIONS 탭에서도 이 질문과 답변이 삭제됩니다. 복구할 수 없습니다.</>
      : 'IF에 단 반응도 함께 삭제됩니다. 복구할 수 없습니다.');
  };

  /* ---------- 반응 달기 (한 줄 / 여러 줄) ---------- */
  const [rCard, setRCard] = useState<Card | null>(null);
  const [rEdit, setREdit] = useState<Item | null>(null);
  const [rChar, setRChar] = useState('');
  const [rName, setRName] = useState('');
  const [rRel, setRRel] = useState('');
  const [rText, setRText] = useState('');
  const [rBulk, setRBulk] = useState('');
  const [rMode, setRMode] = useState<'one' | 'many'>('one');
  const [rMap, setRMap] = useState<Record<string, string>>({});
  function openAdd(card: Card, bulk = '') {
    setRCard(card); setREdit(null); setRChar(''); setRName(''); setRRel(''); setRText('');
    setRBulk(bulk); setRMap({}); setRMode(bulk ? 'many' : 'one');
  }
  const openEdit = (card: Card, it: Item) => {
    setRCard(card); setREdit(it); setRMode('one'); setRText(it.text);
    setRChar(it.charId ?? ''); setRName(it.ifr ? (it.charId && it.ifr.name === charOf(it.charId)?.name ? '' : it.ifr.name) : '');
    setRRel(it.ifr?.relId ?? '');
  };
  const bulkRows = useMemo(() => parseReactions(rBulk), [rBulk]);
  const bulkNames = useMemo(() => {
    const seen = new Map<string, string | undefined>();
    bulkRows.forEach(r => { if (!seen.has(r.name)) seen.set(r.name, r.group); });
    return [...seen.entries()].map(([name, group]) => ({ name, group }));
  }, [bulkRows]);
  const mapOf = (name: string, group?: string) => (name in rMap
    ? rMap[name] : guessChar(name, sortedChars, membersOf(group ? relByName.get(group)?.id : undefined)));

  /** 반응 저장 — 자관 묶음이면 자관 문답으로, 아니면 IF 반응으로. 저장 위치별 개수를 돌려준다 */
  const commit = (card: Card, rows: Row[]) => {
    const now = new Date().toISOString();
    let post = card.post;
    const newPosts: IfPost[] = [];
    const ensurePost = () => {
      if (!post) { post = newPost(card.title); newPosts.push(post); }
      return post;
    };
    const qaNew: QaAnswerRow[] = [];
    const ifNew: IfReaction[] = [];
    const addQ = new Map<string, QaEntry>();   // 자관 id → 새로 추가할 질문
    const base = card.post ? reactionsFor(reacts, card.post.id) : [];
    let order = Math.max(-1, ...base.map(r => r.order)) + 1;
    let toQa = 0, toIf = 0, added = 0;
    for (const row of rows) {
      const rel = row.relId ? rels.find(r => r.id === row.relId) : undefined;
      const member = !!rel && !!row.charId && rel.members.some(m => m.charId === row.charId);
      if (rel && member && canAnswerAs(row.charId)) {
        const ref = card.refs.find(r => r.rel.id === rel.id && r.auId === 'base') ?? card.refs.find(r => r.rel.id === rel.id);
        let target: { auId: string; no: number } | null = ref ? { auId: ref.auId, no: ref.entry.no } : null;
        if (!target && canEditRel(rel, chars, user?.id, isAdmin)) {
          let e = addQ.get(rel.id);
          if (!e) {
            const no = Math.max(0, ...(rel.questions ?? []).map(x => x.no)) + 1;
            e = { no, q: card.title, date: now.slice(0, 10), answers: [] };
            addQ.set(rel.id, e); added += 1;
          }
          target = { auId: 'base', no: e.no };
        }
        if (target) {
          qaNew.push({ id: newId(), relId: rel.id, auId: target.auId, no: target.no, charId: row.charId!, text: row.text, authorId: user?.id, date: now });
          toQa += 1;
          continue;
        }
      }
      ifNew.push({
        id: newId(), ifId: ensurePost().id, name: row.name, text: row.text, charId: row.charId || undefined,
        group: rel?.name ?? row.group, relId: rel?.id,
        author: user?.nickname ?? '관리자', authorId: user?.id ?? 'admin', date: now, order: order++, visibility: 'public',
      });
      toIf += 1;
    }
    if (newPosts.length) setPosts([...posts, ...newPosts]);
    if (addQ.size) {
      const next = rels.map(r => {
        const e = addQ.get(r.id);
        return e ? { ...r, questions: [e, ...(r.questions ?? [])], qaEnabled: true } : r;
      });
      setRels(stampRelEditors(next, rels, chars));
    }
    if (qaNew.length) setQaRows([...qaRows, ...qaNew]);
    if (ifNew.length) setReacts([...reacts, ...ifNew]);
    return { toQa, toIf, added };
  };

  const saveReact = () => {
    if (!rCard) return;
    // 수정
    if (rEdit) {
      const text = rText.trim();
      if (!text) { toast('반응을 입력해 주세요'); return; }
      if (rEdit.qaRowId) {
        setQaRows(qaRows.map(r => (r.id === rEdit.qaRowId ? { ...r, text } : r)));
      } else if (rEdit.ifr) {
        const ch = sortedChars.find(c => c.id === rChar);
        const name = rName.trim() || ch?.name || rEdit.ifr.name;
        const rel = rels.find(x => x.id === rRel);
        setReacts(reacts.map(r => (r.id === rEdit.ifr!.id ? { ...r, name, text, charId: ch?.id, relId: rel?.id, group: rel?.name } : r)));
      }
      setRCard(null);
      return;
    }
    let rows: Row[];
    if (rMode === 'many') {
      if (!bulkRows.length) { toast('「이름: 반응」 형식의 줄을 찾지 못했어요'); return; }
      rows = bulkRows.map(r => ({ ...r, charId: mapOf(r.name, r.group) || undefined, relId: r.group ? relByName.get(r.group)?.id : undefined }));
    } else {
      const ch = sortedChars.find(c => c.id === rChar);
      const name = rName.trim() || ch?.name || '';
      if (!name) { toast('캐릭터를 고르거나 이름을 입력해 주세요'); return; }
      if (!rText.trim()) { toast('반응을 입력해 주세요'); return; }
      rows = [{ name, text: rText.trim(), charId: ch?.id, relId: rRel || undefined }];
    }
    const res = commit(rCard, rows);
    if (res.toQa) toast(`자관 문답에 ${res.toQa}개 저장했어요${res.added ? ` (질문 ${res.added}개 새로 추가)` : ''}${res.toIf ? ` · IF에 ${res.toIf}개` : ''}`);
    setRCard(null);
  };
  const removeItem = (it: Item) => del.ask(`「${charOf(it.charId)?.name ?? it.name}」 반응을 삭제하시겠습니까?`, () => {
    if (it.qaRowId) setQaRows(qaRows.filter(r => r.id !== it.qaRowId));
    else if (it.ifr) setReacts(reacts.filter(r => r.id !== it.ifr!.id));
  }, it.qaRowId ? '자관 문답에 저장된 답변이라 자관 페이지에서도 사라져요.' : undefined);

  if (!loaded || !rLoaded) return <section className="page" />;

  const relOptions = [{ value: '', label: '묶음 없음' }, ...rels.map(r => ({ value: r.id, label: r.name }))];

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>IF</PageTitle>
        <EditableDesc k="ifs-desc" def="만약 ○○한다면? — 눌러서 우리 캐릭터들 반응 보기 · 자관 문답도 한곳에" />
        <div className="head-actions">
          {canWrite && <button className="btn btn-dark" onClick={openNewPost}>＋ IF</button>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <KInput placeholder="질문·자관·캐릭터 이름 검색" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 260 }} />
      </div>

      {list.length === 0 && <p className="hint">{q ? '찾는 IF가 없어요' : '아직 IF가 없어요 — ＋ IF로 첫 질문을 올려 보세요'}</p>}

      <div style={{ display: 'grid', gap: 10 }}>
        {list.map(c => {
          const isOpen = open.has(c.id);
          const groups = groupsOf(c);
          const all = groups.flatMap(g => (g.locked ? [] : g.items));
          const relNames = [...new Set(c.refs.map(r => r.rel.name))];
          return (
            <div key={c.id} className="panel if-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => toggle(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}>
                <span style={{ fontSize: 12, color: FAINT, transform: isOpen ? 'rotate(90deg)' : 'none', transition: '.15s' }}>▶</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.01em' }}>《{c.title}》</div>
                  <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    반응 {all.length}
                    {relNames.length > 0 && <> · 자관 {relNames.length > 3 ? `${relNames.slice(0, 3).join(', ')} 외 ${relNames.length - 3}` : relNames.join(', ')}</>}
                    {c.post && <> · {c.post.author}</>} · {c.date.slice(0, 10).replace(/-/g, '.')}
                  </div>
                </div>
                {all.length > 0 && (
                  <div style={{ display: 'flex' }}>
                    {all.slice(0, 5).map((it, i) => (
                      <div key={it.key} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: '0 0 0 2px var(--panel, #fff)' }}>
                        <Face ch={charOf(it.charId)} name={it.name} size={24} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isOpen && (
                <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${LINE}` }}>
                  {c.post?.situation && (
                    <div style={{ margin: '14px 0 6px', padding: '10px 14px', borderLeft: '3px solid var(--accent, #888)', background: 'rgba(0,0,0,.03)', borderRadius: '0 8px 8px 0', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {c.post.situation}
                    </div>
                  )}
                  {groups.map(g => (
                    <div key={g.key} style={{ marginTop: 10 }}>
                      {g.label && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 2px' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 800, padding: '2px 10px', borderRadius: 999, background: 'var(--ink, #222)', color: 'var(--bg, #fff)' }}>
                            {g.rel ? <a href={`/rels/${g.rel.slug || g.rel.id}`} style={{ color: 'inherit' }}>#{g.label}</a> : `#${g.label}`}
                          </span>
                          {g.rel && c.refs.some(r => r.rel.id === g.rel!.id) && <span style={{ fontSize: 10.5, color: FAINT }}>자관 문답</span>}
                          <span style={{ flex: 1, height: 1, background: LINE }} />
                        </div>
                      )}
                      {g.locked
                        ? <p className="hint" style={{ margin: '6px 0' }}>비공개 답변</p>
                        : g.items.map(it => {
                          const ch = charOf(it.charId);
                          const nick = it.ifr && ch && it.ifr.name !== ch.name ? it.ifr.name : undefined;
                          const can = !it.legacy && mine(it.authorId);
                          return (
                            <ReactLine key={it.key} name={it.name} text={it.text} ch={ch}
                              note={nick ?? (it.legacy ? '자관에서 수정' : undefined)}
                              tools={can ? <>
                                <span className="fx" style={{ cursor: 'pointer' }} onClick={() => openEdit(c, it)}>수정</span>
                                <span className="fx" style={{ cursor: 'pointer' }} onClick={() => removeItem(it)}>삭제</span>
                              </> : undefined} />
                          );
                        })}
                      {!g.locked && g.items.length === 0 && <p className="hint" style={{ margin: '6px 0' }}>아직 답변이 없어요</p>}
                    </div>
                  ))}
                  {groups.length === 0 && <p className="hint" style={{ marginTop: 12 }}>아직 반응이 없어요</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    {canWrite && <button className="btn btn-ghost" onClick={() => openAdd(c)}>＋ 반응 달기</button>}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 12, color: FAINT }}>
                      {c.post && mine(c.post.authorId) && <span className="fx" style={{ cursor: 'pointer' }} onClick={() => openEditPost(c.post!)}>질문 수정</span>}
                      {canDelCard(c) && <span className="fx" style={{ cursor: 'pointer' }} onClick={() => removeCard(c)}>삭제</span>}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 질문 등록/수정 */}
      <Modal open={pOpen} onClose={() => setPOpen(false)} title={pId ? 'IF 수정' : '새 IF'} dirty
        actions={<>
          <button className="btn btn-ghost" onClick={() => setPOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={savePost}>{pId ? 'SAVE' : 'ADD'}</button>
        </>}>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12, color: FAINT }}>질문 — 자관 문답에 같은 질문이 있으면 한 카드로 묶여요</label>
          <KInput placeholder="누군가 번호를 물어본다!" value={pTitle} onChange={e => setPTitle(e.target.value)} />
          <label style={{ fontSize: 12, color: FAINT }}>상황 (선택)</label>
          <KTextarea rows={2} placeholder="A : 너무 제 취향이라 그런데 번호 좀 주실 수 있을까요?ㅠㅠ" value={pSit} onChange={e => setPSit(e.target.value)} />
          {!pId && <p className="hint" style={{ margin: 0 }}>반응은 질문을 만든 뒤 카드의 ＋ 반응 달기로 달아요.</p>}
        </div>
      </Modal>

      {/* 반응 달기/수정 */}
      <Modal open={rCard !== null} onClose={() => setRCard(null)} title={rEdit ? '반응 수정' : '반응 달기'} dirty
        actions={<>
          <button className="btn btn-ghost" onClick={() => setRCard(null)}>CANCEL</button>
          <button className="btn btn-dark" onClick={saveReact}>{rEdit ? 'SAVE' : rMode === 'many' && bulkRows.length ? `ADD ${bulkRows.length}` : 'ADD'}</button>
        </>}>
        <div style={{ display: 'grid', gap: 10 }}>
          {rEdit?.qaRowId ? (
            <>
              <p className="hint" style={{ margin: 0 }}>자관 문답에 저장된 답변이에요 — 고치면 자관 페이지에도 반영돼요.</p>
              <ReactLine name={rEdit.name} text={rText || '…'} ch={charOf(rEdit.charId)} />
              <KTextarea rows={3} value={rText} onChange={e => setRText(e.target.value)} />
            </>
          ) : (
            <>
              {!rEdit && (
                <div className="mini-seg" style={{ justifySelf: 'start' }}>
                  <button className={rMode === 'one' ? 'on' : ''} onClick={() => setRMode('one')}>하나씩</button>
                  <button className={rMode === 'many' ? 'on' : ''} onClick={() => setRMode('many')}>여러 줄 한 번에</button>
                </div>
              )}
              {rMode === 'one' ? (
                <>
                  <label style={{ fontSize: 12, color: FAINT }}>자관 묶음 (선택) — 자관 캐릭터로 달면 자관 문답에 저장돼요</label>
                  <KSelect value={rRel} onChange={setRRel} minWidth={220} maxWidth={320} options={relOptions} />
                  <label style={{ fontSize: 12, color: FAINT }}>캐릭터</label>
                  <CharPicker chars={sortedChars} value={rChar} onChange={setRChar} prefer={membersOf(rRel)} />
                  <label style={{ fontSize: 12, color: FAINT }}>{rChar ? '별명으로 보이게 (선택) — 비우면 캐릭터 이름' : '목록에 없는 캐릭터면 이름 직접 입력'}</label>
                  <KInput placeholder={rChar ? '찬' : '이름'} value={rName} onChange={e => setRName(e.target.value)} />
                  <label style={{ fontSize: 12, color: FAINT }}>반응 — (괄호)는 지문으로 보여요</label>
                  <KTextarea rows={3} placeholder="ㅎㅎ (재현이 번호 줌)" value={rText} onChange={e => setRText(e.target.value)} />
                </>
              ) : (
                <>
                  <label style={{ fontSize: 12, color: FAINT }}>한 줄에 「이름: 반응」 · <code>&lt;#자관이름&gt;</code> 줄 아래는 그 자관으로 (자관 문답에 저장)</label>
                  <KTextarea rows={7} placeholder={'키이라: 무시\n은우: 아앗 ㅎㅎ; 죄송합니다~\n<#찬박도태>\n찬: ㅎㅎ (재현이 번호 줌)\n박하: (귀찮아서 찬성이 번호 주고 감)'}
                    value={rBulk} onChange={e => setRBulk(e.target.value)} />
                  {bulkNames.length > 0 && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 12, color: FAINT }}>
                        반응 {bulkRows.length}개 · 이름마다 캐릭터를 골라 주세요 (자동으로 찾은 건 미리 골라 뒀어요)
                      </div>
                      {bulkNames.map(({ name, group }) => {
                        const rid = group ? relByName.get(group)?.id : undefined;
                        const prefer = membersOf(rid);
                        const opts = [...sortedChars].sort((x, y) => Number(prefer.includes(y.id)) - Number(prefer.includes(x.id)));
                        return (
                          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <b style={{ flex: 'none', width: 70, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</b>
                            <span style={{ color: FAINT }}>→</span>
                            <KSelect value={mapOf(name, group)} onChange={v => setRMap(m => ({ ...m, [name]: v }))} minWidth={200} maxWidth={280}
                              options={[{ value: '', label: <span style={{ color: FAINT }}>연결 안 함 (이름만)</span> },
                                ...opts.map(c => ({ value: c.id, label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Face ch={c} name={c.name} size={20} />{c.name}{prefer.includes(c.id) ? ' ★' : ''}</span> }))]} />
                            {group && !rid && <span style={{ fontSize: 11, color: FAINT }}>「{group}」 자관 없음</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Modal>
      {del.element}
    </section>
  );
}
