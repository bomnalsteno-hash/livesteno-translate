import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LanguageCode, TranslationMap } from "../types";

// API 버전(vibeta)에서 gemini-1.5-flash는 404 NOT_FOUND. gemini-2.0-flash 사용(지원됨).
// 유료 전환: Google AI Studio에서 빌링 활성화 후 동일 API 키 사용. RPM/TPM/RPD 한도 상승.
// 내부적으로 generateContentStream 사용: 청크를 모아서 한꺼번에 JSON 파싱 후 UI에는 완성된 결과만 표시(타임아웃 완화).
const GEMINI_MODEL = "gemini-2.0-flash";
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

  /** 번역 사용 가능 여부 (API 키가 설정된 경우 true) */
  public isReady(): boolean {
    return this.ai !== null;
  }

  public async translateText(
    text: string,
    targetLanguages: LanguageCode[]
  ): Promise<TranslationMap> {
    console.log(
      "%c[Gemini] 번역 요청 시작: 텍스트=%s, 언어=%s",
      "background: #222; color: #0f0; font-weight: bold; padding: 4px 8px;",
      JSON.stringify(text),
      JSON.stringify(targetLanguages)
    );

    if (!this.ai) {
      console.error("Gemini AI service not initialized. Check VITE_API_KEY environment variable.");
      return {};
    }
    if (targetLanguages.length === 0) {
      console.warn("[Gemini] 설정 상태: 번역 ON인데 대상 언어 리스트가 비어 있어서 함수 종료됨. (targetLanguages.length === 0)");
      return {};
    }

    // 짧은 텍스트나 특수문자만 있는 경우 번역 스킵
    if (this.shouldSkipTranslation(text)) {
      console.warn("[Gemini] 짧은 텍스트/특수문자만 있어서 번역 스킵:", JSON.stringify(text));
      return {};
    }

    // Filter out 'ko' if present in targets, as we don't translate KO to KO
    const actualTargets = targetLanguages.filter(l => l !== 'ko');
    if (actualTargets.length === 0) {
      console.warn("[Gemini] 설정 상태: 대상 언어가 'ko'만 있거나 비어 있어서 함수 종료됨. (actualTargets.length === 0)");
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

    const properties: { [key: string]: Schema } = {};
    actualTargets.forEach((lang) => {
      properties[lang] = { type: Type.STRING };
    });
    const prompt = `Korean → ${actualTargets.join(", ")}. JSON only: {${actualTargets.map(l => `"${l}":"..."`).join(",")}} for: "${text.trim()}"`;
    const config = {
      responseMimeType: "application/json" as const,
      responseSchema: { type: Type.OBJECT, properties, required: actualTargets },
      temperature: 0.1,
      maxOutputTokens: 500,
    };

    const tryParseAndCache = (rawText: string, elapsed: number): TranslationMap | null => {
      console.log("[Gemini] Raw Response (파싱 전):", rawText);
      if (!rawText?.trim()) return null;
      try {
        const translations = JSON.parse(rawText) as TranslationMap;
        if (Object.keys(translations).length > 0) {
          if (this.translationCache!.size >= CACHE_SIZE) {
            const firstKey = this.translationCache!.keys().next().value;
            this.translationCache!.delete(firstKey);
          }
          this.translationCache!.set(cacheKey, { translations, timestamp: Date.now() });
          console.log(`[LiveSteno Translation] 성공 | requestId=${requestId} | ${elapsed}ms | languages=${Object.keys(translations).join(", ")}`);
          return translations;
        }
      } catch (e) {
        console.error(`[LiveSteno Translation] JSON parse error after ${elapsed}ms:`, e);
      }
      return null;
    };

    try {
      const stream = await this.ai.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: prompt,
        config,
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
              console.log(`[LiveSteno Translation] 첫 청크 수신 | requestId=${requestId} | elapsed=${Date.now() - startTime}ms`);
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
      console.log(`[LiveSteno Translation] API 스트림 완료 | requestId=${requestId} | elapsed=${elapsed}ms`);
      const fromStream = tryParseAndCache(rawText, elapsed);
      if (fromStream) return fromStream;
    } catch (streamErr) {
      console.warn("[Gemini] 스트리밍 실패, 폴백 시도:", streamErr);
    }

    try {
      console.log(`[LiveSteno Translation] 폴백: generateContent(비스트리밍) 시도 | requestId=${requestId}`);
      const response = await this.ai!.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config,
      });
      const elapsed = Date.now() - startTime;
      const res = response as { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      let rawText = res.text ?? "";
      if (!rawText && res.candidates?.[0]?.content?.parts?.[0]?.text) {
        rawText = res.candidates[0].content!.parts![0].text ?? "";
      }
      if (!rawText) {
        console.warn("[Gemini] 폴백 응답에 text 없음. 응답 구조:", res);
      }
      const fromFallback = tryParseAndCache(rawText, elapsed);
      if (fromFallback) return fromFallback;
    } catch (fallbackErr) {
      const elapsed = Date.now() - startTime;
      console.error(`[LiveSteno Translation] 폴백도 실패 | requestId=${requestId} | elapsed=${elapsed}ms`, fallbackErr);
    }

    return {};
  }
}

export const geminiService = new GeminiService();