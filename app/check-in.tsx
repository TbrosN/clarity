import { useLocalSearchParams } from 'expo-router';
import { saveDailyLog } from '../services/StorageService';
import QuickReport, { ReportOption } from '../components/QuickReport';

// Define different check-in types
const CHECK_IN_TYPES = {
  acne: {
    title: "How's your skin? 🪞",
    subtitle: "Quick check-in",
    options: [
      { value: 1, emoji: "✨", label: "Clear" },
      { value: 2, emoji: "🌤️", label: "Good" },
      { value: 3, emoji: "😐", label: "Few spots" },
      { value: 4, emoji: "☁️", label: "Breaking out" },
      { value: 5, emoji: "🚨", label: "Major breakout" },
    ] as ReportOption[],
    field: 'acneLevel' as const,
  },
  mood: {
    title: "How are you feeling? 😊",
    subtitle: "Check in with yourself",
    options: [
      { value: 1, emoji: "😔", label: "Low" },
      { value: 2, emoji: "😕", label: "Meh" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "😊", label: "Good" },
      { value: 5, emoji: "🤩", label: "Great" },
    ] as ReportOption[],
    field: 'mood' as const,
  },
  energy: {
    title: "What's your energy? ⚡",
    subtitle: "How are you feeling right now?",
    options: [
      { value: 1, emoji: "🪫", label: "Drained" },
      { value: 2, emoji: "😴", label: "Tired" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "🙂", label: "Good" },
      { value: 5, emoji: "⚡", label: "Energized" },
    ] as ReportOption[],
    field: 'energyLevel' as const,
  },
  stress: {
    title: "Stress check 🧘‍♀️",
    subtitle: "How stressed do you feel?",
    options: [
      { value: 1, emoji: "🧘‍♀️", label: "Zen" },
      { value: 2, emoji: "😌", label: "Calm" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "😰", label: "Stressed" },
      { value: 5, emoji: "🤯", label: "Frazzled" },
    ] as ReportOption[],
    field: 'stress' as const,
  },
  sleep: {
    title: "How did you sleep? 💤",
    subtitle: "Sleep quality check",
    options: [
      { value: 1, emoji: "😫", label: "Awful" },
      { value: 2, emoji: "😴", label: "Poor" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "😊", label: "Good" },
      { value: 5, emoji: "✨", label: "Amazing" },
    ] as ReportOption[],
    field: 'sleepQuality' as const,
  },
};

export default function CheckInScreen() {
  const params = useLocalSearchParams();
  const checkInType = (params.type as keyof typeof CHECK_IN_TYPES) || 'acne';
  const config = CHECK_IN_TYPES[checkInType];

  const handleSubmit = async (value: number) => {
    const today = new Date().toISOString().split('T')[0];
    await saveDailyLog({ 
      date: today, 
      [config.field]: value 
    });
  };

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
