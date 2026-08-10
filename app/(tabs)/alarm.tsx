import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { WheelPicker } from '@/components/wheel-picker';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { alarmAudioPlayer } from '@/lib/audio-synth';
import {
  cancelAlarmNotification,
  ensureNotificationSetup,
  scheduleAlarmNotification,
} from '@/lib/notifications';
import { SOUND_THEMES, SoundThemeId } from '@/lib/sound-themes';

const STORAGE_KEY = 'alarms';
const HOURS_RANGE = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_RANGE = Array.from({ length: 60 }, (_, i) => i);
const SNOOZE_OPTIONS = [0, 5, 10, 15, 30];

type Alarm = {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  label?: string;
  snoozeMinutes?: number;
  hasSound?: boolean;
  soundTheme?: SoundThemeId;
  notificationId: string | null;
};

export default function AlarmScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formHour, setFormHour] = useState(7);
  const [formMinute, setFormMinute] = useState(0);
  const [formLabel, setFormLabel] = useState('');
  const [formSnoozeMinutes, setFormSnoozeMinutes] = useState(5);
  const [formHasSound, setFormHasSound] = useState(true);
  const [formSoundTheme, setFormSoundTheme] = useState<SoundThemeId>('classic');

  useEffect(() => {
    requestAnimationFrame(() => {
      ensureNotificationSetup();
    });
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setAlarms(JSON.parse(raw));
        }
      } catch {
        // Bozuk/eski formatlı kayıtlı veri varsa sessizce boş listeyle devam et
        // (JSON.parse hatası yakalanmazsa setLoaded hiç çağrılmaz ve alarmlar kalıcı
        // olarak kaydedilemez hâle gelirdi).
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    }
  }, [alarms, loaded]);

  const openAddForm = () => {
    setEditingId(null);
    setFormHour(7);
    setFormMinute(0);
    setFormLabel('');
    setFormSnoozeMinutes(5);
    setFormHasSound(true);
    setFormSoundTheme('classic');
    setIsFormVisible(true);
  };

  const openEditForm = (alarm: Alarm) => {
    setEditingId(alarm.id);
    setFormHour(alarm.hour);
    setFormMinute(alarm.minute);
    setFormLabel(alarm.label || '');
    setFormSnoozeMinutes(alarm.snoozeMinutes || 5);
    setFormHasSound(alarm.hasSound !== false);
    setFormSoundTheme(alarm.soundTheme || 'classic');
    setIsFormVisible(true);
  };

  const handlePreviewTone = (themeId: SoundThemeId) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 150, 100, 200]);
    }
    alarmAudioPlayer.preview(themeId);
  };

  const handleSave = async () => {
    if (editingId) {
      // Alarm düzenleme
      const existing = alarms.find((a) => a.id === editingId);
      if (!existing) return;

      if (existing.notificationId) {
        await cancelAlarmNotification(existing.notificationId);
      }

      let newNotificationId: string | null = null;
      if (existing.enabled) {
        newNotificationId = await scheduleAlarmNotification(
          formHour,
          formMinute,
          formLabel,
          formSnoozeMinutes,
          formHasSound,
          formSoundTheme
        );
      }

      setAlarms((prev) =>
        prev
          .map((a) =>
            a.id === editingId
              ? {
                  ...a,
                  hour: formHour,
                  minute: formMinute,
                  label: formLabel,
                  snoozeMinutes: formSnoozeMinutes,
                  hasSound: formHasSound,
                  soundTheme: formSoundTheme,
                  notificationId: newNotificationId,
                }
              : a
          )
          .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
      );
    } else {
      // Yeni alarm ekleme
      const notificationId = await scheduleAlarmNotification(
        formHour,
        formMinute,
        formLabel,
        formSnoozeMinutes,
        formHasSound,
        formSoundTheme
      );
      const alarm: Alarm = {
        id: `${Date.now()}`,
        hour: formHour,
        minute: formMinute,
        enabled: true,
        label: formLabel,
        snoozeMinutes: formSnoozeMinutes,
        hasSound: formHasSound,
        soundTheme: formSoundTheme,
        notificationId,
      };
      setAlarms((prev) =>
        [...prev, alarm].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
      );
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsFormVisible(false);
  };

  const handleToggle = async (id: string, value: boolean) => {
    const alarm = alarms.find((a) => a.id === id);
    if (!alarm) return;

    if (value) {
      const notificationId = await scheduleAlarmNotification(
        alarm.hour,
        alarm.minute,
        alarm.label || '',
        alarm.snoozeMinutes || 5,
        alarm.hasSound !== false,
        alarm.soundTheme || 'classic'
      );
      setAlarms((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: true, notificationId } : a))
      );
    } else {
      if (alarm.notificationId) {
        await cancelAlarmNotification(alarm.notificationId);
      }
      setAlarms((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: false, notificationId: null } : a))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const alarm = alarms.find((a) => a.id === id);
    if (alarm?.notificationId) {
      await cancelAlarmNotification(alarm.notificationId);
    }
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const textColor = isDark ? '#ffffff' : '#000000';
  const cardBg = isDark ? '#1c1c1e' : '#f5f5f7';
  const inputBg = isDark ? '#2c2c2e' : '#e5e5ea';
  const subTextColor = isDark ? '#a0a0a5' : '#666666';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      {/* Ortalanmış Şık Başlık */}
      <View style={styles.centerHeaderContainer}>
        <Text style={[styles.screenTitleCentered, { color: textColor }]}>Alarmlarım ⏰</Text>
        {!isFormVisible && (
          <Pressable style={styles.singleAddButton} onPress={openAddForm}>
            <Text style={styles.singleAddButtonText}>+ Yeni Alarm Ekle</Text>
          </Pressable>
        )}
      </View>

      {/* Ekranı Tam Kaplayan Okunaklı Alarm Ekleme / Düzenleme Alanı */}
      {isFormVisible ? (
        <ScrollView
          style={styles.fullFormWrapper}
          contentContainerStyle={[styles.fullFormContainer, { backgroundColor: cardBg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.formTitle, { color: textColor }]}>
            {editingId ? 'Alarmı Düzenle' : 'Yeni Alarm Ayarla'}
          </Text>

          {/* Saat Seçici */}
          <View style={styles.pickerRow}>
            <WheelPicker
              values={HOURS_RANGE}
              selected={formHour}
              onChange={setFormHour}
              isDark={isDark}
            />
            <Text style={[styles.pickerColon, { color: textColor }]}>:</Text>
            <WheelPicker
              values={MINUTES_RANGE}
              selected={formMinute}
              onChange={setFormMinute}
              isDark={isDark}
            />
          </View>

          {/* Etiket / Mesaj */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Alarm Etiketi</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: inputBg, color: textColor }]}
              placeholder="örn: Toplantı, Spor, İlaç vakti..."
              placeholderTextColor={subTextColor}
              value={formLabel}
              onChangeText={setFormLabel}
              maxLength={35}
            />
          </View>

          {/* Erteleme Süresi */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Erteleme Süresi</Text>
            <View style={styles.chipRow}>
              {SNOOZE_OPTIONS.map((mins) => {
                const selected = formSnoozeMinutes === mins;
                return (
                  <Pressable
                    key={mins}
                    style={[
                      styles.chip,
                      { backgroundColor: selected ? '#FFC107' : inputBg },
                    ]}
                    onPress={() => setFormSnoozeMinutes(mins)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? '#000000' : textColor, fontWeight: selected ? '700' : '600' },
                      ]}
                    >
                      {mins === 0 ? 'Kapalı' : `${mins} dk`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Ses Tonu Seçimi */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: subTextColor }]}>Alarm Sesi Tonu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.soundPillsRow}>
              {SOUND_THEMES.map((theme) => {
                const selected = formSoundTheme === theme.id;
                return (
                  <Pressable
                    key={theme.id}
                    style={[
                      styles.soundPill,
                      { backgroundColor: selected ? '#FFC107' : inputBg },
                    ]}
                    onPress={() => setFormSoundTheme(theme.id)}
                  >
                    <Text
                      style={[
                        styles.soundPillText,
                        { color: selected ? '#000000' : textColor, fontWeight: selected ? '700' : '600' },
                      ]}
                    >
                      {theme.badge}
                    </Text>
                    <Pressable
                      style={styles.pillPlayBtn}
                      onPress={() => handlePreviewTone(theme.id)}
                      hitSlop={8}
                    >
                      <Text style={[styles.pillPlayBtnText, { color: selected ? '#000000' : '#8e8e93' }]}>
                        ▶ Dinle
                      </Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Butonlar */}
          <View style={styles.formButtonRow}>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{editingId ? 'Güncelle' : 'Kaydet'}</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setIsFormVisible(false)}>
              <Text style={styles.cancelButtonText}>İptal</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        /* Ekranı Tam Oturacak Şekilde Kaplayan Okunaklı Alarmlar Listesi */
        <FlatList
          style={styles.list}
          contentContainerStyle={alarms.length === 0 ? styles.emptyList : styles.listContent}
          data={alarms}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: subTextColor }]}>
                Henüz kayıtlı alarmınız yok
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const theme = SOUND_THEMES.find((t) => t.id === (item.soundTheme || 'classic'));
            return (
              <Pressable
                style={[styles.alarmCard, { backgroundColor: cardBg }]}
                onPress={() => openEditForm(item)}
              >
                <View style={styles.alarmInfo}>
                  <Text style={[styles.alarmTime, { color: item.enabled ? textColor : subTextColor }]}>
                    {item.hour.toString().padStart(2, '0')}:{item.minute.toString().padStart(2, '0')}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.alarmLabelText, { color: item.enabled ? textColor : subTextColor }]}>
                      {item.label?.trim() ? item.label.trim() : 'Alarm'}
                    </Text>
                    <Text style={[styles.snoozeBadge, { color: subTextColor }]}>
                      • {item.snoozeMinutes === 0 ? 'Erteleme Kapalı' : `${item.snoozeMinutes ?? 5} dk`} [{theme?.badge || 'Klasik'}]
                    </Text>
                  </View>
                </View>

                <View style={styles.alarmActions}>
                  <Switch
                    value={item.enabled}
                    onValueChange={(v) => handleToggle(item.id, v)}
                  />
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.deleteButtonText}>Sil</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {!isFormVisible && <AdBanner />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },

  centerHeaderContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  screenTitleCentered: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },

  singleAddButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginTop: 12,
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  singleAddButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  fullFormWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    marginBottom: 20,
  },

  fullFormContainer: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },

  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  pickerColon: {
    fontSize: 34,
    fontWeight: '600',
    marginHorizontal: 8,
  },

  fieldSection: {
    width: '100%',
    marginBottom: 20,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  textInput: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  chip: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
  },

  chipText: {
    fontSize: 14,
  },

  soundPillsRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },

  soundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 8,
  },

  soundPillText: {
    fontSize: 14,
  },

  pillPlayBtn: {
    marginLeft: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },

  pillPlayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  formButtonRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
    justifyContent: 'center',
  },

  saveButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    marginHorizontal: 8,
    minWidth: 120,
    alignItems: 'center',
  },

  saveButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
  },

  cancelButton: {
    backgroundColor: '#8e8e93',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    marginHorizontal: 8,
    minWidth: 120,
    alignItems: 'center',
  },

  cancelButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },

  list: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
  },

  listContent: {
    paddingBottom: 40,
  },

  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  emptyText: {
    fontSize: 18,
  },

  alarmCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: 20,
    marginBottom: 14,
    width: '100%',
  },

  alarmInfo: {
    flex: 1,
  },

  alarmTime: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  alarmLabelText: {
    fontSize: 15,
    fontWeight: '600',
  },

  snoozeBadge: {
    fontSize: 14,
    marginLeft: 6,
  },

  alarmActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  deleteButton: {
    marginLeft: 16,
    backgroundColor: '#f44336',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },

  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
