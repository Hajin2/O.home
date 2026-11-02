// 캐릭터 색을 글자에 쓸 때 안 보이는 문제 (사용자 제보) — 아주 연한 색(흰색에 가까운 포인트 색)이면
// 밝은 바탕 위 이름이 사라졌다. 색 느낌은 그대로 두고 밝기만 낮춰서 읽히게 한다.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게.
import { toRgba } from '@/lib/color';

const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** 밝은 바탕에 올릴 글자 색 — 흰 바탕 대비 3:1(굵은 작은 글씨 기준)이 안 되면 같은 색조로 어둡게 */
export function readableTriple(color?: string, fallback = '#5d636d'): [number, number, number] {
  const c = toRgba(color || fallback);
  let { r, g, b } = c;
  // 반투명 색은 흰 바탕에 섞인 모습으로 본다
  if (c.a < 1) { r = r * c.a + 255 * (1 - c.a); g = g * c.a + 255 * (1 - c.a); b = b * c.a + 255 * (1 - c.a); }
  for (let i = 0; i < 40 && lum(r, g, b) > 0.3; i++) { r *= 0.92; g *= 0.92; b *= 0.92; }
  return [Math.round(r), Math.round(g), Math.round(b)];
}
export const readableText = (color?: string, fallback?: string) => `rgb(${readableTriple(color, fallback).join(',')})`;

/** 캐릭터 색 바탕 위 글자 — 바탕이 밝으면 짙은 글씨, 어두우면 흰 글씨 */
export function inkOn(bg?: string): string {
  if (!bg) return '#fff';
  const c = toRgba(bg);
  // 흰 글씨와 짙은 글씨 중 대비가 더 큰 쪽 (짙은 글씨 #2b2f36 밝기 ≈ 0.028)
  const L = lum(c.r, c.g, c.b);
  return (L + 0.05) / 0.078 >= 1.05 / (L + 0.05) ? '#2b2f36' : '#fff';
}

/** 밝은 바탕에 묻히는 아주 연한 색인가 — 말풍선 테두리·색 띠에 회색 윤곽을 더할지 정할 때 */
export function isPale(color?: string): boolean {
  if (!color) return false;
  const c = toRgba(color);
  return lum(c.r, c.g, c.b) > 0.55;
}

/** 이름 형광펜 색 — 캐릭터 색 그대로, 반투명 (연한 색 50% · 진한 색 28% — 진하게 칠하면 이름 글자가 가려진다) */
export function highlight(color?: string, fallback = '#5d636d'): string {
  const c = toRgba(color || fallback);
  return `rgba(${c.r},${c.g},${c.b},${lum(c.r, c.g, c.b) > 0.3 ? 0.5 : 0.28})`;
}
