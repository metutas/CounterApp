import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // edgeToEdgeEnabled: true olduğu için (app.json) uygulama sistem gezinme
  // çubuğunun arkasına kadar çiziliyor. Sabit bir paddingBottom, 3 tuşlu
  // gezinme çubuğunu (özellikle ortadaki yuvarlak Ana Ekran tuşunu) hesaba
  // katmıyordu ve o tuş tab bar'ın üzerine binip sekmelere dokunuşu engelliyordu.
  // Gerçek alt boşluğu insets.bottom'dan okuyup ekliyoruz.
  const insets = useSafeAreaInsets();
  const tabBarBasePadding = Platform.OS === 'ios' ? 28 : 10;
  const tabBarBaseHeight = Platform.OS === 'ios' ? 60 : 54;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFC107',
        tabBarInactiveTintColor: isDark ? '#8e8e93' : '#666666',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDark ? 'rgba(20, 20, 22, 0.92)' : 'rgba(255, 255, 255, 0.92)',
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          elevation: 8,
          height: tabBarBaseHeight + Math.max(insets.bottom, tabBarBasePadding),
          paddingBottom: Math.max(insets.bottom, tabBarBasePadding),
          paddingTop: 8,
        },
        // 5 sekme yan yana sığsın diye etiket/ikon biraz küçültüldü.
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Sayaç',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="hourglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pomodoro"
        options={{
          title: 'Pomodoro',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="timer" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Görevler',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'İstatistik',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="alarm"
        options={{
          title: 'Alarmlar',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="alarm" color={color} />,
        }}
      />
    </Tabs>
  );
}
