// 탭 아이콘 중계 (포크 · 비용) — 환경설정에서 정한 아이콘을 서버가 받아 오래 캐시해 내준다.
// 왜: lib/siteIcon 설명 참고 (저장소에서 호주로 내려받는 몫이 매달 청구되던 것).
//
// 아무 주소나 대신 받아 주는 통로가 되지 않게 **주소를 받지 않는다** — 사이트 설정에 적힌 아이콘만 내준다.
import { siteMeta } from '@/lib/siteMeta';

const ALLOWED = [
  /(^|\.)firebasestorage\.googleapis\.com$/,
  /(^|\.)supabase\.co$/,
  /(^|\.)supabase\.in$/,
];

export async function GET() {
  const { favicon } = await siteMeta();
  let target: URL | null = null;
  try { target = favicon ? new URL(favicon) : null; } catch { target = null; }
  if (!target || target.protocol !== 'https:' || !ALLOWED.some(r => r.test(target!.hostname))) {
    // 지정한 아이콘이 없거나 저장소 주소가 아니면 기본 아이콘으로
    return new Response(null, { status: 302, headers: { location: '/icon-192.png', 'cache-control': 'public, max-age=3600' } });
  }
  try {
    const res = await fetch(target, { cache: 'no-store' });
    if (!res.ok || !res.body) return new Response('fetch failed', { status: 502 });
    return new Response(res.body, {
      headers: {
        'content-type': res.headers.get('content-type') ?? 'image/png',
        // 주소에 ?v=(아이콘 주소의 표)가 붙어 있어 아이콘을 바꾸면 주소도 바뀐다 — 오래 캐시해도 된다.
        // s-maxage: Vercel 캐시가 한 달 들고 있는다 (그동안 저장소는 안 건드린다)
        'cache-control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response('fetch failed', { status: 502 });
  }
}
