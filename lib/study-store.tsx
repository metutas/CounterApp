import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'study_state_v1';

// Oturum geçmişi sonsuza kadar büyümesin: sadece son ~4 ayı saklıyoruz
// (istatistik ekranı en fazla son 7 günü + toplamları gösteriyor).
const SESSION_RETENTION_DAYS = 120;

export type Subject = {
  id: string;
  name: string;
  color: string;
  emoji: string;
};

export type StudyTask = {
  id: string;
  subjectId: string;
  title: string;
  targetPomodoros: number;
  completedPomodoros: number;
  done: boolean;
  /** 'YYYY-MM-DD' — tarihsiz görevlerde null */
  dueDate: string | null;
  createdAt: number;
  completedAt: number | null;
};

export type StudySession = {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  at: number;
  minutes: number;
  taskId: string | null;
  subjectId: string | null;
};

export type StudyState = {
  subjects: Subject[];
  tasks: StudyTask[];
  sessions: StudySession[];
  dailyGoal: number;
  activeTaskId: string | null;
};

export const SUBJECT_COLORS = [
  '#FF6B6B',
  '#FFC107',
  '#4CAF50',
  '#03A9F4',
  '#9C27B0',
  '#FF7043',
  '#26A69A',
  '#EC407A',
];

export const SUBJECT_EMOJIS = ['📐', '📖', '🔬', '🏛️', '🌍', '🧪', '🗣️', '💻', '🎨', '🎵'];

const DEFAULT_STATE: StudyState = {
  // İlk açılışta boş ekran yerine örnek dersler: kullanıcı hemen görev eklemeye başlayabilsin.
  subjects: [
    { id: 'seed-math', name: 'Matematik', color: '#FF6B6B', emoji: '📐' },
    { id: 'seed-turkish', name: 'Türkçe', color: '#4CAF50', emoji: '📖' },
    { id: 'seed-science', name: 'Fen Bilimleri', color: '#03A9F4', emoji: '🔬' },
  ],
  tasks: [],
  sessions: [],
  dailyGoal: 8,
  activeTaskId: null,
};

export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type StudyContextValue = {
  loaded: boolean;
  subjects: Subject[];
  tasks: StudyTask[];
  sessions: StudySession[];
  dailyGoal: number;
  activeTaskId: string | null;
  activeTask: StudyTask | null;

  addSubject: (name: string, color: string, emoji: string) => void;
  removeSubject: (id: string) => void;

  addTask: (input: {
    subjectId: string;
    title: string;
    targetPomodoros: number;
    dueDate: string | null;
  }) => void;
  toggleTaskDone: (id: string) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;

  setDailyGoal: (value: number) => void;
  /** Bir çalışma turu tamamlandığında çağrılır: oturumu kaydeder ve aktif görevin sayacını artırır. */
  recordPomodoro: (minutes: number) => void;

  getSubject: (id: string | null) => Subject | null;
  todayPomodoros: number;
  todayMinutes: number;
  streakDays: number;
  last7Days: { date: string; label: string; count: number; minutes: number }[];
  subjectTotals: { subject: Subject; minutes: number; count: number }[];
  totalMinutes: number;
};

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudyState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<StudyState>;
          setState({
            subjects: parsed.subjects ?? DEFAULT_STATE.subjects,
            tasks: parsed.tasks ?? [],
            sessions: parsed.sessions ?? [],
            dailyGoal: parsed.dailyGoal ?? DEFAULT_STATE.dailyGoal,
            activeTaskId: parsed.activeTaskId ?? null,
          });
        }
      } catch {
        // Bozuk kayıt: varsayılan durumla devam et, kullanıcı uygulamayı yine de kullanabilsin.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const addSubject = useCallback((name: string, color: string, emoji: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      subjects: [...prev.subjects, { id: newId(), name: trimmed, color, emoji }],
    }));
  }, []);

  const removeSubject = useCallback((id: string) => {
    // Ders silinince ona bağlı görevler de gider; geçmiş oturum kayıtları
    // istatistik bütünlüğü için silinmez (subjectId artık eşleşmez, "Diğer" sayılır).
    setState((prev) => {
      const removedTaskIds = new Set(prev.tasks.filter((t) => t.subjectId === id).map((t) => t.id));
      return {
        ...prev,
        subjects: prev.subjects.filter((s) => s.id !== id),
        tasks: prev.tasks.filter((t) => t.subjectId !== id),
        activeTaskId:
          prev.activeTaskId && removedTaskIds.has(prev.activeTaskId) ? null : prev.activeTaskId,
      };
    });
  }, []);

  const addTask = useCallback(
    (input: { subjectId: string; title: string; targetPomodoros: number; dueDate: string | null }) => {
      const title = input.title.trim();
      if (!title) return;
      const task: StudyTask = {
        id: newId(),
        subjectId: input.subjectId,
        title,
        targetPomodoros: Math.max(1, input.targetPomodoros),
        completedPomodoros: 0,
        done: false,
        dueDate: input.dueDate,
        createdAt: Date.now(),
        completedAt: null,
      };
      setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
    },
    []
  );

  const toggleTaskDone = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done, completedAt: t.done ? null : Date.now() } : t
      ),
      // Tamamlanan görev aktif görevse seçim kalkar.
      activeTaskId:
        prev.activeTaskId === id && !prev.tasks.find((t) => t.id === id)?.done
          ? null
          : prev.activeTaskId,
    }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
      activeTaskId: prev.activeTaskId === id ? null : prev.activeTaskId,
    }));
  }, []);

  const setActiveTask = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, activeTaskId: prev.activeTaskId === id ? null : id }));
  }, []);

  const setDailyGoal = useCallback((value: number) => {
    setState((prev) => ({ ...prev, dailyGoal: Math.min(20, Math.max(1, value)) }));
  }, []);

  const recordPomodoro = useCallback((minutes: number) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === prev.activeTaskId) ?? null;
      const session: StudySession = {
        id: newId(),
        date: dateKey(),
        at: Date.now(),
        minutes,
        taskId: task?.id ?? null,
        subjectId: task?.subjectId ?? null,
      };

      const cutoff = dateKey(addDays(new Date(), -SESSION_RETENTION_DAYS));
      const sessions = [...prev.sessions, session].filter((s) => s.date >= cutoff);

      if (!task) return { ...prev, sessions };

      const completed = task.completedPomodoros + 1;
      const reachedTarget = completed >= task.targetPomodoros;
      return {
        ...prev,
        sessions,
        tasks: prev.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                completedPomodoros: completed,
                // Hedefe ulaşan görev otomatik tamamlanmış sayılır.
                done: t.done || reachedTarget,
                completedAt: t.done ? t.completedAt : reachedTarget ? Date.now() : null,
              }
            : t
        ),
        activeTaskId: reachedTarget ? null : prev.activeTaskId,
      };
    });
  }, []);

  const getSubject = useCallback(
    (id: string | null) => (id ? state.subjects.find((s) => s.id === id) ?? null : null),
    [state.subjects]
  );

  const activeTask = useMemo(
    () => state.tasks.find((t) => t.id === state.activeTaskId) ?? null,
    [state.tasks, state.activeTaskId]
  );

  const todaySessions = useMemo(() => {
    const key = dateKey();
    return state.sessions.filter((s) => s.date === key);
  }, [state.sessions]);

  const todayPomodoros = todaySessions.length;
  const todayMinutes = useMemo(
    () => todaySessions.reduce((sum, s) => sum + s.minutes, 0),
    [todaySessions]
  );

  const last7Days = useMemo(() => {
    const labels = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(), -(6 - i));
      const key = dateKey(d);
      const daySessions = state.sessions.filter((s) => s.date === key);
      return {
        date: key,
        label: labels[d.getDay()],
        count: daySessions.length,
        minutes: daySessions.reduce((sum, s) => sum + s.minutes, 0),
      };
    });
  }, [state.sessions]);

  // Seri: bugünden (veya bugün henüz hedefe ulaşılmadıysa dünden) geriye doğru
  // günlük hedefi tutturulan kesintisiz gün sayısı.
  const streakDays = useMemo(() => {
    const countByDate = new Map<string, number>();
    state.sessions.forEach((s) => {
      countByDate.set(s.date, (countByDate.get(s.date) ?? 0) + 1);
    });

    const goal = Math.max(1, state.dailyGoal);
    const todayMet = (countByDate.get(dateKey()) ?? 0) >= goal;

    let streak = 0;
    let cursor = todayMet ? 0 : -1;
    // Bugün hedef tutmadıysa seriyi dünden başlatıp saymaya devam ediyoruz;
    // böylece gün ortasında seri "sıfırlandı" gibi görünmüyor.
    for (let i = 0; i < SESSION_RETENTION_DAYS; i += 1) {
      const key = dateKey(addDays(new Date(), cursor - i));
      if ((countByDate.get(key) ?? 0) >= goal) streak += 1;
      else break;
    }
    return streak;
  }, [state.sessions, state.dailyGoal]);

  const subjectTotals = useMemo(() => {
    return state.subjects
      .map((subject) => {
        const rows = state.sessions.filter((s) => s.subjectId === subject.id);
        return {
          subject,
          minutes: rows.reduce((sum, s) => sum + s.minutes, 0),
          count: rows.length,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [state.subjects, state.sessions]);

  const totalMinutes = useMemo(
    () => state.sessions.reduce((sum, s) => sum + s.minutes, 0),
    [state.sessions]
  );

  const value: StudyContextValue = {
    loaded,
    subjects: state.subjects,
    tasks: state.tasks,
    sessions: state.sessions,
    dailyGoal: state.dailyGoal,
    activeTaskId: state.activeTaskId,
    activeTask,
    addSubject,
    removeSubject,
    addTask,
    toggleTaskDone,
    removeTask,
    setActiveTask,
    setDailyGoal,
    recordPomodoro,
    getSubject,
    todayPomodoros,
    todayMinutes,
    streakDays,
    last7Days,
    subjectTotals,
    totalMinutes,
  };

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyContextValue {
  const ctx = useContext(StudyContext);
  if (!ctx) {
    throw new Error('useStudy, StudyProvider içinde kullanılmalıdır');
  }
  return ctx;
}
