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
    if (!this.ai) {
      console.error("Gemini AI service not initialized. Check VITE_API_KEY environment variable.");
      return {};
    }
    if (targetLanguages.length === 0) {
      console.warn("No target languages selected for translation.");
      return {};
    }

    // Filter out 'ko' if present in targets, as we don't translate KO to KO
    const actualTargets = targetLanguages.filter(l => l !== 'ko');
    if (actualTargets.length === 0) {
      console.warn("No valid target languages (excluding Korean) for translation.");
      return {};
    }

    try {
      console.log(`Translating text: "${text}" to languages: ${actualTargets.join(", ")}`);
      
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
      if (!jsonText) {
        console.error("Translation response is empty.");
        return {};
      }

      const translations = JSON.parse(jsonText) as TranslationMap;
      console.log("Translation successful:", translations);
      return translations;
    } catch (error) {
      console.error("Translation error:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
      return {};
    }
  }
}

export const geminiService = new GeminiService();