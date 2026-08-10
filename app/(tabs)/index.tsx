import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  Vibration,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { AdBanner } from '@/components/ad-banner';
import { ThemeToggle } from '@/components/theme-toggle';
import { WheelPicker } from '@/components/wheel-picker';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { alarmAudioPlayer } from '@/lib/audio-synth';
import { ensureNotificationSetup, presentTimerFinishedAlert } from '@/lib/notifications';
import { SOUND_THEMES, SoundThemeId } from '@/lib/sound-themes';

const DEFAULT_HOURS = 0;
const DEFAULT_MINUTES = 50;
const DEFAULT_SECONDS = 0;
const RESET_HOURS = 1;
const RESET_MINUTES = 0;
const RESET_SECONDS = 0;

const NECK_Y = 130;
const TOP_Y = 36;
const BOTTOM_Y = 224;
const CENTER_X = 90;
const HALF_WIDTH = 48;

// Ekranda header olmadığı için tema çubuğunu durum çubuğunun altına itiyoruz.
const TOP_INSET = Platform.OS === 'ios' ? 52 : (RNStatusBar.currentHeight ?? 24) + 8;

const HOURS_RANGE = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_RANGE = Array.from({ length: 60 }, (_, i) => i);
const SECONDS_RANGE = Array.from({ length: 60 }, (_, i) => i);

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [pickerHours, setPickerHours] = useState(DEFAULT_HOURS);
  const [pickerMinutes, setPickerMinutes] = useState(DEFAULT_MINUTES);
  const [pickerSeconds, setPickerSeconds] = useState(DEFAULT_SECONDS);

  const [duration, setDuration] = useState(DEFAULT_HOURS * 3600 + DEFAULT_MINUTES * 60 + DEFAULT_SECONDS);
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [timerSoundTheme, setTimerSoundTheme] = useState<SoundThemeId | 'silent'>('rain');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  const grain1 = useRef(new Animated.Value(0)).current;
  const grain2 = useRef(new Animated.Value(0.4)).current;
  const grain3 = useRef(new Animated.Value(0.75)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // İzin isteme / bildirim kanalı kurulumu ilk çizimi bloklamasın diye bir sonraki
    // frame'e erteleniyor (alarm.tsx ile aynı desen) — açılış daha hızlı hissettirir.
    const raf = requestAnimationFrame(() => {
      ensureNotificationSetup();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (isRunning) {
      if (timerSoundTheme !== 'silent') {
        alarmAudioPlayer.startLoop(timerSoundTheme as SoundThemeId);
      }
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            setFinished(true);
            alarmAudioPlayer.stop();
            triggerFlip();
            Vibration.vibrate([0, 400, 200, 400]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            presentTimerFinishedAlert(
              'Süre Doldu! ⏰',
              'Sayaç zamanlaması tamamlandı.',
              timerSoundTheme === 'silent' ? 'classic' : timerSoundTheme
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      alarmAudioPlayer.stop();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      alarmAudioPlayer.stop();
    };
  }, [isRunning, timerSoundTheme]);

  useEffect(() => {
    const anims = [grain1, grain2, grain3];
    if (!isRunning) return;
    const loops = anims.map((anim) =>
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [isRunning]);

  const triggerFlip = () => {
    flipAnim.setValue(0);
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: 750,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
    }).start();
  };

  const handleStartPause = () => {
    if (!hasStarted) {
      const totalSec = pickerHours * 3600 + pickerMinutes * 60 + pickerSeconds;
      if (totalSec <= 0) return;
      setDuration(totalSec);
      setRemaining(totalSec);
      setFinished(false);
      setHasStarted(true);
      setIsRunning(true);
      triggerFlip();
    } else {
      setIsRunning(!isRunning);
    }
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    alarmAudioPlayer.stop();
    setIsRunning(false);
    setHasStarted(false);
    setFinished(false);
    setPickerHours(RESET_HOURS);
    setPickerMinutes(RESET_MINUTES);
    setPickerSeconds(RESET_SECONDS);
    const newDur = RESET_HOURS * 3600 + RESET_MINUTES * 60 + RESET_SECONDS;
    setDuration(newDur);
    setRemaining(newDur);
    triggerFlip();
  };

  const handlePreviewTimerSound = (themeId: SoundThemeId) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 150, 100, 200]);
    }
    // Her platformda aynı önizlemeyi duy: gerçek tema melodisi (sistem "default" sesi değil).
    alarmAudioPlayer.preview(themeId);
  };

  const hoursLabel = Math.floor(remaining / 3600)
    .toString()
    .padStart(2, '0');
  const minutesLabel = Math.floor((remaining % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const secondsLabel = (remaining % 60).toString().padStart(2, '0');

  const elapsedFraction = duration > 0 ? 1 - remaining / duration : 0;
  const isPouring = isRunning && elapsedFraction < 1;

  // Üst bölmedeki kum (aşağı doğru süzülür)
  const topSandY = TOP_Y + elapsedFraction * (NECK_Y - TOP_Y);
  const topWidthFrac = Math.max(0, 1 - elapsedFraction);
  const topLeft = CENTER_X - HALF_WIDTH * topWidthFrac;
  const topRight = CENTER_X + HALF_WIDTH * topWidthFrac;

  // Alt bölmedeki birikmiş kum (aşağı doğru piramit tepeciği gibi birikir)
  const bottomSandY = BOTTOM_Y - elapsedFraction * (BOTTOM_Y - NECK_Y);
  const bottomWidthFrac = Math.min(1, (BOTTOM_Y - bottomSandY) / (BOTTOM_Y - NECK_Y));
  const bottomLeft = CENTER_X - HALF_WIDTH * bottomWidthFrac;
  const bottomRight = CENTER_X + HALF_WIDTH * bottomWidthFrac;

  const makeGrainY = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [NECK_Y - 2, Math.max(bottomSandY - 4, NECK_Y)] });
  const makeGrainOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.05, 0.9, 1], outputRange: [0, 1, 1, 0] });

  const grainY1 = makeGrainY(grain1);
  const grainY2 = makeGrainY(grain2);
  const grainY3 = makeGrainY(grain3);
  const grainOpacity1 = makeGrainOpacity(grain1);
  const grainOpacity2 = makeGrainOpacity(grain2);
  const grainOpacity3 = makeGrainOpacity(grain3);

  const flipRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Tema Seçici: Otomatik (cihaz ayarı) / Açık / Koyu — tercih kalıcı olarak saklanır */}
      <View style={[styles.themeBar, { paddingTop: TOP_INSET }]}>
        <ThemeToggle />
      </View>

      <ScrollView
        scrollEnabled={isLandscape}
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.scrollContentLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!hasStarted ? (
          <View style={styles.pickerSection}>
            {/* Süre Başlıkları: Saat | Dakika | Saniye */}
            <View style={styles.pickerHeaderRow}>
              <Text style={[styles.pickerHeaderLabel, { color: isDark ? '#a0a0a5' : '#666666' }]}>
                Saat
              </Text>
              <Text style={[styles.pickerHeaderLabel, { color: isDark ? '#a0a0a5' : '#666666' }]}>
                Dakika
              </Text>
              <Text style={[styles.pickerHeaderLabel, { color: isDark ? '#a0a0a5' : '#666666' }]}>
                Saniye
              </Text>
            </View>

            {/* Zaman Seçici Tekerlekler */}
            <View style={styles.pickerRow}>
              <WheelPicker values={HOURS_RANGE} selected={pickerHours} onChange={setPickerHours} isDark={isDark} />
              <Text style={[styles.pickerColon, { color: isDark ? '#ffffff' : '#000000' }]}>:</Text>
              <WheelPicker values={MINUTES_RANGE} selected={pickerMinutes} onChange={setPickerMinutes} isDark={isDark} />
              <Text style={[styles.pickerColon, { color: isDark ? '#ffffff' : '#000000' }]}>:</Text>
              <WheelPicker values={SECONDS_RANGE} selected={pickerSeconds} onChange={setPickerSeconds} isDark={isDark} />
            </View>

            {/* Ders Çalışma, Rahatlama & Arka Plan Sesi Ayarı */}
            <View style={styles.soundSection}>
              <Text style={[styles.soundSectionTitle, { color: isDark ? '#ffffff' : '#000000' }]}>
                Odaklanma, Ders Çalışma & Rahatlama Sesleri 🎮🎯
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.soundChipRow}>
                <Pressable
                  style={[
                    styles.soundChip,
                    {
                      backgroundColor: timerSoundTheme === 'silent' ? '#FFC107' : isDark ? '#2c2c2e' : '#e5e5ea',
                    },
                  ]}
                  onPress={() => setTimerSoundTheme('silent')}
                >
                  <Text
                    style={[
                      styles.soundChipText,
                      {
                        color: timerSoundTheme === 'silent' ? '#000000' : isDark ? '#ffffff' : '#000000',
                        fontWeight: timerSoundTheme === 'silent' ? '700' : '500',
                      },
                    ]}
                  >
                    Sessiz
                  </Text>
                </Pressable>

                {SOUND_THEMES.map((theme) => {
                  const selected = timerSoundTheme === theme.id;
                  return (
                    <Pressable
                      key={theme.id}
                      style={[
                        styles.soundChip,
                        {
                          backgroundColor: selected ? '#FFC107' : isDark ? '#2c2c2e' : '#e5e5ea',
                        },
                      ]}
                      onPress={() => setTimerSoundTheme(theme.id)}
                    >
                      <Text
                        style={[
                          styles.soundChipText,
                          {
                            color: selected ? '#000000' : isDark ? '#ffffff' : '#000000',
                            fontWeight: selected ? '700' : '500',
                          },
                        ]}
                      >
                        {theme.badge}
                      </Text>
                      <Pressable
                        style={styles.chipPlayBtn}
                        onPress={() => handlePreviewTimerSound(theme.id)}
                        hitSlop={8}
                      >
                        <Text style={[styles.chipPlayBtnText, { color: selected ? '#000000' : '#8e8e93' }]}>
                          ▶
                        </Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Silahlı Oyun & Ders Odaklanma Temalı 3D Dönme Animasyonlu Kum Saati */
          <View style={[styles.hourglassRow, isLandscape && styles.hourglassRowLandscape]}>
            <Animated.View style={{ transform: [{ rotate: flipRotate }] }}>
              <Svg width={180} height={260} viewBox="0 0 180 260">
                <Defs>
                  {/* 3D Pirinç Metal Kapak Gradiyenti */}
                  <LinearGradient id="brassMetal" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#7A580B" />
                    <Stop offset="15%" stopColor="#C59B27" />
                    <Stop offset="35%" stopColor="#FFF4B8" />
                    <Stop offset="65%" stopColor="#D4AF37" />
                    <Stop offset="85%" stopColor="#997312" />
                    <Stop offset="100%" stopColor="#573D05" />
                  </LinearGradient>

                  {/* Sütun Silindir Gölgelendirme Gradiyenti */}
                  <LinearGradient id="pillarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#4A3707" />
                    <Stop offset="40%" stopColor="#D4AF37" />
                    <Stop offset="70%" stopColor="#FFF2B2" />
                    <Stop offset="100%" stopColor="#4A3707" />
                  </LinearGradient>

                  {/* Parlak Canlı Altın Kum Gradiyenti */}
                  <LinearGradient id="sandGold" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#FFF176" />
                    <Stop offset="30%" stopColor="#FFD54F" />
                    <Stop offset="70%" stopColor="#FFC107" />
                    <Stop offset="100%" stopColor="#FF8F00" />
                  </LinearGradient>

                  {/* Cam Şeffaf Arka Plan */}
                  <LinearGradient id="glassBg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                    <Stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                  </LinearGradient>
                </Defs>

                {/* Arka Pirinç Sütunlar */}
                <Rect x={28} y={20} width={8} height={220} rx={4} fill="url(#pillarGrad)" />
                <Rect x={144} y={20} width={8} height={220} rx={4} fill="url(#pillarGrad)" />

                {/* 1. KATMAN: Şeffaf Cam Gövdeleri (Kumların Arkasında) */}
                <Path
                  d={`M ${CENTER_X - HALF_WIDTH} ${TOP_Y}
                      C ${CENTER_X - HALF_WIDTH} ${TOP_Y + 55}, ${CENTER_X - 14} ${NECK_Y - 18}, ${CENTER_X} ${NECK_Y}
                      C ${CENTER_X + 14} ${NECK_Y - 18}, ${CENTER_X + HALF_WIDTH} ${TOP_Y + 55}, ${CENTER_X + HALF_WIDTH} ${TOP_Y}
                      Z`}
                  fill="url(#glassBg)"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth={2}
                />
                <Path
                  d={`M ${CENTER_X - HALF_WIDTH} ${BOTTOM_Y}
                      C ${CENTER_X - HALF_WIDTH} ${BOTTOM_Y - 55}, ${CENTER_X - 14} ${NECK_Y + 18}, ${CENTER_X} ${NECK_Y}
                      C ${CENTER_X + 14} ${NECK_Y + 18}, ${CENTER_X + HALF_WIDTH} ${BOTTOM_Y - 55}, ${CENTER_X + HALF_WIDTH} ${BOTTOM_Y}
                      Z`}
                  fill="url(#glassBg)"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth={2}
                />

                {/* 2. KATMAN: Üst Bölmedeki Kum Kütlesi (Aşağı Doğru Süzülür) */}
                <Polygon points={`${topLeft},${topSandY} ${topRight},${topSandY} ${CENTER_X},${NECK_Y}`} fill="url(#sandGold)" />

                {/* 3. KATMAN: Alt Bölmedeki Birikmiş Kum Tepeciği */}
                <Path
                  d={`M ${CENTER_X - HALF_WIDTH} ${BOTTOM_Y}
                      L ${bottomLeft} ${bottomSandY}
                      Q ${CENTER_X} ${bottomSandY - 10} ${bottomRight} ${bottomSandY}
                      L ${CENTER_X + HALF_WIDTH} ${BOTTOM_Y}
                      Z`}
                  fill="url(#sandGold)"
                />

                {/* 4. KATMAN: %100 Net & Parlak Aşağı Doğru Düşen Kum Çizgisi ve Taneleri */}
                {isPouring && (
                  <>
                    <Rect
                      x={CENTER_X - 2}
                      y={NECK_Y - 4}
                      width={4}
                      height={Math.max(0, bottomSandY - NECK_Y + 4)}
                      fill="#FFF176"
                    />
                    <Rect
                      x={CENTER_X - 1}
                      y={NECK_Y - 4}
                      width={2}
                      height={Math.max(0, bottomSandY - NECK_Y + 4)}
                      fill="#FFFFFF"
                      opacity={0.9}
                    />

                    {/* Animasyonlu Düşen Işıltılı Kum Taneleri */}
                    <AnimatedCircle r={3} cx={90} cy={grainY1} fill="#FFF9C4" opacity={grainOpacity1} />
                    <AnimatedCircle r={2.5} cx={89} cy={grainY2} fill="#FFD54F" opacity={grainOpacity2} />
                    <AnimatedCircle r={3} cx={91} cy={grainY3} fill="#FFE082" opacity={grainOpacity3} />
                  </>
                )}

                {/* 5. KATMAN: Üst ve Alt Pirinç Taban Kapakları */}
                <Rect x={16} y={10} width={148} height={20} rx={10} fill="url(#brassMetal)" stroke="#573D05" strokeWidth={1} />
                <Rect x={24} y={26} width={132} height={8} rx={4} fill="url(#brassMetal)" />
                <Rect x={24} y={226} width={132} height={8} rx={4} fill="url(#brassMetal)" />
                <Rect x={16} y={230} width={148} height={20} rx={10} fill="url(#brassMetal)" stroke="#573D05" strokeWidth={1} />

                {/* Pirinç Vida Somunları */}
                <Circle cx={32} cy={20} r={3.5} fill="#FFF2B2" stroke="#573D05" strokeWidth={1} />
                <Circle cx={148} cy={20} r={3.5} fill="#FFF2B2" stroke="#573D05" strokeWidth={1} />
                <Circle cx={32} cy={240} r={3.5} fill="#FFF2B2" stroke="#573D05" strokeWidth={1} />
                <Circle cx={148} cy={240} r={3.5} fill="#FFF2B2" stroke="#573D05" strokeWidth={1} />

                {/* Silahlı Oyun / Odaklanma Hedef Simgesi (Crosshair 🎯) Boğaz Halkasında */}
                <Rect x={CENTER_X - 16} y={NECK_Y - 6} width={32} height={12} rx={6} fill="url(#brassMetal)" stroke="#573D05" strokeWidth={1} />
                <Circle cx={CENTER_X} cy={NECK_Y} r={7} fill="#111111" stroke="#FF3D00" strokeWidth={1.5} />
                <Circle cx={CENTER_X} cy={NECK_Y} r={3} fill="#FFC107" />
                <Line x1={CENTER_X - 10} y1={NECK_Y} x2={CENTER_X + 10} y2={NECK_Y} stroke="#FF3D00" strokeWidth={1} />
                <Line x1={CENTER_X} y1={NECK_Y - 10} x2={CENTER_X} y2={NECK_Y + 10} stroke="#FF3D00" strokeWidth={1} />

                {/* Ön Pirinç Sütunlar */}
                <Rect x={18} y={20} width={8} height={220} rx={4} fill="url(#pillarGrad)" />
                <Rect x={154} y={20} width={8} height={220} rx={4} fill="url(#pillarGrad)" />
              </Svg>
            </Animated.View>

            {/* Silahlı Oyun & Mutlu Gamer Odak Rozeti */}
            <View style={styles.gamingBadgeRow}>
              <Text style={styles.gamingBadgeText}>🎯 ODAKLANMA & SİLAHLI OYUN MODU 🎮 🏆 🛡️</Text>
            </View>

            {/* Dijital Sayaç Metni */}
            <View style={styles.timeDisplayContainer}>
              <Text
                style={[
                  styles.sideText,
                  isLandscape && styles.sideTextLandscape,
                  { color: finished ? '#f44336' : isDark ? '#ffffff' : '#000000' },
                ]}
              >
                {hoursLabel}:{minutesLabel}:{secondsLabel}
              </Text>
              <Text style={[styles.statusBadge, { color: isRunning ? '#FFC107' : finished ? '#f44336' : '#8e8e93' }]}>
                {finished ? 'Süre Doldu! 🏆' : isRunning ? 'Geri Sayım Devam Ediyor... 😊' : 'Duraklatıldı'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, (finished || duration === 0) && styles.buttonDisabled]}
            onPress={handleStartPause}
            disabled={finished || duration === 0}
          >
            <Text style={styles.buttonText}>{isRunning ? 'Duraklat' : 'Başlat'}</Text>
          </Pressable>

          <Pressable style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.buttonText}>Sıfırla</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AdBanner />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  themeBar: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    alignItems: 'center',
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },

  scrollContentLandscape: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },

  pickerSection: {
    alignItems: 'center',
    width: '100%',
  },

  pickerHeaderRow: {
    flexDirection: 'row',
    width: 250,
    justifyContent: 'space-around',
    marginBottom: 8,
  },

  pickerHeaderLabel: {
    fontSize: 14,
    fontWeight: '700',
    width: 70,
    textAlign: 'center',
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  pickerColon: {
    fontSize: 28,
    fontWeight: '600',
    marginHorizontal: 2,
  },

  soundSection: {
    width: '100%',
    marginTop: 10,
    alignItems: 'center',
  },

  soundSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },

  soundChipRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
  },

  soundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
  },

  soundChipText: {
    fontSize: 13,
  },

  chipPlayBtn: {
    marginLeft: 6,
  },

  chipPlayBtnText: {
    fontSize: 12,
  },

  hourglassRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },

  hourglassRowLandscape: {
    marginVertical: 0,
  },

  gamingBadgeRow: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
    marginTop: 14,
  },

  gamingBadgeText: {
    color: '#FFC107',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  timeDisplayContainer: {
    alignItems: 'center',
    marginTop: 10,
  },

  sideText: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },

  sideTextLandscape: {
    fontSize: 40,
  },

  statusBadge: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },

  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'center',
  },

  button: {
    backgroundColor: '#FFC107',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    marginHorizontal: 8,
    minWidth: 120,
    alignItems: 'center',
  },

  buttonDisabled: {
    backgroundColor: '#666666',
    opacity: 0.5,
  },

  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  resetButton: {
    backgroundColor: '#8e8e93',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    marginHorizontal: 8,
    minWidth: 120,
    alignItems: 'center',
  },
});
