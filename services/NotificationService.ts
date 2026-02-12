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

  // Morning Wake Check (8:00 AM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "☀️ Good morning!",
      body: "How's your skin today?",
      data: { screen: 'check-in', type: 'acne' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 8,
      minute: 0,
      repeats: true,
    },
  });

  // Mid-Morning Energy Check (10:30 AM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⚡ Energy check",
      body: "How are you feeling?",
      data: { screen: 'check-in', type: 'energy' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 10,
      minute: 30,
      repeats: true,
    },
  });

  // Lunch Hydration Reminder (12:30 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "💧 Hydration check",
      body: "How much water have you had?",
      data: { screen: 'quick-report', type: 'water' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 12,
      minute: 30,
      repeats: true,
    },
  });

  // Afternoon Mood Check (3:00 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "😊 Mood check",
      body: "How are you feeling right now?",
      data: { screen: 'check-in', type: 'mood' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 15,
      minute: 0,
      repeats: true,
    },
  });

  // Evening Stress Check (6:00 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🧘‍♀️ Stress check",
      body: "How stressed are you feeling?",
      data: { screen: 'check-in', type: 'stress' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 18,
      minute: 0,
      repeats: true,
    },
  });

  // Evening Sugar Check (8:00 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🍪 Sugar intake",
      body: "How much sugar did you have today?",
      data: { screen: 'quick-report', type: 'sugar' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 20,
      minute: 0,
      repeats: true,
    },
  });

  // Bedtime Wind Down (9:30 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌙 Ready to recharge?",
      body: "Time to wind down for better skin tomorrow.",
      data: { screen: 'wind-down' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 21,
      minute: 30,
      repeats: true,
    },
  });

  console.log('Daily prompts scheduled - 7 check-ins throughout the day');
};
