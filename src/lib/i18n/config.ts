export const LOCALE_STORAGE_KEY = "tfd-locale";
export const LOCALE_COOKIE = "tfd-locale";

export const SUPPORTED_LOCALES = ["en", "ko", "ja", "de", "fr", "zh-CN", "es"] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<string, string> = {
  en: "EN",
  ko: "KO",
  ja: "JA",
  de: "DE",
  fr: "FR",
  "zh-CN": "中文",
  es: "ES",
};

export function isLocale(code: string): code is LocaleCode {
  return (SUPPORTED_LOCALES as readonly string[]).includes(code);
}
