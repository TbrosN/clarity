import { apiService } from './ApiService';

export type DailyLog = {
  date: string; // YYYY-MM-DD

  // Before Bed survey fields
  sleepTime?: string; // "1hr" | "30mins" | "<30mins"
  lastMeal?: string; // "4" | "3" | "2" | "1"
  screensOff?: string; // "60" | "30-60" | "<30mins"
  caffeine?: string; // "before12" | "12-2pm" | "2-6pm" | "after6pm"

  // After Wake survey fields
  sleepiness?: number; // 1 (Extremely sleepy) - 5 (Very alert)
  morningLight?: string; // "0-30mins" | "30-60mins" | "none"

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

