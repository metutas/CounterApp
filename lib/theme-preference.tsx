import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'counterapp.theme-mode';

const BACKGROUNDS: Record<ResolvedScheme, string> = {
  light: '#ffffff',
  dark: '#000000',
};

type ThemePreferenceValue = {
  /** Kullanıcının seçtiği tercih: 'system' ise cihaz ayarını takip eder. */
  mode: ThemeMode;
  /** Ekranlarda kullanılacak nihai tema. */
  colorScheme: ResolvedScheme;
  setMode: (mode: ThemeMode) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue>({
  mode: 'system',
  colorScheme: 'light',
  setMode: () => {},
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  // Web'de statik render sırasında cihaz teması bilinmediği için ilk çizimde
  // 'light' varsayıp hydration sonrası gerçek değere geçiyoruz.
  const [hasHydrated, setHasHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setModeState(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHasHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const colorScheme: ResolvedScheme =
    mode === 'system' ? (hasHydrated ? (systemScheme ?? 'light') : 'light') : mode;

  useEffect(() => {
    // Navigasyon geçişlerinde kök arka planın beyaz parlamasını engeller.
    SystemUI.setBackgroundColorAsync(BACKGROUNDS[colorScheme]).catch(() => {});
  }, [colorScheme]);

  const value = useMemo(
    () => ({ mode, colorScheme, setMode }),
    [mode, colorScheme, setMode]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}

/** Uygulama genelinde kullanılan tema okuyucusu (tercih + sistem birleşimi). */
export function useColorScheme(): ResolvedScheme {
  return useContext(ThemePreferenceContext).colorScheme;
}
