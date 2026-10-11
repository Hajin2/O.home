'use client';
// 위젯 등록 (관리자 전용, 포크 기능)
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useWidgetList, widgetPath } from '@/lib/widgetStore';
import { WidgetForm } from '@/components/widgets/WidgetForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

export default function WidgetNewPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { list, loaded, save } = useWidgetList();
  if (!loaded) return <section className="page" />;
  if (!isAdmin) return <section className="page"><div className="page-head"><PageTitle>ADD WIDGET</PageTitle><p>관리자 전용</p></div></section>;
  return (
    <section className="page">
      <div className="page-head"><PageTitle>ADD WIDGET</PageTitle><p>위젯 등록 — 가져가기는 각 플랫폼의 공유 링크로, 여기서는 작동 예시를 보여 줘요</p></div>
      <WidgetForm initial={null} onCancel={() => router.push('/widgets')}
        onSave={async w => { await save([w, ...list]); toast('위젯이 등록되었습니다'); router.push(widgetPath(w)); }} />
    </section>
  );
}
