import { apiService } from './ApiService';

export type DailyLog = {
  date: string; // YYYY-MM-DD
  
  // Sleep tracking
  wakeTime?: string; // ISO timestamp
  bedtime?: string; // ISO timestamp
  sleepQuality?: number; // 1-5 Likert scale
  
  // Mood & Stress
  stress?: number; // 1 (Very calm) - 5 (Very stressed)
  
  // Before Bed Survey fields
  plannedSleepTime?: string; // Time string (HH:mm)
  lastMeal?: string; // "3+hours" | "2-3hours" | "1-2hours" | "<1hour" | "justAte"
  screensOff?: string; // "2+hours" | "1-2hours" | "30-60min" | "<30min" | "stillUsing"
  caffeine?: string; // "none" | "before12" | "12-2pm" | "2-6pm" | "after6pm"
  
  // After Wake Survey fields
  actualSleepTime?: string; // Time string (HH:mm)
  snooze?: string; // "noAlarm" | "no" | "1-2times" | "3+times"
  energy?: number; // 1 (None) - 5 (Very high)
  sleepiness?: number; // 1 (Extremely sleepy) - 5 (Very alert)
  
  [key: string]: string | number | boolean | undefined;
};


export const saveDailyLog = async (log: DailyLog) => {
  try {
    await apiService.post('/logs/upsert', log);
    return log;
  } catch (e) {
    console.error('Failed to save log', e);
  }
};
type BackendResponseEntry = {
  id: number;
  value: string | number | boolean;
};

type BackendLog = {
  date: string;
  responses: Record<string, BackendResponseEntry>;
};

const mapBackendLogToDailyLog = (log: BackendLog): DailyLog => {
  const mapped: DailyLog = { date: log.date };
  Object.entries(log.responses).forEach(([key, entry]) => {
    mapped[key] = entry.value;
  });
  return mapped;
};

export const getDailyLog = async (date: string): Promise<DailyLog | null> => {
  try {
    const response = await apiService.get<{ log: BackendLog | null }>(`/logs/${date}`);
    return response.log ? mapBackendLogToDailyLog(response.log) : null;
  } catch (e) {
    console.error('Failed to fetch log', e);
    return null;
  }
};

export const getRecentLogs = async (days: number = 14): Promise<DailyLog[]> => {
  try {
    const response = await apiService.get<{ logs: BackendLog[] }>(`/logs/history?days=${days}`);
    return response.logs.map(mapBackendLogToDailyLog);
  } catch (e) {
    console.error('Failed to get recent logs', e);
    return [];
  }
}


export const getHasAddedToHomeScreen = async (): Promise<boolean> => {
  try {
    // Only check if running in standalone mode (PWA installed)
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to check home screen status', e);
    return false;
  }
};

