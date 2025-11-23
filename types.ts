export enum TranslationStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  GENERATING_SPEECH = 'GENERATING_SPEECH',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface Segment {
  start: string; // e.g. "00:01"
  end: string;   // e.g. "00:05"
  original: string;
  translated: string;
}

export interface AnalysisResult {
  detectedLanguage: string;
  summary: string;
  segments: Segment[];
}

export interface LanguageOption {
  code: string;
  name: string;
  voiceName: string; // Mapping to Gemini TTS voice names
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', voiceName: 'Zephyr' },
  { code: 'es', name: 'Spanish', voiceName: 'Puck' },
  { code: 'fr', name: 'French', voiceName: 'Charon' },
  { code: 'de', name: 'German', voiceName: 'Fenrir' },
  { code: 'ja', name: 'Japanese', voiceName: 'Kore' },
  { code: 'zh', name: 'Chinese (Mandarin)', voiceName: 'Zephyr' },
  { code: 'ko', name: 'Korean', voiceName: 'Kore' },
  { code: 'it', name: 'Italian', voiceName: 'Puck' },
];
