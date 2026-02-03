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
  enableWordDeleteShortcut?: boolean; // Ctrl+Backspace 단어 삭제 단축키 사용 여부 (선택적, 기본 true)
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
  paragraphSpacing: 0,
  // 실시간 입력은 기본적으로 '단어 단위' 모드로 표시하여 깜빡임과 깨지는 느낌을 줄인다.
  liveInputMode: 'word',
  detectSpeakerChanges: false,
  speakerChangeColor: '#FFBB00', // Default R255 G187 B0
  textAlign: 'left',
  languageStyles: {
    'ko': { ...DEFAULT_LANGUAGE_STYLE, fontFamily: 'Noto Sans KR', fontWeight: 500 },
    // 번역 언어 기본 색상: 화자 변경감지 OFF일 때는 모두 노란색(영어와 동일)
    // 화자 변경감지 ON일 때는 ViewerPage의 로직에서 번역이 한국어 색을 따라가도록 덮어씀
    'en': { ...DEFAULT_LANGUAGE_STYLE, fontFamily: 'Roboto', color: '#FFBB00' }, // Default R255 G187 B0
    'ja': { ...DEFAULT_LANGUAGE_STYLE, color: '#FFBB00' },
    'zh': { ...DEFAULT_LANGUAGE_STYLE, color: '#FFBB00' },
    'vi': { ...DEFAULT_LANGUAGE_STYLE, color: '#FFBB00' },
    'es': { ...DEFAULT_LANGUAGE_STYLE, color: '#FFBB00' },
    'fr': { ...DEFAULT_LANGUAGE_STYLE, color: '#FFBB00' },
    'de': { ...DEFAULT_LANGUAGE_STYLE, color: '#FFBB00' },
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