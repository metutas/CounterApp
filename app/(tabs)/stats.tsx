import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AdBanner } from '@/components/ad-banner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStudy } from '@/lib/study-store';

const TOP_INSET = Platform.OS === 'ios' ? 52 : (RNStatusBar.currentHeight ?? 24) + 8;

const RING_SIZE = 160;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const CHART_HEIGHT = 130;

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} dk`;
  return `${h} sa ${m} dk`;
}

export default function StatsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    dailyGoal,
    setDailyGoal,
    todayPomodoros,
    todayMinutes,
    streakDays,
    last7Days,
    subjectTotals,
    totalMinutes,
    tasks,
  } = useStudy();

  const textColor = isDark ? '#ffffff' : '#000000';
  const subTextColor = isDark ? '#a0a0a5' : '#666666';
  const cardBg = isDark ? '#1c1c1e' : '#f5f5f7';
  const trackColor = isDark ? '#2c2c2e' : '#e5e5ea';

  const goalProgress = Math.min(1, todayPomodoros / Math.max(1, dailyGoal));
  const dashOffset = RING_CIRCUMFERENCE * (1 - goalProgress);

  const weekPomodoros = last7Days.reduce((sum, d) => sum + d.count, 0);
  const weekMinutes = last7Days.reduce((sum, d) => sum + d.minutes, 0);
  const maxDayCount = Math.max(1, ...last7Days.map((d) => d.count));

  const doneTasks = tasks.filter((t) => t.done).length;
  const openTasks = tasks.length - doneTasks;
  const maxSubjectMinutes = Math.max(1, ...subjectTotals.map((s) => s.minutes));

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: TOP_INSET }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: textColor }]}>İstatistik 📊</Text>

        {/* Günlük Hedef Halkası */}
        <View style={[styles.card, { backgroundColor: cardBg, alignItems: 'center' }]}>
          <View style={styles.ringWrapper}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
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
                stroke="#FFC107"
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[styles.ringValue, { color: textColor }]}>
                {todayPomodoros}
                <Text style={[styles.ringTotal, { color: subTextColor }]}>/{dailyGoal}</Text>
              </Text>
              <Text style={[styles.ringLabel, { color: subTextColor }]}>bugün 🍅</Text>
            </View>
          </View>

          <Text style={[styles.cardSubtitle, { color: subTextColor }]}>
            Bugün odaklanılan süre: <Text style={{ color: textColor, fontWeight: '700' }}>{formatMinutes(todayMinutes)}</Text>
          </Text>

          <View style={styles.goalStepperRow}>
            <Text style={[styles.goalStepperLabel, { color: subTextColor }]}>Günlük hedef</Text>
            <View style={styles.goalStepperControls}>
              <Pressable
                style={[styles.stepperButton, { backgroundColor: trackColor }]}
                onPress={() => setDailyGoal(dailyGoal - 1)}
                hitSlop={6}
              >
                <Text style={[styles.stepperButtonText, { color: textColor }]}>−</Text>
              </Pressable>
              <Text style={[styles.stepperValue, { color: textColor }]}>{dailyGoal} 🍅</Text>
              <Pressable
                style={[styles.stepperButton, { backgroundColor: trackColor }]}
                onPress={() => setDailyGoal(dailyGoal + 1)}
                hitSlop={6}
              >
                <Text style={[styles.stepperButtonText, { color: textColor }]}>＋</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Özet Kartları */}
        <View style={styles.statRow}>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statValue, { color: textColor }]}>{streakDays}</Text>
            <Text style={[styles.statLabel, { color: subTextColor }]}>günlük seri</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={[styles.statValue, { color: textColor }]}>{formatMinutes(weekMinutes)}</Text>
            <Text style={[styles.statLabel, { color: subTextColor }]}>bu hafta</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={[styles.statValue, { color: textColor }]}>{doneTasks}</Text>
            <Text style={[styles.statLabel, { color: subTextColor }]}>biten görev</Text>
          </View>
        </View>

        {/* Son 7 Gün Grafiği */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Son 7 Gün</Text>
          <Text style={[styles.cardSubtitle, { color: subTextColor }]}>
            Toplam {weekPomodoros} pomodoro
          </Text>

          <View style={styles.chartRow}>
            {last7Days.map((day, index) => {
              const isToday = index === last7Days.length - 1;
              const barHeight = Math.max(4, (day.count / maxDayCount) * CHART_HEIGHT);
              const reachedGoal = day.count >= dailyGoal;
              return (
                <View key={day.date} style={styles.chartColumn}>
                  <Text style={[styles.chartValue, { color: day.count ? textColor : 'transparent' }]}>
                    {day.count}
                  </Text>
                  <View style={[styles.chartBarTrack, { height: CHART_HEIGHT, backgroundColor: trackColor }]}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: barHeight,
                          backgroundColor: reachedGoal ? '#4CAF50' : day.count ? '#FFC107' : 'transparent',
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartLabel,
                      { color: isToday ? '#FFC107' : subTextColor, fontWeight: isToday ? '800' : '600' },
                    ]}
                  >
                    {day.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.legendText, { color: subTextColor }]}>
            Yeşil sütunlar günlük hedefi tutturduğun günler.
          </Text>
        </View>

        {/* Ders Bazlı Dağılım */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Derslere Göre Çalışma</Text>
          {subjectTotals.length === 0 || subjectTotals.every((s) => s.minutes === 0) ? (
            <Text style={[styles.cardSubtitle, { color: subTextColor }]}>
              Henüz veri yok. Pomodoro sekmesinde bir görev seçip çalışmaya başla.
            </Text>
          ) : (
            subjectTotals.map(({ subject, minutes, count }) => (
              <View key={subject.id} style={styles.subjectRow}>
                <View style={styles.subjectHeaderRow}>
                  <Text style={[styles.subjectName, { color: textColor }]}>
                    {subject.emoji} {subject.name}
                  </Text>
                  <Text style={[styles.subjectValue, { color: subTextColor }]}>
                    {formatMinutes(minutes)} · {count}🍅
                  </Text>
                </View>
                <View style={[styles.subjectBarTrack, { backgroundColor: trackColor }]}>
                  <View
                    style={[
                      styles.subjectBarFill,
                      { width: `${(minutes / maxSubjectMinutes) * 100}%`, backgroundColor: subject.color },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Genel Toplam */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Genel Toplam</Text>
          <View style={styles.totalRow}>
            <Text style={[styles.cardSubtitle, { color: subTextColor }]}>Toplam odak süresi</Text>
            <Text style={[styles.totalValue, { color: textColor }]}>{formatMinutes(totalMinutes)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.cardSubtitle, { color: subTextColor }]}>Açık görev</Text>
            <Text style={[styles.totalValue, { color: textColor }]}>{openTasks}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.cardSubtitle, { color: subTextColor }]}>Tamamlanan görev</Text>
            <Text style={[styles.totalValue, { color: textColor }]}>{doneTasks}</Text>
          </View>
        </View>
      </ScrollView>

      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },

  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },

  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringValue: {
    fontSize: 40,
    fontWeight: '800',
  },

  ringTotal: {
    fontSize: 20,
    fontWeight: '700',
  },

  ringLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  goalStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
  },

  goalStepperLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  goalStepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepperButtonText: {
    fontSize: 19,
    fontWeight: '700',
  },

  stepperValue: {
    width: 70,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },

  statRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  statCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  statEmoji: {
    fontSize: 20,
  },

  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },

  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },

  chartValue: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },

  chartBarTrack: {
    width: 22,
    borderRadius: 11,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  chartBar: {
    width: '100%',
    borderRadius: 11,
  },

  chartLabel: {
    fontSize: 11,
    marginTop: 6,
  },

  legendText: {
    fontSize: 11,
    marginTop: 10,
  },

  subjectRow: {
    marginTop: 14,
  },

  subjectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  subjectName: {
    fontSize: 14,
    fontWeight: '700',
  },

  subjectValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  subjectBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },

  subjectBarFill: {
    height: '100%',
    borderRadius: 5,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },

  totalValue: {
    fontSize: 15,
    fontWeight: '800',
  },
});
