import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  SUBJECT_COLORS,
  SUBJECT_EMOJIS,
  StudyTask,
  Subject,
  dateKey,
  useStudy,
} from '@/lib/study-store';

const TOP_INSET = Platform.OS === 'ios' ? 52 : (RNStatusBar.currentHeight ?? 24) + 8;

type Filter = 'active' | 'done' | 'all';

const TARGET_OPTIONS = [1, 2, 3, 4, 6, 8];

function addDaysKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

function formatDue(due: string | null): string | null {
  if (!due) return null;
  if (due === dateKey()) return 'Bugün';
  if (due === addDaysKey(1)) return 'Yarın';
  if (due < dateKey()) return `Gecikmiş · ${due.slice(8)}.${due.slice(5, 7)}`;
  return `${due.slice(8)}.${due.slice(5, 7)}`;
}

export default function TasksScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    subjects,
    tasks,
    dailyGoal,
    todayPomodoros,
    activeTaskId,
    addSubject,
    removeSubject,
    addTask,
    toggleTaskDone,
    removeTask,
    setActiveTask,
    getSubject,
  } = useStudy();

  const [filter, setFilter] = useState<Filter>('active');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  // Görev formu
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formSubjectId, setFormSubjectId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState(2);
  const [formDue, setFormDue] = useState<string | null>(null);

  // Ders formu
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectColor, setSubjectColor] = useState(SUBJECT_COLORS[0]);
  const [subjectEmoji, setSubjectEmoji] = useState(SUBJECT_EMOJIS[0]);

  const textColor = isDark ? '#ffffff' : '#000000';
  const subTextColor = isDark ? '#a0a0a5' : '#666666';
  const cardBg = isDark ? '#1c1c1e' : '#f5f5f7';
  const inputBg = isDark ? '#2c2c2e' : '#e5e5ea';

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
      .filter((t) => (subjectFilter ? t.subjectId === subjectFilter : true))
      .sort((a, b) => {
        // Önce tarihi olanlar (en yakın tarih üstte), sonra yeni eklenenler.
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return b.createdAt - a.createdAt;
      });
  }, [tasks, filter, subjectFilter]);

  const openTaskForm = () => {
    if (subjects.length === 0) {
      Alert.alert('Önce ders ekle', 'Görev oluşturabilmek için en az bir ders eklemelisin.');
      setShowSubjectForm(true);
      return;
    }
    setFormTitle('');
    setFormSubjectId(subjectFilter ?? subjects[0].id);
    setFormTarget(2);
    setFormDue(null);
    setShowTaskForm(true);
  };

  const handleAddTask = () => {
    if (!formTitle.trim() || !formSubjectId) return;
    addTask({
      subjectId: formSubjectId,
      title: formTitle,
      targetPomodoros: formTarget,
      dueDate: formDue,
    });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowTaskForm(false);
  };

  const handleAddSubject = () => {
    if (!subjectName.trim()) return;
    addSubject(subjectName, subjectColor, subjectEmoji);
    setSubjectName('');
    setShowSubjectForm(false);
  };

  const confirmRemoveSubject = (subject: Subject) => {
    const taskCount = tasks.filter((t) => t.subjectId === subject.id).length;
    const message = taskCount
      ? `"${subject.name}" dersi ve ona bağlı ${taskCount} görev silinecek. Geçmiş istatistiklerin korunur.`
      : `"${subject.name}" dersi silinecek.`;

    if (Platform.OS === 'web') {
      // Alert.alert web'de buton geri çağırmalarını desteklemiyor; onay için confirm kullanılır.
      if (typeof window !== 'undefined' && window.confirm(message)) {
        if (subjectFilter === subject.id) setSubjectFilter(null);
        removeSubject(subject.id);
      }
      return;
    }

    Alert.alert('Dersi sil', message, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          if (subjectFilter === subject.id) setSubjectFilter(null);
          removeSubject(subject.id);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: TOP_INSET }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.screenTitle, { color: textColor }]}>Çalışma Görevleri 📚</Text>

        {/* Günlük Hedef Özeti */}
        <View style={[styles.goalCard, { backgroundColor: cardBg }]}>
          <View style={styles.goalTextCol}>
            <Text style={[styles.goalLabel, { color: subTextColor }]}>Bugünkü hedef</Text>
            <Text style={[styles.goalValue, { color: textColor }]}>
              {todayPomodoros} / {dailyGoal} pomodoro
            </Text>
          </View>
          <View style={[styles.goalBarTrack, { backgroundColor: inputBg }]}>
            <View
              style={[
                styles.goalBarFill,
                { width: `${Math.min(100, (todayPomodoros / Math.max(1, dailyGoal)) * 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* Dersler */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Dersler</Text>
          <Pressable onPress={() => setShowSubjectForm((v) => !v)} hitSlop={8}>
            <Text style={styles.linkText}>{showSubjectForm ? 'Kapat' : '＋ Ders Ekle'}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable
            style={[styles.subjectChip, { backgroundColor: subjectFilter === null ? '#FFC107' : inputBg }]}
            onPress={() => setSubjectFilter(null)}
          >
            <Text
              style={[
                styles.subjectChipText,
                { color: subjectFilter === null ? '#000000' : textColor },
              ]}
            >
              Tümü
            </Text>
          </Pressable>

          {subjects.map((subject) => {
            const selected = subjectFilter === subject.id;
            return (
              <Pressable
                key={subject.id}
                style={[
                  styles.subjectChip,
                  {
                    backgroundColor: selected ? subject.color : inputBg,
                    borderColor: subject.color,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setSubjectFilter(selected ? null : subject.id)}
                onLongPress={() => confirmRemoveSubject(subject)}
              >
                <Text
                  style={[styles.subjectChipText, { color: selected ? '#000000' : textColor }]}
                >
                  {subject.emoji} {subject.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[styles.hintText, { color: subTextColor }]}>
          Dersi silmek için üzerine uzun bas.
        </Text>

        {/* Ders Ekleme Formu */}
        {showSubjectForm && (
          <View style={[styles.formCard, { backgroundColor: cardBg }]}>
            <TextInput
              style={[styles.textInput, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Ders adı (örn: Geometri)"
              placeholderTextColor={subTextColor}
              value={subjectName}
              onChangeText={setSubjectName}
              maxLength={24}
            />

            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Simge</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {SUBJECT_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.emojiChip,
                    { backgroundColor: subjectEmoji === emoji ? '#FFC107' : inputBg },
                  ]}
                  onPress={() => setSubjectEmoji(emoji)}
                >
                  <Text style={styles.emojiChipText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Renk</Text>
            <View style={styles.colorRow}>
              {SUBJECT_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    subjectColor === color && styles.colorDotSelected,
                  ]}
                  onPress={() => setSubjectColor(color)}
                />
              ))}
            </View>

            <Pressable style={styles.primaryButton} onPress={handleAddSubject}>
              <Text style={styles.primaryButtonText}>Dersi Kaydet</Text>
            </Pressable>
          </View>
        )}

        {/* Görev Filtreleri */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Görevler</Text>
          <Pressable onPress={openTaskForm} hitSlop={8}>
            <Text style={styles.linkText}>＋ Görev Ekle</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {(
            [
              ['active', 'Aktif'],
              ['done', 'Tamamlanan'],
              ['all', 'Tümü'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.filterChip, { backgroundColor: filter === key ? '#FFC107' : inputBg }]}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: filter === key ? '#000000' : textColor, fontWeight: filter === key ? '700' : '600' },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Görev Ekleme Formu */}
        {showTaskForm && (
          <View style={[styles.formCard, { backgroundColor: cardBg }]}>
            <TextInput
              style={[styles.textInput, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Görev (örn: Türev testi 40 soru)"
              placeholderTextColor={subTextColor}
              value={formTitle}
              onChangeText={setFormTitle}
              maxLength={60}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Ders</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {subjects.map((subject) => {
                const selected = formSubjectId === subject.id;
                return (
                  <Pressable
                    key={subject.id}
                    style={[
                      styles.subjectChip,
                      { backgroundColor: selected ? subject.color : inputBg },
                    ]}
                    onPress={() => setFormSubjectId(subject.id)}
                  >
                    <Text
                      style={[styles.subjectChipText, { color: selected ? '#000000' : textColor }]}
                    >
                      {subject.emoji} {subject.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Hedef pomodoro sayısı</Text>
            <View style={styles.filterRow}>
              {TARGET_OPTIONS.map((n) => (
                <Pressable
                  key={n}
                  style={[
                    styles.targetChip,
                    { backgroundColor: formTarget === n ? '#FFC107' : inputBg },
                  ]}
                  onPress={() => setFormTarget(n)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: formTarget === n ? '#000000' : textColor },
                    ]}
                  >
                    {n}🍅
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Ne zaman?</Text>
            <View style={styles.filterRow}>
              {(
                [
                  [null, 'Tarihsiz'],
                  [dateKey(), 'Bugün'],
                  [addDaysKey(1), 'Yarın'],
                  [addDaysKey(7), 'Bu hafta'],
                ] as [string | null, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={label}
                  style={[styles.filterChip, { backgroundColor: formDue === value ? '#FFC107' : inputBg }]}
                  onPress={() => setFormDue(value)}
                >
                  <Text
                    style={[styles.filterChipText, { color: formDue === value ? '#000000' : textColor }]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.formButtonRow}>
              <Pressable style={styles.primaryButton} onPress={handleAddTask}>
                <Text style={styles.primaryButtonText}>Görevi Ekle</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setShowTaskForm(false)}>
                <Text style={styles.secondaryButtonText}>İptal</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Görev Listesi */}
        {visibleTasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: subTextColor }]}>
              {filter === 'done'
                ? 'Henüz tamamlanan görev yok.'
                : 'Görev yok. Yukarıdan yeni bir çalışma görevi ekle 👆'}
            </Text>
          </View>
        ) : (
          visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              subject={getSubject(task.subjectId)}
              isActive={activeTaskId === task.id}
              cardBg={cardBg}
              trackBg={inputBg}
              textColor={textColor}
              subTextColor={subTextColor}
              onToggle={() => toggleTaskDone(task.id)}
              onSetActive={() => setActiveTask(task.id)}
              onRemove={() => removeTask(task.id)}
            />
          ))
        )}
      </ScrollView>

      <AdBanner />
    </KeyboardAvoidingView>
  );
}

function TaskCard({
  task,
  subject,
  isActive,
  cardBg,
  trackBg,
  textColor,
  subTextColor,
  onToggle,
  onSetActive,
  onRemove,
}: {
  task: StudyTask;
  subject: Subject | null;
  isActive: boolean;
  cardBg: string;
  trackBg: string;
  textColor: string;
  subTextColor: string;
  onToggle: () => void;
  onSetActive: () => void;
  onRemove: () => void;
}) {
  const color = subject?.color ?? '#8e8e93';
  const progress = Math.min(1, task.completedPomodoros / Math.max(1, task.targetPomodoros));
  const dueLabel = formatDue(task.dueDate);
  const overdue = !!task.dueDate && task.dueDate < dateKey() && !task.done;

  return (
    <View
      style={[
        styles.taskCard,
        { backgroundColor: cardBg, borderLeftColor: color },
        isActive && styles.taskCardActive,
      ]}
    >
      <Pressable style={styles.checkbox} onPress={onToggle} hitSlop={8}>
        <View
          style={[
            styles.checkboxInner,
            { borderColor: color, backgroundColor: task.done ? color : 'transparent' },
          ]}
        >
          {task.done && <Text style={styles.checkboxTick}>✓</Text>}
        </View>
      </Pressable>

      <View style={styles.taskBody}>
        <Text
          style={[
            styles.taskTitle,
            { color: task.done ? subTextColor : textColor },
            task.done && styles.taskTitleDone,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        <View style={styles.taskMetaRow}>
          <Text style={[styles.taskMeta, { color }]}>
            {subject ? `${subject.emoji} ${subject.name}` : 'Ders yok'}
          </Text>
          <Text style={[styles.taskMeta, { color: subTextColor }]}>
            {' · '}
            {task.completedPomodoros}/{task.targetPomodoros} 🍅
          </Text>
          {dueLabel && (
            <Text style={[styles.taskMeta, { color: overdue ? '#f44336' : subTextColor }]}>
              {' · '}
              {dueLabel}
            </Text>
          )}
        </View>

        <View style={[styles.taskBarTrack, { backgroundColor: trackBg }]}>
          <View style={[styles.taskBarFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
        </View>
      </View>

      <View style={styles.taskActions}>
        {!task.done && (
          <Pressable
            style={[styles.activeButton, { backgroundColor: isActive ? '#FFC107' : trackBg }]}
            onPress={onSetActive}
            hitSlop={6}
          >
            <Text style={[styles.activeButtonText, { color: isActive ? '#000000' : subTextColor }]}>
              {isActive ? '● Aktif' : 'Çalış'}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeText}>Sil</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },

  goalCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },

  goalTextCol: {
    marginBottom: 10,
  },

  goalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  goalValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },

  goalBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },

  goalBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#FFC107',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },

  linkText: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '700',
  },

  chipRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },

  subjectChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginRight: 8,
  },

  subjectChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  hintText: {
    fontSize: 11,
    marginTop: 2,
  },

  formCard: {
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    marginBottom: 6,
  },

  textInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },

  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  emojiChipText: {
    fontSize: 20,
  },

  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    marginBottom: 8,
  },

  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
    transform: [{ scale: 1.12 }],
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },

  filterChip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },

  targetChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },

  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  formButtonRow: {
    flexDirection: 'row',
    marginTop: 16,
  },

  primaryButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    marginRight: 10,
  },

  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },

  secondaryButton: {
    backgroundColor: '#8e8e93',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },

  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderLeftWidth: 5,
    padding: 14,
    marginBottom: 10,
  },

  taskCardActive: {
    borderWidth: 2,
    borderColor: '#FFC107',
  },

  checkbox: {
    marginRight: 12,
  },

  checkboxInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxTick: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
  },

  taskBody: {
    flex: 1,
  },

  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  taskTitleDone: {
    textDecorationLine: 'line-through',
  },

  taskMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 3,
  },

  taskMeta: {
    fontSize: 12,
    fontWeight: '600',
  },

  taskBarTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },

  taskBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  taskActions: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },

  activeButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },

  activeButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },

  removeText: {
    color: '#f44336',
    fontSize: 12,
    fontWeight: '700',
  },
});
