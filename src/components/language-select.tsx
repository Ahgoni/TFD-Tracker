"use client";

import { useI18n } from "@/contexts/i18n-context";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type LocaleCode } from "@/lib/i18n/config";

export function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={`language-select-wrap${className ? ` ${className}` : ""}`}>
      <span className="language-select-globe" aria-hidden>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10" />
        </svg>
      </span>
      <select
        className="language-select"
        value={locale}
        title={t("lang.label")}
        aria-label={t("lang.label")}
        onChange={(e) => setLocale(e.target.value as LocaleCode)}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code] ?? code}
          </option>
        ))}
      </select>
    </label>
  );
}
