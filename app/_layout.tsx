import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AlarmRingingModal, RingingAlarmData } from '@/components/alarm-ringing-modal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeAds } from '@/lib/ads';
import { registerAlarmActionHandler, subscribeToAlarmTrigger } from '@/lib/notifications';
import { StudyProvider } from '@/lib/study-store';
import { ThemePreferenceProvider } from '@/lib/theme-preference';

// Splash ekranının takılmasını önlemek için otomatik gizlemeyi devre dışı bırakmıyoruz,
// açılışta hideAsync ile anında gizlenmesini sağlıyoruz.
SplashScreen.hideAsync().catch(() => {});

// WheelPicker'daki FlatList, sabit yükseklikli ve getItemLayout ile önceden
// ölçülmüş olduğu için form ScrollView'i içinde güvenle iç içe kullanılabiliyor
// (windowing bozulmuyor). Bu yüzden RN'in zararsız iç içe liste uyarısı susturuluyor;
// asıl performans sorunu virtualization'ı geri getirerek çözüldü, bu sadece log gürültüsünü kesiyor.
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // Tema tercihi (Otomatik / Açık / Koyu) tüm ağacın en üstünde sağlanıyor ki
  // navigasyon teması, sekmeler ve ekranlar aynı değeri okusun.
  return (
    // SafeAreaProvider en dışta olmalı: (tabs)/_layout.tsx içindeki
    // useSafeAreaInsets() bu sağlayıcı olmadan gerçek alt boşluğu (Xiaomi gibi
    // cihazlardaki büyük gezinme çubuğu dahil) okuyamıyor ve tab bar sistem
    // gezinme tuşlarının altında kalıp onlarla çakışıyordu.
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        {/* Ders/görev verisi de en üstte sağlanıyor: Pomodoro, Görevler ve İstatistik
            sekmeleri aynı durumu paylaşsın (sekme değişince veri kaybolmasın). */}
        <StudyProvider>
          <RootLayoutNav />
        </StudyProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [ringingData, setRingingData] = useState<RingingAlarmData | null>(null);

  useEffect(() => {
    // Uygulama açılır açılmaz splash ekranını anında ve güvenle gizle
    SplashScreen.hideAsync().catch(() => {});

    // AdMob SDK'sı web'de veya Expo Go'da patlamasın diye korumalı çağırıyoruz
    try {
      initializeAds();
    } catch (err) {
      console.warn('AdMob initialization skipped:', err);
    }

    let unregisterHandler = () => {};
    let unsubscribeTrigger = () => {};

    try {
      unregisterHandler = registerAlarmActionHandler();
      unsubscribeTrigger = subscribeToAlarmTrigger((data) => {
        setRingingData(data);
      });
    } catch (err) {
      console.warn('Notification handler setup skipped:', err);
    }

    return () => {
      unregisterHandler();
      unsubscribeTrigger();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      {/* Alarm çaldığında tüm ekranı kaplayan iOS tarzı dev tam ekran alarm ekranı */}
      <AlarmRingingModal
        visible={!!ringingData}
        data={ringingData}
        onDismiss={() => setRingingData(null)}
      />

      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
