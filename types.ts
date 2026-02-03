export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'vi';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
}

export interface TranslationMap {
  [key: string]: string; // langCode: translatedText
}

export interface StenoMessage {
  id: string;
  originalText: string; // This is always Korean (ko)
  translations: TranslationMap;
  timestamp: number;
  isFinal: boolean; // True if translation is complete
}

export interface LanguageStyle {
  fontFamily: string;
  color: string;
  fontSizeScale: number; // 1.0 = base size
  fontWeight: number; // 100-900
  letterSpacing: number; // px
}

export interface ViewerStyle {
  backgroundColor: string;
  baseFontSize: number; // px, controls the root size
  lineHeight: number; // unitless multiplier
  layoutMode: 'combined' | 'columns' | 'rows'; 
  languageStyles: Record<string, LanguageStyle>; // Keyed by LanguageCode
  autoScroll: boolean; // Toggle auto-scrolling
  paragraphSpacing: number; // rem units for margin-bottom
  liveInputMode: 'char' | 'word'; // 'char': shows typing, 'word': shows only completed words
  detectSpeakerChanges: boolean; // If true, lines starting with '-' change color
  speakerChangeColor: string; // Color for lines starting with '-'
  textAlign: 'left' | 'center' | 'right'; // Text alignment
}

export interface AppSettings {
  targetLanguages: LanguageCode[]; // 'ko' is implied as source
  translationEnabled: boolean;
  autoOnPunctuation: boolean; // New: Toggle for punctuation triggering finalize
  enterKeyBehavior: 'send' | 'newline'; // 'send': Enter sends, 'newline': Enter adds new line
  triggerKeys: string[]; // e.g., ['.', '?', '!', 'Enter']
  viewerStyle: ViewerStyle;
}

export interface RoomMetadata {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
}

export const DEFAULT_LANGUAGE_STYLE: LanguageStyle = {
  fontFamily: 'Noto Sans KR',
  color: '#ffffff',
  fontSizeScale: 1.0,
  fontWeight: 400,
  letterSpacing: 0,
};

export const DEFAULT_VIEWER_STYLE: ViewerStyle = {
  backgroundColor: '#000000',
  baseFontSize: 32,
  lineHeight: 1.5,
  layoutMode: 'combined',
  autoScroll: true,
  paragraphSpacing: 1.0,
  liveInputMode: 'char',
  detectSpeakerChanges: false,
  speakerChangeColor: '#FFBB00', // Default R255 G187 B0
  textAlign: 'left',
  languageStyles: {
    'ko': { ...DEFAULT_LANGUAGE_STYLE, fontFamily: 'Noto Sans KR', fontWeight: 500 },
    'en': { ...DEFAULT_LANGUAGE_STYLE, fontFamily: 'Roboto', color: '#FFBB00' }, // Default R255 G187 B0
    'ja': { ...DEFAULT_LANGUAGE_STYLE },
    'zh': { ...DEFAULT_LANGUAGE_STYLE },
    'vi': { ...DEFAULT_LANGUAGE_STYLE },
    'es': { ...DEFAULT_LANGUAGE_STYLE },
    'fr': { ...DEFAULT_LANGUAGE_STYLE },
    'de': { ...DEFAULT_LANGUAGE_STYLE },
  }
};

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: '영어' },
  { code: 'ja', label: '일본어' },
  { code: 'zh', label: '중국어' },
  { code: 'vi', label: '베트남어' },
  { code: 'es', label: '스페인어' },
  { code: 'fr', label: '프랑스어' },
  { code: 'de', label: '독일어' },
];

export const FONT_OPTIONS = [
  { label: '고딕 (Noto Sans/Roboto)', value: 'Noto Sans KR' },
  { label: '명조 (Noto Serif)', value: 'Noto Serif KR' },
  { label: '고정폭 (Courier)', value: 'Courier Prime' },
];