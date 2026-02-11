import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestPermissions = async () => {
  if (Platform.OS === 'web') {
    console.log('Push notifications are not fully supported on web PWA in this MVP phase without distinct service worker setup, but UI will simulate it.');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

export const scheduleDailyPrompts = async () => {
  if (Platform.OS === 'web') return;

  // Cancel all existing to avoid duplicates during dev
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Morning Glow Check (8:00 AM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "☀️ Morning Glow Check",
      body: "How is your skin feeling today?",
      data: { screen: 'check-in' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 8,
      minute: 0,
      repeats: true,
    },
  });

  // Evening Wind Down (9:30 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌙 Ready to recharge?",
      body: "Log your wind-down for better skin tomorrow.",
      data: { screen: 'wind-down' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 21,
      minute: 30,
      repeats: true,
    },
  });

  console.log('Daily prompts scheduled');
};
