'use client';
// 위젯 수정 (관리자 전용, 포크 기능)
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useWidgetList, widgetPath } from '@/lib/widgetStore';
import { WidgetForm } from '@/components/widgets/WidgetForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

export default function WidgetEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { list, loaded, save } = useWidgetList();
  if (!loaded) return <section className="page" />;
  const w = list.find(x => x.id === id);
  if (!isAdmin || !w) return <section className="page"><div className="page-head"><PageTitle>EDIT WIDGET</PageTitle><p>{w ? '관리자 전용' : '위젯을 찾을 수 없습니다'}</p></div></section>;
  return (
    <section className="page">
      <div className="page-head"><PageTitle>EDIT WIDGET</PageTitle></div>
      <WidgetForm initial={w} onCancel={() => router.push(widgetPath(w))}
        onSave={async nw => { await save(list.map(x => (x.id === w.id ? nw : x))); toast('저장되었습니다'); router.push(widgetPath(nw)); }} />
    </section>
  );
}
