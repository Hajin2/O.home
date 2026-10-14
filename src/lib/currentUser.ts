'use client';
// 현재 로그인 사용자 id를 훅 밖에서도 읽기 위한 아주 작은 창구 (v2.0)
// 저장 계층(db·postStore)이 AuthProvider에 의존하지 않도록 분리했다. AuthProvider가 값을 넣어 준다.

let uid: string | null = null;

export function setCurrentUserId(id: string | null) {
  if (uid === id) return;
  uid = id;
  // 로그인 상태가 바뀌면 실시간 목록을 그 사람 기준으로 다시 연결한다 (포크, 읽기 최적화 — postStore)
  try { window.dispatchEvent(new CustomEvent('ohome-uid')); } catch { /* SSR */ }
}
export function currentUserId(): string | null { return uid; }
