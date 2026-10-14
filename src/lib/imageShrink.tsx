'use client';
// 업로드 이미지 자동 축소 (포크 최적화) — 휴대폰 사진(3~5MB)·큰 그림이 원본 그대로 저장소에 올라가,
// 목록 썸네일까지 원본을 받아 오느라 Supabase 무료 요금제의 전송량·저장 공간을 크게 먹었다.
// 올리기 직전에 긴 변을 MAX_SIDE로 줄이고 다시 압축한다. 화면에서 보기에는 차이가 거의 없다.
//   · 대상: 사람이 직접 고른 파일(File)의 JPG·PNG·WebP 중 SKIP_UNDER보다 큰 것
//   · 그대로: GIF(움짤) · SVG · 글·폰트 등 이미지가 아닌 파일 · 이미 작은 이미지 · 줄여도 별로 안 작아지는 이미지
//   · PNG는 투명 배경을 지키려고 WebP로 (브라우저가 WebP를 못 만들면 PNG 그대로 줄이기만)
//   · 사진 방향(EXIF 회전)은 그대로 반영된다
// 설정: 환경설정 > 메뉴 관리(권한) 「업로드 이미지 자동 축소」 — 끄기 · 갤러리(그림 백업)는 원본 유지(기본)
// 설정은 메뉴 설정(ohome.menuset.v1) 안에 imgShrink로 함께 저장한다 — 원작 SETTING_KEYS를 건드리지 않으려고.
// 새 파일로 따로 둔 이유: 원작 저장소가 업데이트돼도 충돌하지 않게 (원작 blobStore에서는 한 줄만 부른다).
import React from 'react';
import { useMenuSettings, currentMenuSettings, type MenuSettings } from './menuStore';
import { KCheck } from '@/components/ui/Kit';

export const MAX_SIDE = 2560;                 // 긴 변 최대 (px)
const SKIP_UNDER = 1.2 * 1024 * 1024;         // 이보다 작은 파일은 건드리지 않는다
const QUALITY = 0.88;

interface ShrinkConf { off?: boolean; gallery?: boolean }   // gallery: true면 갤러리도 줄인다 (기본은 원본 유지)
type WithShrink = MenuSettings & { imgShrink?: ShrinkConf };

const confNow = (): ShrinkConf => {
  try { return (currentMenuSettings() as WithShrink).imgShrink ?? {}; } catch { return {}; }
};

async function decode(blob: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; done: () => void } | null> {
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { img: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
  } catch { /* 아래로 */ }
  try {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('decode')); img.src = url; });
    return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch { return null; }
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>(res => { try { c.toBlob(b => res(b), type, q); } catch { res(null); } });

/** 업로드 직전 축소 — 줄일 필요가 없거나 실패하면 원본을 그대로 돌려준다 (업로드를 막지 않는다) */
export async function shrinkImage(blob: Blob): Promise<Blob> {
  try {
    if (typeof File === 'undefined' || !(blob instanceof File)) return blob;   // 직접 고른 파일만
    const t = (blob.type || '').toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(t)) return blob;                // GIF·SVG 등은 그대로
    if (blob.size < SKIP_UNDER) return blob;
    const conf = confNow();
    if (conf.off) return blob;
    if (!conf.gallery && typeof location !== 'undefined' && /^\/gallery(\/|$)/.test(location.pathname)) return blob;

    const d = await decode(blob);
    if (!d || !d.w || !d.h) return blob;
    const scale = Math.min(1, MAX_SIDE / Math.max(d.w, d.h));
    const w = Math.max(1, Math.round(d.w * scale));
    const h = Math.max(1, Math.round(d.h * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) { d.done(); return blob; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(d.img, 0, 0, w, h);
    d.done();

    // JPG는 JPG로, PNG·WebP는 투명 배경을 지키는 WebP로
    const want = t.includes('jpeg') || t.includes('jpg') ? 'image/jpeg' : 'image/webp';
    let out = await toBlob(c, want, QUALITY);
    if (out && want === 'image/webp' && out.type !== 'image/webp') out = await toBlob(c, 'image/png', 1);   // WebP 미지원 브라우저
    c.width = 0; c.height = 0;
    if (!out || out.size >= blob.size * 0.9) return blob;   // 별로 안 작아지면 원본

    const ext = out.type === 'image/jpeg' ? 'jpg' : out.type === 'image/webp' ? 'webp' : 'png';
    const name = blob.name.replace(/\.[^.]+$/, '') + '.' + ext;
    return new File([out], name, { type: out.type, lastModified: blob.lastModified });
  } catch (e) {
    console.warn('[ohome] 이미지 축소 건너뜀', e);
    return blob;
  }
}

/** 환경설정 > 메뉴 관리 > 권한 — 「글 복사 방지」 아래에 붙는 체크 칸 */
export function ImageShrinkOptions() {
  const [ms, patch] = useMenuSettings();
  const cur = (ms as WithShrink).imgShrink ?? {};
  const set = (p: Partial<ShrinkConf>) => patch({ imgShrink: { ...cur, ...p } } as unknown as Partial<MenuSettings>);
  return (
    <div style={{ marginTop: 18 }}>
      <b style={{ fontSize: 13 }}>업로드 이미지 자동 축소</b>
      <div className="d" style={{ marginTop: 4 }}>
        큰 사진·그림을 올릴 때 긴 변 {MAX_SIDE}px로 줄여 저장합니다 — 서버 전송량·저장 공간 절약 · 화면에서 보기엔 차이가 거의 없음 ·
        GIF(움짤)·1.2MB 이하 이미지는 그대로 · 이미 올린 이미지는 바뀌지 않음
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        <KCheck label="자동 축소 켜기" checked={!cur.off} onChange={v => set({ off: !v })} />
        <KCheck label="갤러리(그림 백업)도 축소 — 끄면 원본 그대로" checked={!!cur.gallery} onChange={v => set({ gallery: v })} />
      </div>
    </div>
  );
}
