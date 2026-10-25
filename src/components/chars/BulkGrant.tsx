'use client';
// 회원 권한 한 번에 (포크) — 회원 정보 페이지(관리자 전용)에서 모든 캐릭터의 권한을 한꺼번에 준다/뺀다.
// 캐릭터가 100명이 넘으면 하나하나 누르기 힘들어서 (사용자 요청).
// 권한이 바뀌면 자관·STORY 에피소드의 「서버가 보는 편집 회원 목록」도 같이 고친다 —
// 안 고치면 권한을 줘도 그 회원의 자관 수정이 서버에서 거부된다.
// 새 파일로 따로 둔 이유: 원작 저장소 업데이트(Sync fork)와 충돌하지 않게.
import React from 'react';
import { useLocalList } from '@/lib/postStore';
import { Character, Relation, REL_SEED, charGrant } from '@/lib/charStore';
import { relEditorUids } from '@/lib/charAccess';
import { STORY_KEY, type StoryEp } from '@/lib/storyStore';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

type Level = 'edit' | 'play' | null;

/** chars/setChars는 회원 페이지의 목록을 그대로 받는다 — 따로 불러오면 페이지의 「연동된 캐릭터」가 바로 안 바뀐다 */
export function BulkGrant({ memberId, memberName, chars, setChars }: {
  memberId: string; memberName: string; chars: Character[]; setChars: (next: Character[]) => void;
}) {
  const [rels, setRels, l2] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [eps, setEps, l3] = useLocalList<StoryEp>(STORY_KEY, []);
  const ask = useConfirmDelete();
  const toast = useToast();
  if (!l2 || !l3) return null;

  const own = chars.filter(c => c.authorId === memberId).length;
  const edit = chars.filter(c => charGrant(c, memberId) === 'edit').length;
  const play = chars.filter(c => charGrant(c, memberId) === 'play').length;

  const apply = (level: Level) => {
    // 그 회원이 만든 캐릭터는 「편집까지」를 남긴다 (만든 사람 권한 — 빼면 자기 캐릭터를 못 고친다)
    const next = chars.map(c => {
      const keep = (c.grants ?? []).filter(g => g.userId !== memberId);
      const lv: Level = c.authorId === memberId && level !== 'edit' ? 'edit' : level;
      const grants = lv ? [...keep, { userId: memberId, level: lv }] : keep;
      const same = JSON.stringify(grants) === JSON.stringify(c.grants ?? []);
      return same ? c : { ...c, grants: grants.length ? grants : undefined };
    });
    const changed = next.filter((c, i) => c !== chars[i]).length;
    if (!changed) { toast('이미 그렇게 되어 있어요'); return; }
    setChars(next);
    // 자관 · STORY 에피소드의 편집 회원 목록 다시 계산 (바뀐 것만)
    const nextRels = rels.map(r => {
      const uids = relEditorUids(r, next);
      return JSON.stringify(uids) === JSON.stringify(r.editorUids ?? []) ? r : { ...r, editorUids: uids };
    });
    if (nextRels.some((r, i) => r !== rels[i])) setRels(nextRels);
    const nextEps = eps.map(e => {
      const rel = nextRels.find(r => r.id === e.relId);
      if (!rel) return e;
      const uids = relEditorUids(rel, next);
      return JSON.stringify(uids) === JSON.stringify(e.editorUids ?? []) ? e : { ...e, editorUids: uids };
    });
    if (nextEps.some((e, i) => e !== eps[i])) setEps(nextEps);
    toast(`캐릭터 ${changed}명의 권한을 바꿨어요`);
  };
  const confirm = (level: Level, label: string) => ask.ask(
    `${memberName} 님에게 캐릭터 ${chars.length}명 전부 「${label}」`,
    () => apply(level),
    level === null
      ? <>모든 캐릭터에서 이 회원의 권한을 뺍니다. 이 회원이 직접 만든 캐릭터({own}명)는 편집 권한이 남아요.</>
      : <>캐릭터마다 따로 준 권한은 이 값으로 바뀝니다.{level === 'play' && <> 이 회원이 직접 만든 캐릭터({own}명)는 편집까지 남아요.</>}</>,
    '적용',
  );

  return (
    <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 12.5, flex: '1 1 220px', minWidth: 0 }}>
        <b>모든 캐릭터에 한 번에</b>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
          전체 {chars.length}명 · 편집까지 {edit} · 역극 플레이 {play} · 이 회원이 만든 캐릭터 {own}
        </div>
      </div>
      <button type="button" className="btn btn-dark" onClick={() => confirm('edit', '캐릭터 편집(역극 포함)')}>전부 편집까지</button>
      <button type="button" className="btn btn-ghost" onClick={() => confirm('play', '역극 플레이')}>전부 역극 플레이</button>
      <button type="button" className="btn btn-ghost" onClick={() => confirm(null, '권한 없음')}>전부 해제</button>
      {ask.element}
    </div>
  );
}
