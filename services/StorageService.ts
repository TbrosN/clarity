import AsyncStorage from '@react-native-async-storage/async-storage';

export type DailyLog = {
  date: string; // YYYY-MM-DD
  bedtime?: string; // ISO timestamp
  sugar?: 'clean' | 'treat';
  stress?: number; // 1 (Zen) - 5 (Fried)
  cleansed?: boolean;
  skinRating?: number; // 1 (Bad) - 5 (Glowing)
};

const STORAGE_KEY_PREFIX = '@clarity_log_';

export const saveDailyLog = async (log: DailyLog) => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${log.date}`;
    // Merge with existing
    const existing = await getDailyLog(log.date);
    const merged = { ...existing, ...log };
    await AsyncStorage.setItem(key, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Failed to save log', e);
  }
};

export const getDailyLog = async (date: string): Promise<DailyLog | null> => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${date}`;
    const json = await AsyncStorage.getItem(key);
    return json != null ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to fetch log', e);
    return null;
  }
};

export const getRecentLogs = async (days: number = 14): Promise<DailyLog[]> => {
  // This is inefficient but fine for MVP with minimal data
  try {
    const keys = await AsyncStorage.getAllKeys();
    const logKeys = keys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
    const stores = await AsyncStorage.multiGet(logKeys);

    const logs = stores.map(([key, value]) => {
      return value ? JSON.parse(value) : null;
    }).filter(log => log !== null) as DailyLog[];

    // Sort by date descending
    return logs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, days);
  } catch (e) {
    console.error('Failed to get recent logs', e);
    return [];
  }
}
