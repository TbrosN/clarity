import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { saveDailyLog } from '../services/StorageService';
import QuickReport, { ReportOption } from '../components/QuickReport';

// Define check-in types
const CHECK_IN_TYPES = {
  acne: {
    title: "How is your skin right now? 🪞",
    subtitle: "Current breakout level",
    options: [
      { value: 1, emoji: "✨", label: "Clear" },
      { value: 2, emoji: "🙂", label: "Minor" },
      { value: 3, emoji: "😐", label: "Noticeable" },
      { value: 4, emoji: "😬", label: "Flaring" },
      { value: 5, emoji: "🚨", label: "Breakout" },
    ] as ReportOption[],
    field: 'acneLevel' as const,
  },
  stress: {
    title: "How stressed are you feeling? 🧘‍♀️",
    subtitle: "Current stress level",
    options: [
      { value: 1, emoji: "😌", label: "Zen" },
      { value: 2, emoji: "🙂", label: "Calm" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "😓", label: "Tense" },
      { value: 5, emoji: "🤯", label: "Frazzled" },
    ] as ReportOption[],
    field: 'stress' as const,
  },
  sleep: {
    title: "How was your sleep last night? 💤",
    subtitle: "Sleep quality",
    options: [
      { value: 1, emoji: "🥱", label: "Very poor" },
      { value: 2, emoji: "😴", label: "Poor" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "🙂", label: "Good" },
      { value: 5, emoji: "✨", label: "Great" },
    ] as ReportOption[],
    field: 'sleepQuality' as const,
  },
  touch: {
    title: "How were your hands-off habits today? 🖐️",
    subtitle: "Face touching / hygiene",
    options: [
      { value: 1, emoji: "🧼", label: "Excellent" },
      { value: 2, emoji: "👌", label: "Good" },
      { value: 3, emoji: "😐", label: "Mixed" },
      { value: 4, emoji: "😬", label: "Not great" },
      { value: 5, emoji: "🙈", label: "Constant touching" },
    ] as ReportOption[],
    field: 'touchHygiene' as const,
  },
  mood: {
    title: "How's your mood right now? 😊",
    subtitle: "Current mood",
    options: [
      { value: 1, emoji: "😞", label: "Low" },
      { value: 2, emoji: "🙁", label: "Down" },
      { value: 3, emoji: "😐", label: "Neutral" },
      { value: 4, emoji: "🙂", label: "Good" },
      { value: 5, emoji: "😄", label: "Great" },
    ] as ReportOption[],
    field: 'mood' as const,
  },
  energy: {
    title: "How is your energy right now? ⚡",
    subtitle: "Current energy level",
    options: [
      { value: 1, emoji: "🧟", label: "Exhausted" },
      { value: 2, emoji: "😴", label: "Low" },
      { value: 3, emoji: "😐", label: "Half tank" },
      { value: 4, emoji: "😊", label: "Good" },
      { value: 5, emoji: "⚡", label: "Fully energized" },
    ] as ReportOption[],
    field: 'energyLevel' as const,
  },
  // 🌞 Morning Commute (Wake Up) - Trigger: First phone open
  morningEnergy: {
    title: "Good Morning! How is your energy level right now? 🌞",
    subtitle: "Morning energy level",
    options: [
      { value: 1, emoji: "🧟", label: "Zombie" },
      { value: 2, emoji: "😴", label: "Low" },
      { value: 3, emoji: "😐", label: "Half tank" },
      { value: 4, emoji: "😊", label: "Good" },
      { value: 5, emoji: "⚡", label: "Fully Energized" },
    ] as ReportOption[],
    field: 'morningEnergy' as const,
  },
  morningSunlight: {
    title: "Have you seen sunlight yet? ☀️",
    subtitle: "Sunlight exposure",
    options: [
      { value: 1, emoji: "✨", label: "Yes" },
      { value: 2, emoji: "⏳", label: "No, check again in 15 mins" },
    ] as ReportOption[],
    field: 'morningSunlight' as const,
  },
  // 🚧 Mid-Day Hazard Check (1:00 PM - 3:00 PM)
  afternoonEnergy: {
    title: "How is your energy level right now? 🚧",
    subtitle: "The afternoon slump",
    options: [
      { value: 1, emoji: "😴", label: "I need a nap" },
      { value: 2, emoji: "🥱", label: "Dragging" },
      { value: 3, emoji: "😐", label: "Half tank" },
      { value: 4, emoji: "😊", label: "Still good" },
      { value: 5, emoji: "⚡", label: "Fully Energized" },
    ] as ReportOption[],
    field: 'afternoonEnergy' as const,
  },
  caffeineCurfew: {
    title: "Any caffeine this afternoon? ☕",
    subtitle: "The Caffeine Curfew - Sleep latency impact",
    options: [
      { value: 1, emoji: "✅", label: "No afternoon caffeine" },
      { value: 2, emoji: "☕", label: "Had afternoon caffeine" },
    ] as ReportOption[],
    field: 'caffeineCurfew' as const,
  },
  // 🌙 Evening Wind-Down (1 hour before target sleep)
  screenWindDown: {
    title: "When did screens go off? 🌙",
    subtitle: "The Blue Light Hazard - Evening routine",
    options: [
      { value: 1, emoji: "✨", label: "Just now" },
      { value: 2, emoji: "⏰", label: "1 hour ago" },
      { value: 3, emoji: "📱", label: "Still on" },
    ] as ReportOption[],
    field: 'screenWindDown' as const,
  },
  bedtimeDigestion: {
    title: "Are you hungry or full? 🍽️",
    subtitle: "Hunger levels",
    options: [
      { value: 1, emoji: "🍜", label: "Starving" },
      { value: 2, emoji: "🍽️", label: "A bit hungry" },
      { value: 3, emoji: "😐", label: "Neutral" },
      { value: 4, emoji: "🍽️", label: "A bit full" },
      { value: 5, emoji: "🍔", label: "Very full" },
    ] as ReportOption[],
    field: 'bedtimeDigestion' as const,
  },
};

export default function CheckInScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawType = params.type as string | undefined;
  const checkInType: keyof typeof CHECK_IN_TYPES =
    rawType && rawType in CHECK_IN_TYPES
      ? (rawType as keyof typeof CHECK_IN_TYPES)
      : 'morningEnergy';
  const config = CHECK_IN_TYPES[checkInType];
  const autoSubmit = params.autoSubmit ? parseInt(params.autoSubmit as string) : null;

  const handleSubmit = async (value: number) => {
    const today = new Date().toISOString().split('T')[0];
    await saveDailyLog({
      date: today,
      [config.field]: value
    });
  };

  // Auto-submit if value was provided from notification action
  useEffect(() => {
    if (autoSubmit !== null) {
      handleSubmit(autoSubmit).then(() => {
        setTimeout(() => {
          router.back();
        }, 600);
      });
    }
  }, [autoSubmit]);

  return (
    <QuickReport
      title={config.title}
      subtitle={config.subtitle}
      options={config.options}
      onSubmit={handleSubmit}
      layout="grid"
    />
  );
}
