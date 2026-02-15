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

  // Morning Survey (8:00 AM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "☀️ Good morning!",
      body: "How did you sleep? Complete your morning survey",
      data: { screen: 'survey', type: 'afterWake' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 8,
      minute: 0,
      repeats: true,
    },
  });

  // Evening Survey (11:00 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌙 Before Bed Check-In",
      body: "Time for your evening survey - 5 quick questions",
      data: { screen: 'survey', type: 'beforeBed' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 23,
      minute: 0,
      repeats: true,
    },
  });

  console.log('Daily survey notifications scheduled - 8am & 11pm');
};

export const getScheduledNotifications = async () => {
  if (Platform.OS === 'web') return [];
  
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled;
};
