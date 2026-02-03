/**
 * Vercel Serverless: 방 상태 공유 (스마트폰 등 다른 기기 뷰어용).
 * GET: 방 상태 조회 (?roomId=xxx), POST: 방 상태 갱신 (body에 roomId 포함).
 * 메모리 저장(globalThis) — 콜드 스타트 시 초기화됨. 동일 리전 웜 인스턴스에서 공유.
 */
export const config = { runtime: 'nodejs' };

// API 전용 최소 타입 (프론트 types.ts와 호환되는 형태)
interface RoomState {
  messages: Array<{ id: string; originalText: string; translations: Record<string, string>; timestamp: number; isFinal: boolean }>;
  settings: Record<string, unknown> | null;
  liveInput: string;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __livesteno_roomState: Record<string, RoomState> | undefined;
}

const getStore = (): Record<string, RoomState> => {
  if (typeof globalThis.__livesteno_roomState === 'undefined') {
    globalThis.__livesteno_roomState = {};
  }
  return globalThis.__livesteno_roomState;
};

function getRoomId(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get('roomId');
}

export async function GET(request: Request): Promise<Response> {
  const roomId = getRoomId(request);
  if (!roomId) {
    return new Response(JSON.stringify({ error: 'Missing roomId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const store = getStore();
  const state = store[roomId];
  if (!state) {
    return new Response(
      JSON.stringify({ messages: [], settings: null, liveInput: '', updatedAt: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }
  return new Response(JSON.stringify(state), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: Partial<{ roomId: string; messages: RoomState['messages']; settings: RoomState['settings']; liveInput: string }>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const roomId = body.roomId ?? getRoomId(request);
  if (!roomId) {
    return new Response(JSON.stringify({ error: 'Missing roomId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const store = getStore();
  const prev = store[roomId] || {
    messages: [],
    settings: null,
    liveInput: '',
    updatedAt: 0,
  };
  const next: RoomState = {
    messages: Array.isArray(body.messages) ? body.messages : prev.messages,
    settings: body.settings !== undefined ? body.settings : prev.settings,
    liveInput: typeof body.liveInput === 'string' ? body.liveInput : prev.liveInput,
    updatedAt: Date.now(),
  };
  store[roomId] = next;
  return new Response(JSON.stringify({ ok: true, updatedAt: next.updatedAt }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
