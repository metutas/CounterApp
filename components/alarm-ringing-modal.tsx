import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';

import { alarmAudioPlayer } from '@/lib/audio-synth';
import { scheduleSnoozeNotificationFromModal } from '@/lib/notifications';
import { SOUND_THEMES, SoundThemeId } from '@/lib/sound-themes';

export type RingingAlarmData = {
  title?: string;
  label?: string;
  snoozeMinutes?: number;
  hasSound?: boolean;
  soundTheme?: SoundThemeId;
};

type Props = {
  visible: boolean;
  data: RingingAlarmData | null;
  onDismiss: () => void;
};

export function AlarmRingingModal({ visible, data, onDismiss }: Props) {
  const [currentTime, setCurrentTime] = useState('');
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible && data) {
      // Saat metnini güncelle
      const updateClock = () => {
        const now = new Date();
        const hrs = now.getHours().toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        setCurrentTime(`${hrs}:${mins}`);
      };

      updateClock();
      const clockInterval = setInterval(updateClock, 1000);

      // Özel Ses Tonunu Başlat
      if (data.hasSound !== false) {
        alarmAudioPlayer.startLoop(data.soundTheme || 'classic');
      }

      // Titreşim ve Haptic döngüsü
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 300, 500], true);
        vibrationIntervalRef.current = setInterval(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }, 1200);
      }

      return () => {
        clearInterval(clockInterval);
        alarmAudioPlayer.stop();
        if (vibrationIntervalRef.current) {
          clearInterval(vibrationIntervalRef.current);
        }
        if (Platform.OS !== 'web') {
          Vibration.cancel();
        }
      };
    }
  }, [visible, data]);

  if (!visible || !data) return null;

  const snoozeMins = data.snoozeMinutes ?? 5;
  const alarmLabel = data.label?.trim() ? data.label.trim() : 'Alarm';
  const soundThemeInfo = SOUND_THEMES.find((s) => s.id === (data.soundTheme || 'classic'));

  const handleSnooze = async () => {
    alarmAudioPlayer.stop();
    if (Platform.OS !== 'web') {
      Vibration.cancel();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Erteleme bildirimini zamanla
    await scheduleSnoozeNotificationFromModal(
      data.title ?? 'Alarm',
      alarmLabel,
      snoozeMins,
      {
        snoozeMinutes: snoozeMins,
        label: alarmLabel,
        hasSound: data.hasSound,
        soundTheme: data.soundTheme,
      }
    );
    onDismiss();
  };

  const handleStop = () => {
    alarmAudioPlayer.stop();
    if (Platform.OS !== 'web') {
      Vibration.cancel();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleStop}
    >
      <StatusBar hidden={true} />
      <View style={styles.container}>
        {/* Üst Alan: Etiket ve Ses Teması */}
        <View style={styles.header}>
          <Text style={styles.alarmBadge}>
            {soundThemeInfo ? `[${soundThemeInfo.badge.toUpperCase()}] ALARM` : 'ALARM'}
          </Text>
          <Text style={styles.labelTitle}>{alarmLabel}</Text>
          {soundThemeInfo && (
            <Text style={styles.soundThemeTag}>Ses: {soundThemeInfo.name}</Text>
          )}
        </View>

        {/* Orta Alan: Dev Saat */}
        <View style={styles.clockContainer}>
          <Text style={styles.clockText}>{currentTime}</Text>
          <Text style={styles.snoozeInfoText}>
            {snoozeMins > 0 ? `Erteleme süresi: ${snoozeMins} dakika` : 'Erteleme kapalı'}
          </Text>
        </View>

        {/* Alt Alan: Butonlar */}
        <View style={styles.actionsContainer}>
          {snoozeMins > 0 && (
            <Pressable style={styles.snoozeButton} onPress={handleSnooze}>
              <Text style={styles.snoozeButtonText}>Ertele ({snoozeMins} dk)</Text>
            </Pressable>
          )}

          <Pressable style={styles.stopButton} onPress={handleStop}>
            <Text style={styles.stopButtonText}>Kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 60,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  header: {
    alignItems: 'center',
    marginTop: 20,
  },

  alarmBadge: {
    color: '#FF9F0A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 8,
  },

  labelTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },

  soundThemeTag: {
    color: '#FFD60A',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },

  clockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  clockText: {
    color: '#FFFFFF',
    fontSize: 84,
    fontWeight: '200',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },

  snoozeInfoText: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },

  actionsContainer: {
    width: '100%',
    gap: 16,
  },

  snoozeButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#FF9F0A',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9F0A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  snoozeButtonText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
  },

  stopButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },

  stopButtonText: {
    color: '#FF453A',
    fontSize: 20,
    fontWeight: '700',
  },
});
