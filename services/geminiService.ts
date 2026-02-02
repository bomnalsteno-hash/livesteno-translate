import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LanguageCode, TranslationMap } from "../types";

const GEMINI_MODEL = "gemini-3-flash-preview"; // 최신 모델 사용
const MIN_TRANSLATION_LENGTH = 2; // 최소 번역 길이 (글자 수)
const CACHE_SIZE = 100; // 캐시 최대 크기
const TRANSLATION_TIMEOUT = 10000; // 10초 타임아웃

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
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("VITE_API_KEY is missing from environment variables.");
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
    
    try {
      // Create a dynamic schema based on requested languages
      const properties: { [key: string]: Schema } = {};
      actualTargets.forEach((lang) => {
        properties[lang] = { type: Type.STRING };
      });

      // 타임아웃이 있는 번역 요청
      const translationPromise = this.ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are a professional translator. Translate the following Korean text into ${actualTargets.map(l => l.toUpperCase()).join(", ")}. 

Korean text: "${text.trim()}"

Requirements:
- Return ONLY a valid JSON object
- Keys must be language codes: ${actualTargets.map(l => `"${l}"`).join(", ")}
- Values must be the translations
- If the text is punctuation only, return it as-is for all languages`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: properties,
            required: actualTargets,
          },
          temperature: 0.3, // 더 일관된 결과를 위해 낮은 temperature
        },
      });

      // 타임아웃 처리
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Translation timeout")), TRANSLATION_TIMEOUT)
      );

      const response = await Promise.race([translationPromise, timeoutPromise]) as any;
      const elapsed = Date.now() - startTime;

      if (!response || !response.text) {
        console.error(`Translation failed: Empty response after ${elapsed}ms`);
        return {};
      }

      let translations: TranslationMap;
      try {
        translations = JSON.parse(response.text) as TranslationMap;
      } catch (parseError) {
        console.error(`Translation JSON parse error after ${elapsed}ms:`, parseError);
        console.error("Raw response:", response.text);
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
        console.log(`Translation success: ${elapsed}ms, languages: ${Object.keys(translations).join(", ")}`);
      }

      return translations;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`Translation error after ${elapsed}ms:`, error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        if (error.message.includes("timeout")) {
          console.error("Translation timed out. The API may be slow or unavailable.");
        }
      }
      return {};
    }
  }
}

export const geminiService = new GeminiService();