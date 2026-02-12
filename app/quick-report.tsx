import { useLocalSearchParams } from 'expo-router';
import { saveDailyLog } from '../services/StorageService';
import QuickReport, { ReportOption } from '../components/QuickReport';

// Additional report types for throughout-the-day check-ins
const REPORT_TYPES = {
  water: {
    title: "Hydration check 💧",
    subtitle: "How much water today?",
    options: [
      { value: 1, emoji: "🏜️", label: "None" },
      { value: 2, emoji: "💧", label: "A little" },
      { value: 3, emoji: "💦", label: "Some" },
      { value: 4, emoji: "🌊", label: "Good" },
      { value: 5, emoji: "🏊‍♀️", label: "Hydrated!" },
    ] as ReportOption[],
    field: 'waterIntake' as const,
    layout: 'horizontal' as const,
  },
  sugar: {
    title: "Sugar intake 🍪",
    subtitle: "How much sugar today?",
    options: [
      { value: 1, emoji: "🥗", label: "None" },
      { value: 2, emoji: "🍎", label: "Natural" },
      { value: 3, emoji: "😐", label: "A bit" },
      { value: 4, emoji: "🍰", label: "Moderate" },
      { value: 5, emoji: "🍭", label: "Lots" },
    ] as ReportOption[],
    field: 'sugarIntake' as const,
    layout: 'horizontal' as const,
  },
  meal: {
    title: "Last meal time 🍽️",
    subtitle: "When did you last eat?",
    options: [
      { value: 1, emoji: "🌅", label: "Morning" },
      { value: 2, emoji: "☀️", label: "Midday" },
      { value: 3, emoji: "🌤️", label: "Afternoon" },
      { value: 4, emoji: "🌆", label: "Evening" },
      { value: 5, emoji: "🌙", label: "Late night" },
    ] as ReportOption[],
    field: 'lastMealTime' as const,
    layout: 'horizontal' as const,
  },
};

export default function QuickReportScreen() {
  const params = useLocalSearchParams();
  const reportType = (params.type as keyof typeof REPORT_TYPES) || 'water';
  const config = REPORT_TYPES[reportType];

  const handleSubmit = async (value: number) => {
    const today = new Date().toISOString().split('T')[0];
    
    // For meal time, we also log the timestamp
    if (reportType === 'meal') {
      await saveDailyLog({ 
        date: today, 
        lastMealTime: new Date().toISOString()
      });
    } else {
      await saveDailyLog({ 
        date: today, 
        [config.field]: value 
      });
    }
  };

  return (
    <QuickReport
      title={config.title}
      subtitle={config.subtitle}
      options={config.options}
      onSubmit={handleSubmit}
      layout={config.layout}
    />
  );
}
