import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { translations, type TranslationKey, type Language } from "@/i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("cyberpulse_lang");
    if (stored === "ar" || stored === "en") return stored as Language;
    // Auto-detect from Telegram WebApp user language
    try {
      const tgLang = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
      if (tgLang && String(tgLang).startsWith("ar")) return "ar";
    } catch { /* noop */ }
    return "en";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("cyberpulse_lang", lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[language][key] || key,
    [language]
  );

  const dir = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
