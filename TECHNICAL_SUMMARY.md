# LiveSteno Translate — 기술 명세서 (Technical Summary)

> 파트너 AI 인수인계용. 코드를 직접 보지 않아도 상황을 파악할 수 있도록 요약함.

---

## 1. 현재 아키텍처

### 1.1 프론트엔드 / 백엔드 구조

- **백엔드 없음.** 서버 사이드 로직이 없고, **전체가 SPA(Single Page Application)** 입니다.
- **클라이언트 구성**
  - **React 19** + **TypeScript**
  - **Vite 6** 빌드
  - **HashRouter** 기반 라우팅 (`#/room/:roomId/stenographer`, `#/room/:roomId/viewer`)
- **데이터 흐름**
  - **속기 입력·번역·표시**는 모두 **브라우저 내**에서 처리됩니다.
  - **Gemini API**는 **브라우저에서 직접** `VITE_API_KEY`로 호출합니다. (프록시/백엔드 경유 없음)
  - **실시간 동기화**는 **같은 브라우저 origin 내**에서만 이뤄지며, **BroadcastChannel API**로 구현되어 있습니다.
    - 채널명: `livesteno_channel_${roomId}`
    - 동일 origin(같은 탭/창 또는 다른 창) 간에만 메시지·설정·라이브 입력이 공유됩니다.
- **영구 저장**
  - 서버 DB 없음. **localStorage**만 사용합니다.
  - 키: `livesteno_logs_${roomId}`, `livesteno_settings_${roomId}` — 방(room) 단위로 로그·설정 저장.
- **방(room) 목록**
  - `services/roomRegistry.ts`: **메모리 기반** 단순 레지스트리. 서버 재시작/새로고침 시 초기화됩니다.

### 1.2 배포 환경

- **Vercel**에 정적 사이트로 배포됩니다.
- **리전**: `vercel.json`에 `regions: ["icn1"]` (서울) 설정.
- **빌드**: `npm run build` → `vite build` → 결과물은 `dist/` (정적 파일만 배포).
- **환경 변수**: Vercel 대시보드에서 **VITE_API_KEY** (Gemini API 키)를 설정해야 하며, **빌드 시점**에 클라이언트 번들에 인라인됩니다. 런타임 서버는 없음.

---

## 2. API 호출 로직

### 2.1 사용 라이브러리(SDK)

- **패키지**: `@google/genai` (npm, 버전 ^1.38.0)
- **용도**: Google **Gemini Developer API**(API 키 기반) 호출.  
  Vertex AI가 아니라 **Google AI Studio / generativelanguage.googleapis.com** 계열입니다.
- **초기화**: `services/geminiService.ts`에서  
  `new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY })` 로 한 번 생성 후 싱글톤처럼 export.

### 2.2 모델 및 호출 방식

- **모델명**: `gemini-1.5-flash` (상수 `GEMINI_MODEL`). 속도·비용 적정. 긴 문장에서 너무 느리면 `maxOutputTokens` 축소 또는 `gemini-1.5-pro` 검토(비용·지연 증가).
- **호출 메서드**: `this.ai.models.generateContentStream({ ... })` — **내부적으로 스트리밍** 사용. 청크를 모아서 JSON 파싱 후 **UI에는 한꺼번에** 전달(사용자 화면은 “한 번에 팍” 유지).
- **요청 형식**
  - `contents`: 한국어 → 다국어 번역, JSON만 반환하도록 짧게 압축한 프롬프트.
  - `config`: `responseMimeType: "application/json"`, `responseSchema`로 JSON 스키마 지정(언어 코드별 문자열), `temperature: 0.1`, `maxOutputTokens: 500`.
- **타임아웃**: **18초**는 **첫 청크가 올 때까지**만 적용. 데이터가 조금이라도 들어오기 시작하면 타임아웃 해제 후 스트림 끝까지 수신.
- **캐시**: 동일 텍스트·동일 대상 언어 조합에 대해 **메모리 캐시**(최대 100개) 적용. 캐시 히트 시 API 호출 없이 즉시 반환.
- **유료 전환**: Google AI Studio에서 빌링 활성화 후 동일 API 키 사용. RPM/TPM/RPD 한도 상승. **Priority 파라미터는 Gemini Developer API에 없음.** Vertex AI는 별도.
- **에러 로그**: 실패 시 **429(할당량)** vs **네트워크/타임아웃** 구분해 콘솔에 출력.

---

## 3. 실시간 처리 방식

### 3.1 이벤트 리스너 / 타이머 사용

- **타이머**
  - **setTimeout**은 **geminiService** 내부에서 **타임아웃용**으로만 사용됩니다.  
    (`Promise.race`로 18초 후 reject.)  
  - 주기적 폴링이나 `setInterval`은 사용하지 않습니다.
- **이벤트 리스너**
  - **StenographerPage**
    - **textarea `onChange`**: `handleInput` — 입력할 때마다 `broadcastService.sendLiveInput(val)` 호출.
    - **textarea `onKeyDown`**: `handleKeyDown` — Enter / Insert 키로 문장 확정 시 `processSentence(...)` 호출.
  - **옵션**
    - **자동 문장부호 전송**: `settings.autoOnPunctuation`이 true이면 `handleInput`에서 마지막 문자가 `.`, `?`, `!`일 때 즉시 `processSentence(val)` 호출 (별도 타이머 없음).
  - **ViewerPage**
    - **broadcastService.subscribe(callback)** 한 번 등록 후, 이벤트 타입별로 `setMessages` / `setLiveInput` / `setSettings` 등으로 상태 갱신.  
      (NEW_MESSAGE, UPDATE_MESSAGE, LIVE_INPUT, SYNC_SETTINGS, CLEAR_SCREEN)
- **정리**: "실시간"은 **사용자 입력 이벤트 → 즉시 BroadcastChannel 전파 + (문장 확정 시) 번역 API 1회 호출** 구조이며, **스트리밍이나 주기적 타이머 기반 수집**은 없습니다.

### 3.2 스트리밍(stream) 여부

- **스트리밍 내부 사용**  
  Gemini 호출은 `generateContentStream`으로 청크를 받아오고, **내부에서 전부 모은 뒤** JSON 파싱해 `translateText` 반환값으로 넘깁니다.  
  UI는 이전과 동일하게 “한 번에 팍” 나오는 방식 유지.
- **흐름**: 문장 확정 → `geminiService.translateText(...)` 호출(내부: 스트림 수신·병합·파싱) → `.then(...)`으로 응답 수신 후 `broadcastService.sendUpdateMessage(updatedMessage)` 및 로컬 state 업데이트.
- **타임아웃**: 첫 청크가 18초 안에 오지 않으면 타임아웃. 한 번이라도 청크가 오면 타임아웃 없이 스트림 끝까지 수신.

---

## 4. 현재 병목 구간 및 의심 사항

(배포 환경에서 AI 스튜디오 대비 느려지는 현상에 대한 코드/설계 관점 정리.)

### 4.1 API 호출이 클라이언트에서 직접 수행됨

- **사실**: Gemini API가 **브라우저 → Google 서버**로 직접 호출됩니다.  
  Vercel은 정적 호스팅만 하므로, **네트워크 경로**는 "사용자 기기 → Vercel(정적 파일) + 사용자 기기 → Google API" 입니다.
- **의심**: 사용자 네트워크/지역, CORS, 방화벽 등으로 인해 **클라이언트 → Google API** 구간이 느리거나 불안정할 수 있음.  
  AI 스튜디오는 Google 인프라 내/가까운 환경이라 상대적으로 유리할 수 있음.

### 4.2 환경 변수(VITE_API_KEY)가 빌드 시점에만 주입됨

- **사실**: Vite는 `import.meta.env.VITE_*` 를 **빌드 타임**에 치환합니다.  
  Vercel에서 **Environment Variables**에 `VITE_API_KEY`를 넣어두지 않거나, **Production 빌드에 반영되지 않으면** 런타임에 빈 값이 되어 `this.ai`가 null로 남고, 모든 번역이 실패/스킵됩니다.
- **의심**:  
  - 키가 없거나 잘못되어 초기화 실패 → 번역이 아예 안 되거나,  
  - 키가 있어도 **빌드 캐시** 등으로 이전 빌드가 배포되어 있으면 예전 설정이 나갈 수 있음.  
  → "느리다"보다 "실패·타임아웃"으로 보일 수 있음.

### 4.3 타임아웃 18초와 에러 처리

- **사실**: `TRANSLATION_TIMEOUT = 18000` ms (18초).  
  이 시간 안에 응답이 없으면 `Promise.race`로 reject 되고, 상위에서 빈 결과로 처리한 뒤 `sendUpdateMessage`로 "번역 없음" 메시지를 보냄.
- **의심**:  
  - 배포 환경에서 **첫 요청/콜드 스타트**, **네트워크 지연**, **무료 tier 한도** 등으로 18초를 넘기면 전부 타임아웃으로 처리됨.  
  - AI 스튜디오는 같은 API라도 환경/한도가 달라 더 빨리 응답할 수 있음.

### 4.4 모델명 `gemini-1.5-flash`

- **사실**: 코드에 `GEMINI_MODEL = "gemini-1.5-flash"` 로 고정. 속도·비용 적정. 긴 문장에서 너무 느리면 `maxOutputTokens` 축소 또는 `gemini-1.5-pro` 검토(비용·지연 증가). 내부적으로 `generateContentStream` 사용 중.
- **의심**:  
  - 해당 모델이 특정 리전/계정/할당량에서 제한되거나 지연이 크면, 배포 환경에서만 느리거나 타임아웃이 날 수 있음.

### 4.5 BroadcastChannel의 범위

- **사실**: BroadcastChannel은 **같은 origin**의 탭/창 간에만 동작합니다.  
  서버/다른 도메인과의 실시간 동기화는 없음.
- **참고**: 병목과는 직접 관련 없으나, "실시간"이 **같은 브라우저 origin 내**로 제한된다는 점은 인수인계 시 명확히 할 부분입니다.

### 4.6 Tailwind CDN 및 정적 리소스

- **사실**: `index.html`에서 `https://cdn.tailwindcss.com` 를 스크립트로 로드.  
  프로덕션 권장 방식(PostCSS/빌드 시 컴파일)이 아님.
- **의심**: 병목의 직접 원인은 아니지만, CDN 지연이나 캐시 이슈가 있으면 초기 로딩이 느려질 수 있음.  
  "배포 환경에서 느리다"가 **초기 로드**인지 **번역 응답**인지 구분할 때 참고 가능.

---

## 5. 요약 표 (파트너 AI용 체크리스트)

| 항목 | 내용 |
|------|------|
| 아키텍처 | SPA 전용, 백엔드 없음. Gemini는 브라우저에서 직접 호출. 실시간 동기화는 BroadcastChannel(동일 origin). |
| 배포 | Vercel 정적 배포, 리전 icn1(서울). |
| API SDK | `@google/genai`, Google Gemini Developer API(API 키). |
| 모델 | `gemini-1.5-flash`, 내부 스트리밍 `generateContentStream`. 긴 문장 시 maxOutputTokens/gemini-1.5-pro 검토 가능. |
| 실시간 | 입력 이벤트(onChange/onKeyDown) → 즉시 BroadcastChannel; 문장 확정 시 1회 번역 API 호출. 타이머는 첫 청크 18초 타임아웃용만 사용. |
| 스트리밍 | 내부 사용. 청크 수집 후 JSON 파싱해 UI에는 한꺼번에 표시. |
| 타임아웃 | 18초(첫 청크까지). 데이터가 들어오기 시작하면 타임아웃 해제. |
| 유료 | 빌링 활성화 시 한도 상승. Priority 파라미터 없음. |
| 병목 의심 | (1) 클라이언트 직통 API 호출·네트워크 (2) VITE_API_KEY 빌드 반영 여부 (3) 타임아웃 (4) 모델/할당량 (5) Tailwind CDN(로딩). |

---

*이 문서만으로도 파트너 AI가 코드 없이 전체 구조, API 사용 방식, 실시간 처리, 병목 가설을 파악할 수 있습니다.*
