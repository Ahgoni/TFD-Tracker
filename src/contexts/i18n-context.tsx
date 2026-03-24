"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import enBase from "@/messages/en.json";
import type { LocaleCode } from "@/lib/i18n/config";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, isLocale } from "@/lib/i18n/config";

type Messages = Record<string, string>;

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function setLocaleCookie(code: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

async function loadMergedMessages(locale: LocaleCode): Promise<Messages> {
  const en = { ...(enBase as Messages) };
  if (locale === "en") return en;
  try {
    const mod = await import(`@/messages/${locale}.json`);
    return { ...en, ...(mod.default as Messages) };
  } catch {
    return en;
  }
}

function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("en");
  const [messages, setMessages] = useState<Messages>(() => ({ ...(enBase as Messages) }));
  const [ready, setReady] = useState(true);

  const applyLocale = useCallback(async (code: LocaleCode) => {
    const merged = await loadMergedMessages(code);
    setMessages(merged);
    setLocaleState(code);
    if (typeof document !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
      setLocaleCookie(code);
      document.documentElement.lang = code.startsWith("zh") ? "zh-CN" : code.split("-")[0] ?? "en";
    }
  }, []);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const fromCookie = readCookie(LOCALE_COOKIE);
    const raw = stored || fromCookie || "en";
    const code = isLocale(raw) ? raw : "en";
    void applyLocale(code);
  }, [applyLocale]);

  const setLocale = useCallback(
    (code: LocaleCode) => {
      void applyLocale(code);
    },
    [applyLocale],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      const s = messages[key] ?? key;
      return interpolate(s, vars);
    },
    [messages],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

/** Safe fallback when provider might not wrap (should not happen). */
export function useI18nOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}

export { SUPPORTED_LOCALES } from "@/lib/i18n/config";
