'use client';
// 갤러리 미리보기 그림 (포크 최적화 · 갤러리 벽돌형).
//
// 갤러리는 원본을 그대로 보관한다(그림 백업이라). 그런데 벽돌형 목록은 한 페이지에 40장을 띄우므로
// 원본을 그대로 받으면 몇십 MB가 오간다 — 저장소 전송량(요금)과 폰 데이터를 크게 먹는다.
// 그래서 그림마다 폭 THUMB_W짜리 작은 사본(WebP)을 따로 만들어 목록에서만 쓰고,
// 크게 보기·글 상세에서는 원본을 쓴다. 원본 크기(가로·세로)도 같이 적어 두어
// 그림이 다 받아지기 전에도 칸 높이를 미리 잡는다(화면이 덜컥거리지 않게).
//
// 이미 올린 글은 미리보기가 없다 — 관리자가 갤러리에서 「미리보기 만들기」를 한 번 누르면 채운다.
// 새 파일로 따로 둔 이유: 원작 저장소 업데이트(Sync fork)와 충돌하지 않게.
import { getBlob, putBlob } from './blobStore';

export const THUMB_W = 640;

export interface ThumbInfo { t?: string; w: number; h: number }   // t: 미리보기 파일 (없으면 원본을 쓴다 — 이미 작은 그림)

/** 저장소 주소는 같은 출처 중계로 받는다 — 저장소가 CORS 허용 헤더를 안 줘서 직접 받으면 막힌다 */
async function loadBlob(src: Blob | string): Promise<Blob | null> {
  if (typeof src !== 'string') return src;
  if (src.startsWith('data:')) { try { return await (await fetch(src)).blob(); } catch { return null; } }
  if (/^https?:/.test(src)) {
    try {
      const host = new URL(src).hostname;
      const relay = /(^|\.)firebasestorage\.googleapis\.com$|(^|\.)supabase\.(co|in)$/.test(host);
      const res = await fetch(relay ? `/api/font?u=${encodeURIComponent(src)}` : src);
      return res.ok ? await res.blob() : null;
    } catch { return null; }
  }
  return getBlob(src);
}

/** 그림 하나 → 미리보기 정보. 움짤(GIF)·SVG는 크기만 재고 미리보기는 만들지 않는다 */
export async function makeThumb(src: Blob | string): Promise<ThumbInfo | null> {
  const blob = await loadBlob(src);
  if (!blob) return null;
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { return null; }
  const w = bmp.width, h = bmp.height;
  try {
    if (/gif|svg/i.test(blob.type) || w <= THUMB_W * 1.15) return { w, h };
    const tw = THUMB_W;
    // 아주 긴 그림은 위쪽만 — 목록 칸은 어차피 높이 상한이 있다 (LONG_RATIO)
    const fullH = Math.round(h * (tw / w));
    const th = Math.min(fullH, Math.round(tw * 3));
    const canvas = document.createElement('canvas');
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { w, h };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, Math.round(th * (w / tw)), 0, 0, tw, th);
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.82));
    const file = out && out.type === 'image/webp' ? out : await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!file) return { w, h };
    return { t: await putBlob(file), w, h };
  } finally { bmp.close(); }
}

/** 글의 그림들 → 미리보기 목록 (그림 순서 그대로). 못 만든 칸은 null */
export async function makeThumbs(srcs: (Blob | string)[]): Promise<(ThumbInfo | null)[]> {
  const out: (ThumbInfo | null)[] = [];
  for (const s of srcs) out.push(await makeThumb(s));   // 하나씩 — 큰 그림 여러 장을 한꺼번에 풀면 폰이 버벅인다
  return out;
}
