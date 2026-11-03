'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type Language = 'zh' | 'en';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LANGUAGE_STORAGE_KEY = 'resumematch-language';

function readSavedLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'zh';
  } catch {
    // Storage can be denied in private or embedded browsing contexts.
    return 'zh';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguageState] = useState<Language>('zh');
  const [restored, setRestored] = useState(false);
  const initialized = useRef(false);
  const selectionVersion = useRef(0);

  const setLanguage = useCallback((next: Language) => {
    selectionVersion.current += 1;
    initialized.current = true;
    setLanguageState(next);
    setRestored(true);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Changing language still works when preference persistence is unavailable.
    }
  }, []);

  useEffect(() => {
    const englishRoute = /^\/en(?:\/|$)/.test(pathname ?? '');
    if (initialized.current && !englishRoute) return;
    const version = selectionVersion.current;
    const timer = window.setTimeout(() => {
      // Do not overwrite a choice made while preference restoration was pending.
      if (version !== selectionVersion.current) return;
      setLanguageState(englishRoute ? 'en' : readSavedLanguage());
      initialized.current = true;
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!restored) return;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language, restored]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'zh' ? 'en' : 'zh'),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
