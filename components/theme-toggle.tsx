import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemePreference, type ThemeMode } from '@/lib/theme-preference';

const OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'system', label: 'Oto', icon: '⚙️' },
  { mode: 'light', label: 'Açık', icon: '☀️' },
  { mode: 'dark', label: 'Koyu', icon: '🌙' },
];

export function ThemeToggle() {
  const { mode, colorScheme, setMode } = useThemePreference();
  const isDark = colorScheme === 'dark';

  const handlePress = (next: ThemeMode) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMode(next);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const selected = mode === option.mode;
        return (
          <Pressable
            key={option.mode}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Tema: ${option.label}`}
            onPress={() => handlePress(option.mode)}
            style={[
              styles.segment,
              selected && { backgroundColor: '#FFC107' },
            ]}
          >
            <Text style={styles.segmentIcon}>{option.icon}</Text>
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: selected ? '#000000' : isDark ? '#c7c7cc' : '#3a3a3c',
                  fontWeight: selected ? '800' : '600',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 3,
  },

  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },

  segmentIcon: {
    fontSize: 12,
    marginRight: 4,
  },

  segmentLabel: {
    fontSize: 12,
  },
});
