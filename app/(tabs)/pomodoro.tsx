import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  Vibration,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AdBanner } from '@/components/ad-banner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { alarmAudioPlayer } from '@/lib/audio-synth';
import { ensureNotificationSetup, presentTimerFinishedAlert } from '@/lib/notifications';
import { SOUND_THEMES, SoundThemeId } from '@/lib/sound-themes';
import { useStudy } from '@/lib/study-store';

const SETTINGS_KEY = 'pomodoro_settings';

const TOP_INSET = Platform.OS === 'ios' ? 52 : (RNStatusBar.currentHeight ?? 24) + 8;

// Halka ölçüleri
const RING_SIZE = 250;
const RING_STROKE = 16;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Phase = 'work' | 'short' | 'long';

type PomodoroSettings = {
  workMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  roundsBeforeLong: number;
  autoStartNext: boolean;
  soundTheme: SoundThemeId | 'silent';
};

const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  roundsBeforeLong: 4,
  autoStartNext: true,
  soundTheme: 'focus',
};

const PHASE_META: Record<Phase, { title: string; badge: string; color: string; alertTitle: string; alertBody: string }> = {
  work: {
    title: 'Odaklanma Turu',
    badge: '🍅 ÇALIŞMA',
    color: '#FFC107',
    alertTitle: 'Pomodoro Tamamlandı! 🍅',
    alertBody: 'Harika iş! Şimdi mola zamanı.',
  },
  short: {
    title: 'Kısa Mola',
    badge: '☕ KISA MOLA',
    color: '#4CAF50',
    alertTitle: 'Mola Bitti! ☕',
    alertBody: 'Yeni bir odaklanma turuna hazır mısın?',
  },
  long: {
    title: 'Uzun Mola',
    badge: '🌴 UZUN MOLA',
    color: '#03A9F4',
    alertTitle: 'Uzun Mola Bitti! 🌴',
    alertBody: 'Dinlendin, şimdi tekrar odaklanma vakti.',
  },
};

function phaseMinutes(phase: Phase, settings: PomodoroSettings) {
  if (phase === 'work') return settings.workMinutes;
  if (phase === 'short') return settings.shortMinutes;
  return settings.longMinutes;
}

export default function PomodoroScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Görev/istatistik verisi tüm sekmelerde ortak store'dan geliyor.
  const { tasks, activeTask, activeTaskId, setActiveTask, recordPomodoro, todayPomodoros, dailyGoal, getSubject } =
    useStudy();

  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const [phase, setPhase] = useState<Phase>('work');
  const [remaining, setRemaining] = useState(DEFAULT_SETTINGS.workMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [roundInCycle, setRoundInCycle] = useState(0); // Uzun molaya kaç tur kaldığını izler
  const [showSettings, setShowSettings] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number | null>(null);
  // Interval içindeki stale closure'dan kaçınmak için faz geçişini ref üzerinden çağırıyoruz.
  const completeRef = useRef<() => void>(() => {});

  const totalSeconds = phaseMinutes(phase, settings) * 60;
  const meta = PHASE_META[phase];

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      ensureNotificationSetup();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pomodoro ayarlarını yükle (görev/oturum verisi StudyProvider'da tutuluyor).
  useEffect(() => {
    (async () => {
      try {
        const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) } as PomodoroSettings;
          setSettings(parsed);
          setRemaining(parsed.workMinutes * 60);
        }
      } catch {
        // Bozuk kayıt varsa sessizce varsayılanlarla devam et.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  }, [settings, loaded]);

  const stopTicker = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    deadlineRef.current = null;
  }, []);

  // Faza son verip sıradakine geçer.
  // completed=true  → süre doğal olarak doldu: uyarı sesi/bildirimi çalar ve
  //                    çalışma turu ise pomodoro olarak kaydedilir.
  // completed=false → kullanıcı "Atla" dedi: sessizce geçilir, sayaçlara işlenmez
  //                    (yarım kalan tur tam pomodoro sayılmamalı).
  const advancePhase = useCallback(
    (completed: boolean) => {
      stopTicker();
      setIsRunning(false);
      alarmAudioPlayer.stop();

      if (completed) {
        if (Platform.OS !== 'web') {
          Vibration.vibrate([0, 400, 200, 400]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        presentTimerFinishedAlert(
          meta.alertTitle,
          meta.alertBody,
          settings.soundTheme === 'silent' ? 'classic' : settings.soundTheme
        );
      }

      let nextPhase: Phase;
      if (phase === 'work') {
        const nextRound = roundInCycle + 1;
        // Tamamlanan çalışma turu: oturum kaydı + aktif görevin pomodoro sayacı.
        if (completed) recordPomodoro(settings.workMinutes);
        if (nextRound >= settings.roundsBeforeLong) {
          nextPhase = 'long';
          setRoundInCycle(0);
        } else {
          nextPhase = 'short';
          setRoundInCycle(nextRound);
        }
      } else {
        nextPhase = 'work';
      }

      setPhase(nextPhase);
      setRemaining(phaseMinutes(nextPhase, settings) * 60);
      if (settings.autoStartNext) {
        setIsRunning(true);
      }
    },
    [meta, phase, recordPomodoro, roundInCycle, settings, stopTicker]
  );

  useEffect(() => {
    completeRef.current = () => advancePhase(true);
  }, [advancePhase]);

  // Geri sayım: interval sayacı yerine hedef zaman damgası kullanılıyor; böylece
  // uygulama arka plana alınıp geri gelse de kalan süre kaymıyor.
  useEffect(() => {
    if (!isRunning) {
      stopTicker();
      alarmAudioPlayer.stop();
      return;
    }

    if (phase === 'work' && settings.soundTheme !== 'silent') {
      alarmAudioPlayer.startLoop(settings.soundTheme);
    }

    deadlineRef.current = Date.now() + remaining * 1000;
    intervalRef.current = setInterval(() => {
      if (deadlineRef.current == null) return;
      const left = Math.round((deadlineRef.current - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        completeRef.current();
      } else {
        setRemaining(left);
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      alarmAudioPlayer.stop();
    };
    // `remaining` bilerek bağımlılık dışında: her saniyede interval'i yeniden kurmamak için
    // sadece çalışma durumu / faz / ses teması değiştiğinde yeniden hedef belirliyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, phase, settings.soundTheme, stopTicker]);

  const handleStartPause = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    stopTicker();
    alarmAudioPlayer.stop();
    setIsRunning(false);
    setPhase('work');
    setRoundInCycle(0);
    setRemaining(settings.workMinutes * 60);
  };

  const handleSkip = () => {
    // Kalan süreyi atlayıp sıradaki faza geç; yarım kalan tur pomodoro olarak sayılmaz.
    advancePhase(false);
  };

  const updateMinutes = (key: 'workMinutes' | 'shortMinutes' | 'longMinutes', delta: number) => {
    setSettings((prev) => {
      const next = Math.min(90, Math.max(1, prev[key] + delta));
      const updated = { ...prev, [key]: next };
      // Sayaç duruyorsa ve düzenlenen faz aktifse ekrandaki süreyi de güncelle.
      if (!isRunning) {
        const activeKey =
          phase === 'work' ? 'workMinutes' : phase === 'short' ? 'shortMinutes' : 'longMinutes';
        if (activeKey === key) setRemaining(next * 60);
      }
      return updated;
    });
  };

  const updateRounds = (delta: number) => {
    setSettings((prev) => ({
      ...prev,
      roundsBeforeLong: Math.min(8, Math.max(2, prev.roundsBeforeLong + delta)),
    }));
  };

  const handlePreviewSound = (themeId: SoundThemeId) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    alarmAudioPlayer.preview(themeId);
  };

  const minutesLabel = Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0');
  const secondsLabel = (remaining % 60).toString().padStart(2, '0');

  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));

  const textColor = isDark ? '#ffffff' : '#000000';
  const subTextColor = isDark ? '#a0a0a5' : '#666666';
  const cardBg = isDark ? '#1c1c1e' : '#f5f5f7';
  const chipBg = isDark ? '#2c2c2e' : '#e5e5ea';
  const trackColor = isDark ? '#2c2c2e' : '#e5e5ea';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: TOP_INSET }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: textColor }]}>Pomodoro 🍅</Text>

        {/* Faz Rozeti */}
        <View style={[styles.phaseBadge, { backgroundColor: `${meta.color}22`, borderColor: meta.color }]}>
          <Text style={[styles.phaseBadgeText, { color: meta.color }]}>{meta.badge}</Text>
        </View>

        {/* Dairesel İlerleme Halkası */}
        <View style={styles.ringWrapper}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Defs>
              <LinearGradient id="pomoRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={meta.color} />
                <Stop offset="100%" stopColor={phase === 'work' ? '#FF8F00' : meta.color} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={trackColor}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="url(#pomoRing)"
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              // Halka tepeden (12 yönünden) başlasın.
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>

          <View style={styles.ringCenter}>
            <Text style={[styles.timeText, { color: textColor }]}>
              {minutesLabel}:{secondsLabel}
            </Text>
            <Text style={[styles.phaseTitle, { color: subTextColor }]}>{meta.title}</Text>
            <Text style={[styles.roundText, { color: subTextColor }]}>
              Tur {Math.min(roundInCycle + (phase === 'work' ? 1 : 0), settings.roundsBeforeLong)} /{' '}
              {settings.roundsBeforeLong}
            </Text>
          </View>
        </View>

        {/* Tur Noktaları */}
        <View style={styles.dotsRow}>
          {Array.from({ length: settings.roundsBeforeLong }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i < roundInCycle ? '#FFC107' : chipBg },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.todayText, { color: subTextColor }]}>
          Bugün:{' '}
          <Text style={{ color: '#FFC107', fontWeight: '800' }}>
            {todayPomodoros}/{dailyGoal}
          </Text>{' '}
          pomodoro
        </Text>

        {/* Üzerinde Çalışılan Görev */}
        <Pressable
          style={[styles.taskCard, { backgroundColor: cardBg }]}
          onPress={() => setShowTaskPicker((v) => !v)}
        >
          {activeTask ? (
            <>
              <View style={styles.taskCardHeader}>
                <Text style={[styles.taskCardLabel, { color: subTextColor }]}>ŞU AN ÇALIŞILAN GÖREV</Text>
                <Text style={[styles.taskCardChange, { color: '#FFC107' }]}>Değiştir</Text>
              </View>
              <Text style={[styles.taskCardTitle, { color: textColor }]} numberOfLines={2}>
                {activeTask.title}
              </Text>
              <Text style={[styles.taskCardMeta, { color: getSubject(activeTask.subjectId)?.color ?? subTextColor }]}>
                {getSubject(activeTask.subjectId)?.emoji} {getSubject(activeTask.subjectId)?.name} ·{' '}
                {activeTask.completedPomodoros}/{activeTask.targetPomodoros} 🍅
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.taskCardLabel, { color: subTextColor }]}>GÖREV SEÇİLMEDİ</Text>
              <Text style={[styles.taskCardTitle, { color: textColor }]}>
                Bir görev seç, çalıştığın süre otomatik işlensin 📚
              </Text>
            </>
          )}
        </Pressable>

        {showTaskPicker && (
          <View style={[styles.pickerCard, { backgroundColor: cardBg }]}>
            {openTasks.length === 0 ? (
              <Pressable onPress={() => router.push('/tasks')}>
                <Text style={[styles.pickerEmpty, { color: subTextColor }]}>
                  Açık görevin yok. Görevler sekmesinden ekle →
                </Text>
              </Pressable>
            ) : (
              <>
                {openTasks.slice(0, 8).map((task) => {
                  const subject = getSubject(task.subjectId);
                  const selected = activeTaskId === task.id;
                  return (
                    <Pressable
                      key={task.id}
                      style={[
                        styles.pickerRow,
                        { borderLeftColor: subject?.color ?? '#8e8e93' },
                        selected && styles.pickerRowSelected,
                      ]}
                      onPress={() => {
                        setActiveTask(task.id);
                        setShowTaskPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerRowTitle, { color: textColor }]} numberOfLines={1}>
                        {selected ? '● ' : ''}
                        {task.title}
                      </Text>
                      <Text style={[styles.pickerRowMeta, { color: subTextColor }]}>
                        {subject?.emoji} {task.completedPomodoros}/{task.targetPomodoros} 🍅
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => router.push('/tasks')}>
                  <Text style={styles.pickerLink}>Tüm görevleri yönet →</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Kontrol Butonları */}
        <View style={styles.buttonRow}>
          <Pressable style={[styles.primaryButton, { backgroundColor: meta.color }]} onPress={handleStartPause}>
            <Text style={styles.primaryButtonText}>{isRunning ? 'Duraklat' : 'Başlat'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleSkip}>
            <Text style={styles.secondaryButtonText}>Atla ⏭</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>Sıfırla</Text>
          </Pressable>
        </View>

        {/* Ayarlar */}
        <Pressable
          style={[styles.settingsToggle, { backgroundColor: chipBg }]}
          onPress={() => setShowSettings((v) => !v)}
        >
          <Text style={[styles.settingsToggleText, { color: textColor }]}>
            {showSettings ? 'Ayarları Gizle ▲' : 'Süre & Ses Ayarları ⚙️'}
          </Text>
        </Pressable>

        {showSettings && (
          <View style={[styles.settingsCard, { backgroundColor: cardBg }]}>
            <Stepper
              label="Çalışma Süresi"
              value={`${settings.workMinutes} dk`}
              onDecrease={() => updateMinutes('workMinutes', -1)}
              onIncrease={() => updateMinutes('workMinutes', 1)}
              textColor={textColor}
              subTextColor={subTextColor}
              chipBg={chipBg}
            />
            <Stepper
              label="Kısa Mola"
              value={`${settings.shortMinutes} dk`}
              onDecrease={() => updateMinutes('shortMinutes', -1)}
              onIncrease={() => updateMinutes('shortMinutes', 1)}
              textColor={textColor}
              subTextColor={subTextColor}
              chipBg={chipBg}
            />
            <Stepper
              label="Uzun Mola"
              value={`${settings.longMinutes} dk`}
              onDecrease={() => updateMinutes('longMinutes', -1)}
              onIncrease={() => updateMinutes('longMinutes', 1)}
              textColor={textColor}
              subTextColor={subTextColor}
              chipBg={chipBg}
            />
            <Stepper
              label="Uzun Moladan Önceki Tur"
              value={`${settings.roundsBeforeLong} tur`}
              onDecrease={() => updateRounds(-1)}
              onIncrease={() => updateRounds(1)}
              textColor={textColor}
              subTextColor={subTextColor}
              chipBg={chipBg}
            />

            <View style={styles.switchRow}>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>
                Sıradaki turu otomatik başlat
              </Text>
              <Switch
                value={settings.autoStartNext}
                onValueChange={(v) => setSettings((prev) => ({ ...prev, autoStartNext: v }))}
              />
            </View>

            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>
                Çalışma Turu Arka Plan Sesi
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.soundChipRow}>
                <Pressable
                  style={[
                    styles.soundChip,
                    { backgroundColor: settings.soundTheme === 'silent' ? '#FFC107' : chipBg },
                  ]}
                  onPress={() => setSettings((prev) => ({ ...prev, soundTheme: 'silent' }))}
                >
                  <Text
                    style={[
                      styles.soundChipText,
                      {
                        color: settings.soundTheme === 'silent' ? '#000000' : textColor,
                        fontWeight: settings.soundTheme === 'silent' ? '700' : '500',
                      },
                    ]}
                  >
                    Sessiz
                  </Text>
                </Pressable>

                {SOUND_THEMES.filter((t) => t.category === 'ambient').map((theme) => {
                  const selected = settings.soundTheme === theme.id;
                  return (
                    <Pressable
                      key={theme.id}
                      style={[styles.soundChip, { backgroundColor: selected ? '#FFC107' : chipBg }]}
                      onPress={() => setSettings((prev) => ({ ...prev, soundTheme: theme.id }))}
                    >
                      <Text
                        style={[
                          styles.soundChipText,
                          {
                            color: selected ? '#000000' : textColor,
                            fontWeight: selected ? '700' : '500',
                          },
                        ]}
                      >
                        {theme.badge}
                      </Text>
                      <Pressable
                        style={styles.chipPlayBtn}
                        onPress={() => handlePreviewSound(theme.id)}
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
        )}
      </ScrollView>

      <AdBanner />
    </View>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  textColor,
  subTextColor,
  chipBg,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  textColor: string;
  subTextColor: string;
  chipBg: string;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={[styles.fieldLabel, { color: subTextColor, flex: 1 }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={[styles.stepperButton, { backgroundColor: chipBg }]} onPress={onDecrease} hitSlop={6}>
          <Text style={[styles.stepperButtonText, { color: textColor }]}>−</Text>
        </Pressable>
        <Text style={[styles.stepperValue, { color: textColor }]}>{value}</Text>
        <Pressable style={[styles.stepperButton, { backgroundColor: chipBg }]} onPress={onIncrease} hitSlop={6}>
          <Text style={[styles.stepperButtonText, { color: textColor }]}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  screenTitle: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 12,
  },

  phaseBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },

  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timeText: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
  },

  phaseTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },

  roundText: {
    fontSize: 13,
    marginTop: 4,
  },

  dotsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },

  todayText: {
    fontSize: 14,
    marginTop: 12,
  },

  taskCard: {
    width: '100%',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },

  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  taskCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  taskCardChange: {
    fontSize: 12,
    fontWeight: '800',
  },

  taskCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },

  taskCardMeta: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },

  pickerCard: {
    width: '100%',
    borderRadius: 18,
    padding: 12,
    marginTop: 8,
  },

  pickerRow: {
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },

  pickerRowSelected: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
  },

  pickerRowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },

  pickerRowMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  pickerEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },

  pickerLink: {
    color: '#FFC107',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },

  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'center',
  },

  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginHorizontal: 5,
    minWidth: 110,
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryButton: {
    backgroundColor: '#8e8e93',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginHorizontal: 5,
    alignItems: 'center',
  },

  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  settingsToggle: {
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 20,
  },

  settingsToggleText: {
    fontSize: 14,
    fontWeight: '700',
  },

  settingsCard: {
    width: '100%',
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
  },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepperButtonText: {
    fontSize: 20,
    fontWeight: '700',
  },

  stepperValue: {
    width: 74,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  fieldSection: {
    width: '100%',
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  soundChipRow: {
    flexDirection: 'row',
    paddingVertical: 10,
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
});
