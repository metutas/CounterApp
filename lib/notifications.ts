import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { SOUND_THEMES, SoundThemeId } from './sound-themes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    // Sistem sesi ön planda kasıtlı olarak kapalı: uygulama açıkken gerçek tema sesi
    // JS ile çalan alarmAudioPlayer'ın loop'u üzerinden geliyor (bkz. alarm-ringing-modal.tsx).
    // İkisi birlikte açık olursa iki ses üst üste biniyordu. Uygulama arka plandayken/kapalıyken
    // bu handler hiç çalışmaz — o zaman gerçek ses, aşağıdaki tema-başına bildirim kanalının
    // gömülü .wav dosyasından (assets/sounds/) native olarak çalar.
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const ALARM_CHANNEL_ID = 'alarms';
const SNOOZE_MINUTES = 5;

// Android bildirim kanalları oluşturulduktan sonra sesi DEĞİŞTİRİLEMEZ; bu yüzden her ses
// teması için ayrı bir kanal açıyoruz (aksi hâlde tüm alarmlar tek bir sabit sesle çalardı).
function themeChannelId(soundTheme: SoundThemeId): string {
  return `alarm_${soundTheme}`;
}

function themeSoundFile(soundTheme: SoundThemeId): string {
  return `${soundTheme}.wav`;
}

// hasSound=false ise sessiz varsayılan kanal/ses; aksi hâlde temaya özel kanal + gerçek .wav.
function resolveSoundTarget(hasSound: boolean, soundTheme: SoundThemeId) {
  if (!hasSound) {
    return { channelId: ALARM_CHANNEL_ID, sound: undefined as string | undefined };
  }
  return { channelId: themeChannelId(soundTheme), sound: themeSoundFile(soundTheme) };
}

const SNOOZE_ACTION = 'snooze';
const DISMISS_ACTION = 'dismiss';

type AlarmTriggerCallback = (data: {
  title?: string;
  label?: string;
  snoozeMinutes?: number;
  hasSound?: boolean;
  soundTheme?: SoundThemeId;
}) => void;

let alarmTriggerListeners: AlarmTriggerCallback[] = [];

export function subscribeToAlarmTrigger(callback: AlarmTriggerCallback) {
  alarmTriggerListeners.push(callback);
  return () => {
    alarmTriggerListeners = alarmTriggerListeners.filter((l) => l !== callback);
  };
}

function notifyAlarmTrigger(data: {
  title?: string;
  label?: string;
  snoozeMinutes?: number;
  hasSound?: boolean;
  soundTheme?: SoundThemeId;
}) {
  alarmTriggerListeners.forEach((listener) => listener(data));
}

let isNotificationSetupDone = false;

export async function ensureNotificationSetup() {
  if (isNotificationSetupDone) return;
  isNotificationSetupDone = true;

  // Web'de zamanlanmış yerel bildirim desteklenmiyor; sadece native platformlarda kur.
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android') {
    // Sessiz varsayılan kanal (hasSound=false alarmlar için).
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Alarmlar (Sessiz)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 250, 400],
      sound: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    });

    // Her ses teması için ayrı kanal + gömülü gerçek .wav dosyası (app.json > expo-notifications
    // "sounds" plugin config ile native build'e gömülür — bkz. assets/sounds/, scripts/bake-sound-assets.js).
    for (const theme of SOUND_THEMES) {
      await Notifications.setNotificationChannelAsync(themeChannelId(theme.id), {
        name: `Alarm - ${theme.name}`,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 250, 400],
        sound: themeSoundFile(theme.id),
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
    }
  }

  // Varsayılan kategoriyi kaydet (5 dk)
  await getCategoryForSnooze(SNOOZE_MINUTES);

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

async function getCategoryForSnooze(snoozeMinutes: number = 5): Promise<string> {
  const categoryId = `alarm_actions_${snoozeMinutes}`;
  if (Platform.OS !== 'web') {
    const actions =
      snoozeMinutes === 0
        ? [
            {
              identifier: DISMISS_ACTION,
              buttonTitle: 'Kapat',
              options: { isDestructive: true, opensAppToForeground: false },
            },
          ]
        : [
            {
              identifier: SNOOZE_ACTION,
              buttonTitle: `Ertele (${snoozeMinutes} dk)`,
              options: { opensAppToForeground: false },
            },
            {
              identifier: DISMISS_ACTION,
              buttonTitle: 'Kapat',
              options: { isDestructive: true, opensAppToForeground: false },
            },
          ];

    await Notifications.setNotificationCategoryAsync(categoryId, actions);
  }
  return categoryId;
}

export async function scheduleAlarmNotification(
  hour: number,
  minute: number,
  label: string,
  snoozeMinutes: number = 5,
  hasSound: boolean = true,
  soundTheme: SoundThemeId = 'classic'
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const categoryIdentifier = await getCategoryForSnooze(snoozeMinutes);
  const { channelId, sound } = resolveSoundTarget(hasSound, soundTheme);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Alarm',
      body: label.trim() || 'Alarm zamanı geldi',
      sound,
      categoryIdentifier,
      interruptionLevel: 'timeSensitive',
      data: { label, snoozeMinutes, hasSound, soundTheme },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId,
    },
  });
}

export async function cancelAlarmNotification(notificationId: string) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Alarm sesini ve bildirimini anında (1 saniye içinde) test etmek için
export async function testAlarmSound(
  label?: string,
  snoozeMinutes: number = 5,
  hasSound: boolean = true,
  soundTheme: SoundThemeId = 'classic'
) {
  if (Platform.OS === 'web') return;

  const categoryIdentifier = await getCategoryForSnooze(snoozeMinutes);
  const { channelId, sound } = resolveSoundTarget(hasSound, soundTheme);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Alarm Ses & Bildirim Testi',
      body: label?.trim() ? `[Test] ${label.trim()}` : '[Test] Alarm sesi ve bildirimi çalıyor!',
      sound,
      categoryIdentifier,
      interruptionLevel: 'timeSensitive',
      data: { label: label || 'Test', snoozeMinutes, hasSound, soundTheme },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId,
    },
  });
}

// Sayaç bittiğinde anında ses + bildirim göstermek için (alarmlarla aynı kanalı kullanır).
export async function presentTimerFinishedAlert(
  title: string,
  body: string,
  soundTheme: SoundThemeId = 'classic'
) {
  notifyAlarmTrigger({
    title,
    label: body || title,
    snoozeMinutes: 5,
    hasSound: true,
    soundTheme,
  });

  if (Platform.OS === 'web') return;

  const categoryIdentifier = await getCategoryForSnooze(5);
  const { channelId, sound } = resolveSoundTarget(true, soundTheme);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound,
      categoryIdentifier,
      interruptionLevel: 'timeSensitive',
      data: { label: body || title, snoozeMinutes: 5, hasSound: true, soundTheme },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId,
    },
  });
}

async function scheduleSnoozeNotification(
  title: string,
  body: string,
  snoozeMinutes: number,
  data?: Record<string, any>
) {
  const hasSound = data?.hasSound !== false;
  const soundTheme: SoundThemeId = (data?.soundTheme as SoundThemeId) ?? 'classic';
  const categoryIdentifier = await getCategoryForSnooze(snoozeMinutes);
  const { channelId, sound } = resolveSoundTarget(hasSound, soundTheme);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound,
      categoryIdentifier,
      interruptionLevel: 'timeSensitive',
      data: data ?? { snoozeMinutes, hasSound, soundTheme },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, snoozeMinutes * 60),
      channelId,
    },
  });
}

export async function scheduleSnoozeNotificationFromModal(
  title: string,
  body: string,
  snoozeMinutes: number,
  data?: Record<string, any>
) {
  return scheduleSnoozeNotification(title, body, snoozeMinutes, data);
}

// "Ertele" / "Kapat" butonlarına veya bildirime basıldığında tetiklenir. Uygulama boyunca bir kez kaydedilmeli.
export function registerAlarmActionHandler() {
  if (Platform.OS === 'web') return () => {};

  // Uygulama açıkken gelen tüm alarm bildirimlerini yakala ve tam ekran modalı aç
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    const data = content.data as { snoozeMinutes?: number; label?: string; hasSound?: boolean; soundTheme?: SoundThemeId } | undefined;
    notifyAlarmTrigger({
      title: content.title ?? 'Alarm',
      label: data?.label || content.body || 'Alarm zamanı geldi',
      snoozeMinutes: data?.snoozeMinutes ?? 5,
      hasSound: data?.hasSound !== false,
      soundTheme: data?.soundTheme ?? 'classic',
    });
  });

  // Kullanıcı bildirime tıkladığında veya buton kullandığında
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const content = response.notification.request.content;
    const data = content.data as { snoozeMinutes?: number; label?: string; hasSound?: boolean; soundTheme?: SoundThemeId } | undefined;
    const snoozeMinutes = data?.snoozeMinutes && typeof data.snoozeMinutes === 'number' ? data.snoozeMinutes : 5;

    if (response.actionIdentifier === SNOOZE_ACTION) {
      scheduleSnoozeNotification(
        content.title ?? 'Alarm',
        content.body ?? 'Alarm zamanı geldi',
        snoozeMinutes,
        data
      );
    } else if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      notifyAlarmTrigger({
        title: content.title ?? 'Alarm',
        label: data?.label || content.body || 'Alarm zamanı geldi',
        snoozeMinutes,
        hasSound: data?.hasSound !== false,
        soundTheme: data?.soundTheme ?? 'classic',
      });
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
