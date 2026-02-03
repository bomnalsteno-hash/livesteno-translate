/**
 * 방 상태를 서버에 올리고, 다른 기기(스마트폰 등) 뷰어가 조회·폴링할 수 있게 함.
 * BroadcastChannel은 같은 기기 내 탭만 공유하므로, QR로 스마트폰에서 들어온 뷰어는 이 API로만 수신 가능.
 */
import type { StenoMessage, AppSettings } from '../types';

export interface RoomStatePayload {
  messages: StenoMessage[];
  settings: AppSettings | null;
  liveInput: string;
  updatedAt?: number;
}

const getBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
};

/**
 * 서버에 저장된 방 상태 조회. (뷰어가 다른 기기에서 폴링할 때 사용)
 * 로컬 개발(npm run dev)에서는 /api가 없어 404가 나올 수 있음 → null 반환.
 */
export async function getRoomState(roomId: string): Promise<RoomStatePayload | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/room?roomId=${encodeURIComponent(roomId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RoomStatePayload;
    return {
      messages: Array.isArray(data.messages) ? data.messages : [],
      settings: data.settings ?? null,
      liveInput: typeof data.liveInput === 'string' ? data.liveInput : '',
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * 서버에 방 상태 갱신. (속기 탭에서 메시지/설정/라이브 입력 변경 시 호출)
 * 로컬 개발에서는 /api가 없어 실패할 수 있음 → 무시.
 */
export async function setRoomState(
  roomId: string,
  payload: Partial<{ messages: StenoMessage[]; settings: AppSettings; liveInput: string }>
): Promise<void> {
  const base = getBaseUrl();
  if (!base) return;
  try {
    await fetch(`${base}/api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, ...payload }),
    });
  } catch {
    // 로컬 개발 등 API 미동작 시 무시
  }
}

/** 한 객체로 묶어서 named export (ViewerPage, StenographerPage에서 import { roomSyncService } 사용) */
export const roomSyncService = {
  getRoomState,
  setRoomState,
};
