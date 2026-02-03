import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LanguageCode, TranslationMap } from "../types";

// 기본: gemini-1.5-flash (속도·비용 적정). 긴 문장에서 너무 느리면 maxOutputTokens 축소 또는 gemini-1.5-pro 검토(비용·지연 증가).
// 유료 전환: Google AI Studio에서 빌링 활성화 후 동일 API 키 사용. RPM/TPM/RPD 한도 상승. Priority 파라미터는 Gemini Developer API에 없음.
// 내부적으로 generateContentStream 사용: 청크를 모아서 한꺼번에 JSON 파싱 후 UI에는 완성된 결과만 표시(타임아웃 완화).
const GEMINI_MODEL = "gemini-1.5-flash";
const MIN_TRANSLATION_LENGTH = 2;
const CACHE_SIZE = 100;
const FIRST_CHUNK_TIMEOUT_MS = 18000; // 18초: 첫 청크가 올 때까지만 적용. 데이터가 조금이라도 오기 시작하면 타임아웃 해제.

interface CacheEntry {
  translations: TranslationMap;
  timestamp: number;
}

class GeminiService {
  private ai: GoogleGenAI | null = null;
  private translationCache: Map<string, CacheEntry> = new Map();

  constructor() {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) {
      // API 키 형식 검증 (Google API 키는 보통 특정 형식을 가짐)
      if (apiKey.length < 20) {
        console.error("VITE_API_KEY appears to be invalid (too short). Check your environment variable.");
      } else {
        console.log("Gemini API key found, initializing service...");
        this.ai = new GoogleGenAI({ apiKey });
      }
    } else {
      console.error("❌ VITE_API_KEY is missing from environment variables.");
      console.error("Please set VITE_API_KEY in Vercel environment variables.");
    }
  }

  private getCacheKey(text: string, languages: LanguageCode[]): string {
    return `${text}::${languages.sort().join(',')}`;
  }

  private shouldSkipTranslation(text: string): boolean {
    const trimmed = text.trim();
    // 너무 짧은 텍스트 스킵
    if (trimmed.length < MIN_TRANSLATION_LENGTH) return true;
    // 특수문자/이모지만 있는 경우 스킵
    if (/^[^\w가-힣]+$/.test(trimmed)) return true;
    return false;
  }

  public async translateText(
    text: string,
    targetLanguages: LanguageCode[]
  ): Promise<TranslationMap> {
    if (!this.ai) {
      console.error("Gemini AI service not initialized. Check VITE_API_KEY environment variable.");
      return {};
    }
    if (targetLanguages.length === 0) {
      return {};
    }

    // 짧은 텍스트나 특수문자만 있는 경우 번역 스킵
    if (this.shouldSkipTranslation(text)) {
      return {};
    }

    // Filter out 'ko' if present in targets, as we don't translate KO to KO
    const actualTargets = targetLanguages.filter(l => l !== 'ko');
    if (actualTargets.length === 0) {
      return {};
    }

    // 캐시 확인
    const cacheKey = this.getCacheKey(text.trim(), actualTargets);
    const cached = this.translationCache.get(cacheKey);
    if (cached) {
      return cached.translations;
    }

    const startTime = Date.now();
    const requestId = `${startTime}-${Math.random().toString(36).slice(2, 8)}`;

    // Network 탭과 대조용: 요청 시작 시점 로그 (generativelanguage.googleapis.com 요청 시간과 비교)
    console.log(
      `[LiveSteno Translation] API 요청 시작 | model=${GEMINI_MODEL} | requestId=${requestId} | time=${new Date().toISOString()}`
    );

    try {
      const properties: { [key: string]: Schema } = {};
      actualTargets.forEach((lang) => {
        properties[lang] = { type: Type.STRING };
      });

      const stream = await this.ai.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: `Korean → ${actualTargets.join(", ")}. JSON only: {${actualTargets.map(l => `"${l}":"..."`).join(",")}} for: "${text.trim()}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: properties,
            required: actualTargets,
          },
          temperature: 0.1,
          maxOutputTokens: 500,
        },
      });

      let fullText = "";
      let firstChunkReceived = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Translation timeout")), FIRST_CHUNK_TIMEOUT_MS);
      });
      const consumeStream = async (): Promise<string> => {
        try {
          for await (const chunk of stream) {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              if (timeoutId) clearTimeout(timeoutId);
              console.log(
                `[LiveSteno Translation] 첫 청크 수신 | requestId=${requestId} | elapsed=${Date.now() - startTime}ms (이후 타임아웃 미적용)`
              );
            }
            fullText += (chunk.text ?? "");
          }
          return fullText;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      };

      const rawText = await Promise.race([consumeStream(), timeoutPromise]);
      const elapsed = Date.now() - startTime;

      console.log(
        `[LiveSteno Translation] API 스트림 완료 | requestId=${requestId} | elapsed=${elapsed}ms | model=${GEMINI_MODEL}`
      );
      console.log(
        `[LiveSteno Translation] 💡 Network 탭에서 "generativelanguage.googleapis.com" 요청의 Time(ms)과 elapsed 값이 비슷한지 확인하세요.`
      );

      if (!rawText || !rawText.trim()) {
        console.error(`[LiveSteno Translation] Empty response after ${elapsed}ms | requestId=${requestId}`);
        return {};
      }

      let translations: TranslationMap;
      try {
        translations = JSON.parse(rawText) as TranslationMap;
      } catch (parseError) {
        console.error(`[LiveSteno Translation] JSON parse error after ${elapsed}ms:`, parseError);
        console.error("[LiveSteno Translation] Raw response:", rawText);
        return {};
      }

      // 응답 검증: 모든 언어에 대한 번역이 있는지 확인
      const missingLanguages = actualTargets.filter(lang => !translations[lang] || translations[lang].trim() === '');
      if (missingLanguages.length > 0) {
        console.warn(`Translation incomplete: Missing languages ${missingLanguages.join(", ")} after ${elapsed}ms`);
        // 일부 언어만 번역된 경우라도 반환
      }

      // 성공한 번역만 캐시에 저장
      if (Object.keys(translations).length > 0) {
        if (this.translationCache.size >= CACHE_SIZE) {
          const firstKey = this.translationCache.keys().next().value;
          this.translationCache.delete(firstKey);
        }
        this.translationCache.set(cacheKey, {
          translations,
          timestamp: Date.now()
        });
        console.log(
          `[LiveSteno Translation] 성공 | requestId=${requestId} | ${elapsed}ms | languages=${Object.keys(translations).join(", ")}`
        );
      }

      return translations;
    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      const msg = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;

      console.error(`[LiveSteno Translation] 실패 | requestId=${requestId} | elapsed=${elapsed}ms`, error);

      if (statusCode === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        console.error("[LiveSteno Translation] ❌ 원인: 할당량 제한 (429). Google AI Studio/Cloud 할당량 또는 RPM/TPM 한도 초과.");
        console.error("[LiveSteno Translation] 💡 조치: 빌링 활성화 또는 요청 간격 늘리기.");
      } else if (
        msg.includes("timeout") || msg.includes("Timeout") ||
        msg.includes("ETIMEDOUT") || msg.includes("ECONNABORTED") || msg.includes("network") || msg.includes("Network")
      ) {
        console.error("[LiveSteno Translation] ❌ 원인: 네트워크/타임아웃. 첫 18초 안에 청크가 오지 않았거나 연결이 끊김.");
        console.error("[LiveSteno Translation] 💡 조치: Network 탭에서 generativelanguage.googleapis.com 요청이 pending인지, 실패(빨간색)인지 확인.");
      } else if (statusCode === 401 || statusCode === 403 || msg.includes("API") || msg.includes("key") || msg.includes("401") || msg.includes("403")) {
        console.error("[LiveSteno Translation] ❌ 원인: API 인증 오류. Vercel 환경변수 VITE_API_KEY 확인.");
      } else if (error instanceof Error) {
        console.error("[LiveSteno Translation] ❌ 원인: 기타 오류. message:", msg);
      } else {
        console.error("[LiveSteno Translation] ❌ Unknown error type:", error);
      }

      return {};
    }
  }
}

export const geminiService = new GeminiService();