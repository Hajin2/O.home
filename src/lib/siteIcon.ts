// 탭 아이콘을 저장소에서 직접 받지 않고 우리 주소(/api/site-icon)로 내준다 (포크 · 비용).
//
// 저장소(파이어베이스) 그림은 한국·미국 등으로 내려받는 건 무료지만 **호주·중국으로 가는 양은 무료에서 빠진다**.
// 탭 아이콘은 사람뿐 아니라 새 사이트를 훑는 봇·링크 미리보기까지 페이지마다 받아 가서,
// 어디서 들어오든 매번 저장소에서 내려받아져 호주 몫이 조금씩 청구됐다 (월 몇 원).
// 이제는 서울 서버가 한 번 받아 두고 Vercel 캐시가 나눠 준다 — 방문자가 어디 있든 저장소는 거의 안 건드린다.
// 서버(layout)와 화면(DocIcon)이 같은 주소를 쓰도록 여기 한 곳에서 만든다.

/** 아이콘이 바뀌면 캐시도 바뀌게 — 원래 주소로 만든 짧은 표 */
function tag(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** 저장소 주소면 우리 중계 주소로, 아니면(로컬 파일 등) 그대로 */
export function siteIconHref(src?: string): string | undefined {
  if (!src) return undefined;
  return /^https?:\/\//.test(src) ? `/api/site-icon?v=${tag(src)}` : src;
}
