import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';

export default function ModalScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
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

        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>How Clarity Works</Text>
          <Text style={styles.heroSubtitle}>
            Two quick daily check-ins help discover the habits that influence your sleep and next-day energy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Surveys</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Evening check-in</Text>
            <Text style={styles.infoCardMeta}>Before Bed • 5 questions</Text>
            <Text style={styles.infoCardBody}>
              Planned sleep time, last meal timing, screens before bed, caffeine intake, and stress levels.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Morning check-in</Text>
            <Text style={styles.infoCardMeta}>After Wake • 6 questions</Text>
            <Text style={styles.infoCardBody}>
              Actual sleep, wake time, snooze behavior, sleep quality, energy, and sleepiness.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Notifications</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardBody}>
              Morning reminder at 8:00 AM for your wake survey and evening reminder at 11:00 PM for your bedtime survey.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Insights</Text>
          <View style={styles.quoteCardWarm}>
            <Text style={styles.quoteText}>
              "Late bedtimes after 11 PM are linked to lower energy two days later."
            </Text>
          </View>
          <View style={styles.quoteCardCool}>
            <Text style={styles.quoteText}>
              "Turning screens off earlier improves your sleep quality trend."
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
