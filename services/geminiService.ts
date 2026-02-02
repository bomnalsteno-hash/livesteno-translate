import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LanguageCode, TranslationMap } from "../types";

const GEMINI_MODEL = "gemini-3-flash-preview";

class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("VITE_API_KEY is missing from environment variables.");
    }
  }

  public async translateText(
    text: string,
    targetLanguages: LanguageCode[]
  ): Promise<TranslationMap> {
    if (!this.ai) return {};
    if (targetLanguages.length === 0) return {};

    // Filter out 'ko' if present in targets, as we don't translate KO to KO
    const actualTargets = targetLanguages.filter(l => l !== 'ko');
    if (actualTargets.length === 0) return {};

    try {
      // Create a dynamic schema based on requested languages
      const properties: { [key: string]: Schema } = {};
      actualTargets.forEach((lang) => {
        properties[lang] = { type: Type.STRING };
      });

      const response = await this.ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Translate the following Korean text into ${actualTargets.join(", ")}. 
Text: "${text}"
If the text is just punctuation or emoticons, return it as is.
Return a JSON object where keys are the language codes (${actualTargets.join(", ")}) and values are the translations.`,
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
      if (!jsonText) return {};

      return JSON.parse(jsonText) as TranslationMap;
    } catch (error) {
      console.error("Translation error:", error);
      return {};
    }
  }
}

export const geminiService = new GeminiService();