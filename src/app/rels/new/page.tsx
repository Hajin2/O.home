'use client';
// 자관 등록 페이지 (4.5) — 상대 캐릭터는 등록 후 상세에서 추가
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEditableWorlds, canEditChar, stampRelEditors } from '@/lib/charAccess';
import { useLocalList, newId } from '@/lib/postStore';
import { Character, CHAR_SEED, Relation, REL_SEED, RelMember } from '@/lib/charStore';
import { RelForm } from '@/components/rels/RelForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

export default function RelNewPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const editable = useEditableWorlds();   // 세계관 편집 회원도 자관 추가 (포크)
  const toast = useToast();
  const [rels, setRels, loaded] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);

  if (!loaded || !editable.loaded) return <section className="page" />;
  if (!editable.canAdd) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>ADD RELATION</PageTitle><p>자관을 추가할 권한이 없습니다</p></div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>ADD RELATION</PageTitle>
        <EditableDesc k="rels-new-desc" def="자관 등록 — 상대 캐릭터는 페이지를 만든 뒤 상세에서 추가할 수 있습니다" />
      </div>
      <RelForm
        initial={null}
        // 회원은 자기가 편집할 수 있는 캐릭터로 시작한다 (상대 캐릭터는 상세에서 추가)
        myChars={isAdmin ? chars.filter(c => c.own) : chars.filter(c => canEditChar(c, user?.id, false))}
        existingIds={rels.flatMap(r => [r.id, ...(r.slug ? [r.slug] : [])])}
        onCancel={() => router.push('/rels')}
        onSave={v => {
          // 팔레트는 캐릭터 쪽을 상세에서 그대로 읽는다 — 여기서 복사해 두면 나중에 캐릭터 색을
          // 바꿔도 자관이 따라오지 않는다 (v2.0 — 상세 페이지와 같은 규칙으로 통일)
          const members: RelMember[] = v.pickedCharIds.map(cid =>
            ({ charId: cid, quote: '', keywords: [], desc: '', palette: [] }));
          const rel: Relation = {
            id: v.slug ?? newId(),   // 지정한 페이지 주소 (v1.9) — 비우면 자동
            name: v.name, tags: v.tags, ddays: v.ddays, catchphrase: v.catchphrase, kind: v.kind,
            fontId: v.fontId, bodyFontId: v.bodyFontId, visibility: v.visibility,
            arts: v.arts, thumbId: v.arts[0], thumbCrop: v.thumbCrop,
            headerImgId: v.headerImgId, headerCrop: v.headerCrop,
            themeMode: v.themeMode, themeColor: v.themeColor, themeTone: v.themeTone,
            illuBg: v.illuBg, illuOn: v.illuOn,
            nameColor: v.nameColor, cpColor: v.cpColor, cpTagBg: v.cpTagBg, cpTagFg: v.cpTagFg,
            nameShadowColor: v.nameShadowColor, nameShadow: v.nameShadow,
            headerBgG1: v.headerBgG1, headerBgG2: v.headerBgG2, headerBgAngle: v.headerBgAngle,
            pageBgG1: v.pageBgG1, pageBgG2: v.pageBgG2, pageBgAngle: v.pageBgAngle,
            members, thumbClass: '',
            illustMode: v.kind === 'pair' ? 'duo' : 'one',
            aus: [{ id: 'base', label: '원본', catchphrase: v.catchphrase }],
            timeline: [], questions: [],
            authorId: user?.id,
          };
          setRels(stampRelEditors([...rels, rel], rels, chars));
          toast('자관이 등록되었습니다 — 상대 캐릭터·한마디 등은 상세에서 이어서');
          router.push(`/rels/${rel.id}`);
        }}
      />
    </section>
  );
}
