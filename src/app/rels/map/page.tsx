'use client';
// 자관 관계도 페이지 (포크 기능) — 내용은 components/rels/RelMap
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import { useRouter } from 'next/navigation';
import { RelMap } from '@/components/rels/RelMap';
import { PageTitle } from '@/components/ui/PageText';

export default function RelMapPage() {
  const router = useRouter();
  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href="/rels">RELATION MAP</PageTitle>
        <p>자관 관계도 — 캐릭터를 잇는 선이 자관이에요</p>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={() => router.push('/rels')}>☰ 목록으로</button>
        </div>
      </div>
      <RelMap />
    </section>
  );
}
