import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { apiService } from '@/services/ApiService';

function timeStringToDate(hhmm: string): Date {
  const parts = hhmm.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDisplayTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function TimeButton({
  label,
  date,
  onChange,
  disabled = false,
}: {
  label: string;
  date: Date;
  onChange: (d: Date) => void;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [webValue, setWebValue] = useState(dateToTimeString(date));
  const webInputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      onChange(selected);
    }
  };

  useEffect(() => {
    setWebValue(dateToTimeString(date));
  }, [date]);

  const handlePress = () => {
    if (disabled) return;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        is24Hour: false,
        onChange: handleChange,
      });
      return;
    }

    if (Platform.OS === 'web') {
      const nextValue = dateToTimeString(date);
      setWebValue(nextValue);
      const input = webInputRef.current;
      if (!input) return;
      input.value = nextValue;
      const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
      if (typeof pickerInput.showPicker === 'function') {
        pickerInput.showPicker();
      } else {
        input.focus();
        input.click();
      }
      return;
    }

    setShow(true);
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.timeButton, disabled && styles.fieldControlDisabled]}
        onPress={handlePress}
        activeOpacity={0.75}
        disabled={disabled}
      >
        <Text style={styles.timeButtonText}>{formatDisplayTime(date)}</Text>
        <Text style={styles.timeButtonChevron}>›</Text>
      </TouchableOpacity>

      {Platform.OS === 'web' && (
        <input
          ref={webInputRef}
          type="time"
          value={webValue}
          onChange={(event) => {
            const value = event.target.value;
            setWebValue(value);
            if (value) onChange(timeStringToDate(value));
          }}
          aria-label={label}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
      )}

      {/* iOS: bottom-sheet modal with spinner */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.pickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShow(false)} />
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeaderRow}>
                <Text style={styles.pickerTitle}>{label}</Text>
                <TouchableOpacity onPress={() => setShow(false)} style={styles.pickerDoneBtn}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={handleChange}
                style={styles.pickerSpinner}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default function ModalScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [wakeDate, setWakeDate] = useState<Date>(() => timeStringToDate('07:00'));
  const [windDownDate, setWindDownDate] = useState<Date>(() => timeStringToDate('22:30'));

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      setLoadingPrefs(true);
      try {
        const prefs: any = await apiService.getEmailReminderPreferences();
        if (!isMounted) return;
        setTimezone(prefs?.timezone || detectedTimezone);
        setWakeDate(timeStringToDate(prefs?.wake?.target_local_time || '07:00'));
        setWindDownDate(timeStringToDate(prefs?.wind_down?.target_local_time || '22:30'));
        setEnabled(Boolean(prefs?.wake?.enabled ?? prefs?.wind_down?.enabled ?? true));
      } catch (error) {
        if (!isMounted) return;
        console.warn('Failed to load reminder preferences:', error);
      } finally {
        if (isMounted) {
          setLoadingPrefs(false);
        }
      }
    };

    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [detectedTimezone]);

  const handleSaveReminderPreferences = async () => {
    setSavingPrefs(true);
    try {
      await apiService.updateEmailReminderPreferences({
        timezone,
        wake: { target_local_time: dateToTimeString(wakeDate), enabled },
        wind_down: { target_local_time: dateToTimeString(windDownDate), enabled },
      });
      Alert.alert('Saved', 'Daily email reminder preferences updated.');
    } catch (error) {
      console.error('Failed to save reminder preferences:', error);
      Alert.alert('Error', 'Could not save reminder preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.container}>
        <LinearGradient colors={['#FFFFFF', '#F8F9FC']} style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileTitle}>
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Account'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.primaryEmailAddress?.emailAddress ?? 'No email available'}
              </Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.signOutButton} activeOpacity={0.85} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Email Reminders</Text>
          <View style={styles.infoCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.infoCardTitle}>Enable reminders</Text>
                <Text style={styles.infoCardMeta}>Morning and evening survey emails</Text>
              </View>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>

            <TimeButton label="Wake-up time" date={wakeDate} onChange={setWakeDate} disabled={!enabled} />
            <TimeButton label="Wind-down time" date={windDownDate} onChange={setWindDownDate} disabled={!enabled} />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Timezone (IANA)</Text>
              <TextInput
                value={timezone}
                onChangeText={setTimezone}
                placeholder="America/New_York"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, !enabled && styles.fieldControlDisabled]}
                editable={enabled}
              />
              <TouchableOpacity
                style={[styles.secondaryButton, !enabled && styles.fieldControlDisabled]}
                activeOpacity={0.85}
                onPress={() => setTimezone(detectedTimezone)}
                disabled={!enabled}
              >
                <Text style={styles.secondaryButtonText}>Use device timezone ({detectedTimezone})</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (savingPrefs || loadingPrefs) && styles.primaryButtonDisabled]}
              activeOpacity={0.85}
              onPress={handleSaveReminderPreferences}
              disabled={savingPrefs || loadingPrefs}
            >
              <Text style={styles.primaryButtonText}>
                {loadingPrefs ? 'Loading...' : savingPrefs ? 'Saving...' : 'Save reminder preferences'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>How Clarity Works</Text>
          <Text style={styles.heroSubtitle}>
            Two quick daily check-ins help discover the habits that influence your sleep and next-day alertness.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Surveys</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Evening check-in</Text>
            <Text style={styles.infoCardMeta}>Before Bed • 4 questions</Text>
            <Text style={styles.infoCardBody}>
              Wind-down start, last meal timing, screens-off timing, and caffeine timing.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Morning check-in</Text>
            <Text style={styles.infoCardMeta}>After Wake • 2 questions</Text>
            <Text style={styles.infoCardBody}>
              Sleepiness level and morning sunlight timing.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Reminders</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardBody}>
              Email reminders are sent based on your configured wake-up and wind-down targets.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Insights</Text>
          <View style={styles.quoteCardWarm}>
            <Text style={styles.quoteText}>
              "Earlier screens-off nights are linked to feeling more alert the next morning."
            </Text>
          </View>
          <View style={styles.quoteCardCool}>
            <Text style={styles.quoteText}>
              "Morning sunlight within the first hour supports better daytime alertness."
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Setup</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardBody}>
              iOS: Add to Home Screen from Safari{'\n'}
              Android: Install from Chrome{'\n'}
              Desktop: Use Chrome or Edge
            </Text>
          </View>
        </View>

      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  screenContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 34,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 920,
  },
  profileCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileTitle: {
    color: '#111418',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  profileEmail: {
    color: '#707782',
    fontSize: 13,
    fontWeight: '500',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#DCE2EC',
    backgroundColor: '#EFF3FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#3E506B',
    fontSize: 24,
    fontWeight: '700',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#C25252',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heroBlock: {
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  heroTitle: {
    color: '#17191E',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.9,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#656D79',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#17191E',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 9,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7EAF0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
  },
  infoCardTitle: {
    color: '#1F232A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoCardMeta: {
    color: '#7A818D',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 7,
  },
  infoCardBody: {
    color: '#59606C',
    fontSize: 14,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  toggleTextWrap: {
    flex: 1,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#4E5561',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDE2EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111418',
    fontSize: 14,
    fontWeight: '500',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDE2EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldControlDisabled: {
    opacity: 0.5,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111418',
  },
  timeButtonChevron: {
    fontSize: 20,
    color: '#9AA3AF',
    fontWeight: '300',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17191E',
  },
  pickerDoneBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#304E43',
  },
  pickerSpinner: {
    width: '100%',
  },
  secondaryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DCE2EC',
    backgroundColor: '#F8FAFD',
  },
  secondaryButtonText: {
    color: '#4D5A6D',
    fontSize: 11,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#304E43',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  quoteCardWarm: {
    backgroundColor: '#FFF8EF',
    borderWidth: 1,
    borderColor: '#F2DFC7',
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
  },
  quoteCardCool: {
    backgroundColor: '#EEF9F4',
    borderWidth: 1,
    borderColor: '#CAECDC',
    borderRadius: 18,
    padding: 14,
  },
  quoteText: {
    color: '#505865',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  }
});
