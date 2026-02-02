import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LanguageCode, TranslationMap } from "../types";

const GEMINI_MODEL = "gemini-3-flash-preview";
const MIN_TRANSLATION_LENGTH = 2; // 최소 번역 길이 (글자 수)
const CACHE_SIZE = 100; // 캐시 최대 크기

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

    try {
      // Create a dynamic schema based on requested languages
      const properties: { [key: string]: Schema } = {};
      actualTargets.forEach((lang) => {
        properties[lang] = { type: Type.STRING };
      });

      // 최적화된 프롬프트 (더 짧고 명확하게)
      const response = await this.ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Translate "${text.trim()}" to ${actualTargets.join(", ")}. Return JSON: {${actualTargets.map(l => `"${l}": "translation"`).join(", ")}}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: properties,
            required: actualTargets,
          },
        },
      });

      const jsonText = response.text;
      if (!jsonText) {
        return {};
      }

      const translations = JSON.parse(jsonText) as TranslationMap;
      
      // 캐시에 저장 (크기 제한)
      if (this.translationCache.size >= CACHE_SIZE) {
        const firstKey = this.translationCache.keys().next().value;
        this.translationCache.delete(firstKey);
      }
      this.translationCache.set(cacheKey, {
        translations,
        timestamp: Date.now()
      });

      return translations;
    } catch (error) {
      console.error("Translation error:", error);
      return {};
    }
  }
}

export const geminiService = new GeminiService();