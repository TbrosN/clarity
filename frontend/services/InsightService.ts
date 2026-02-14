import { getRecentLogs } from './StorageService';
import { apiService } from './ApiService';

export type Insight = {
  type: 'pattern' | 'streak' | 'tip';
  message: string;
  confidence?: 'low' | 'medium' | 'high';
  impact?: 'positive' | 'negative';
};

export const generateInsights = async (): Promise<Insight[]> => {
  try {
    return await apiService.get<Insight[]>('/insights');
  } catch (error) {
    console.error('Failed to fetch insights from API:', error);
    return [{
      type: 'tip',
      message: 'Keep tracking for a few more days to unlock personalized insights.',
    }];
  }
};

export const calculateRiskScore = async (): Promise<{ level: 'Low' | 'Moderate' | 'Elevated', color: string }> => {
  const logs = await getRecentLogs(7);
  let riskPoints = 0;

  logs.forEach(log => {
    // Sleep and timing
    if (log.bedtime) {
      const hour = new Date(log.bedtime).getHours();
      if (hour >= 23 || hour < 4) riskPoints += 1.5;
    }
    if (log.screenWindDown && log.screenWindDown === 3) riskPoints += 0.5;
    if (log.sugarIntake && log.sugarIntake >= 4) riskPoints += 1;
    if (log.caffeineCurfew && log.caffeineCurfew === 2) riskPoints += 1;
    if (log.bedtimeDigestion && log.bedtimeDigestion >= 4) riskPoints += 0.5;
    if (log.lastMealTime) {
      const hour = new Date(log.lastMealTime).getHours();
      if (hour >= 21 || hour < 4) riskPoints += 0.5;
    }
    if (log.waterIntake && log.waterIntake <= 2) riskPoints += 0.5;

    // Outcome signals
    if (log.morningEnergy && log.morningEnergy <= 2) riskPoints += 1;
    if (log.afternoonEnergy && log.afternoonEnergy <= 2) riskPoints += 1;
  });
  if (riskPoints >= 8) return { level: 'Elevated', color: '#E74C3C' };
  if (riskPoints >= 4) return { level: 'Moderate', color: '#F39C12' };
  if (riskPoints >= 2) return { level: 'Moderate', color: '#F39C12' };
  return { level: 'Low', color: '#27AE60' };
};
