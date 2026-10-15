'use client';
// 세계관 수정 — 관리자 또는 편집 권한을 받은 회원 (세계관 편집 권한)
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useWorldList, worldPath, canEditWorld } from '@/lib/worldStore';
import { WorldForm } from '@/components/worlds/WorldForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

export default function WorldEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { list, loaded, save } = useWorldList();
  if (!loaded) return <section className="page" />;
  const w = list.find(x => x.id === id);
  if (!w || !canEditWorld(w, user?.id, isAdmin)) return <section className="page"><div className="page-head"><PageTitle>EDIT WORLD</PageTitle><p>{w ? '편집 권한이 없습니다' : '세계관을 찾을 수 없습니다'}</p></div></section>;
  return (
    <section className="page">
      <div className="page-head"><PageTitle>EDIT WORLD</PageTitle></div>
      <WorldForm initial={w} onCancel={() => router.push(worldPath(w))}
        onSave={async nw => { await save(list.map(x => (x.id === w.id ? nw : x))); toast('저장되었습니다'); router.push(worldPath(nw)); }} />
    </section>
  );
}
