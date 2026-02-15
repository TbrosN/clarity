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

export const calculateEnergyLevel = async (): Promise<{ percentage: number, color: string }> => {
  const logs = await getRecentLogs(7);
  
  if (logs.length === 0) {
    return { percentage: 50, color: '#F39C12' };
  }

  let totalPoints = 0;
  const maxPointsPerDay = 8.5; // Maximum possible points per day

  logs.forEach(log => {
    let dayPoints = 0;
    
    // Sleep quality (0-2 points)
    if (log.sleepQuality) {
      dayPoints += (log.sleepQuality - 1) * 0.5; // 1->0, 2->0.5, 3->1, 4->1.5, 5->2
    }
    
    // Energy level (0-1.5 points)
    if (log.energy) {
      dayPoints += (log.energy - 1) * 0.375; // 1->0, 5->1.5
    }
    
    // Alertness/sleepiness (0-1 point)
    if (log.sleepiness) {
      dayPoints += (log.sleepiness - 1) * 0.25; // 1->0, 5->1
    }
    
    // Screen time management (0-1 point)
    if (log.screensOff) {
      const screenPoints = {
        '2+hours': 1,
        '1-2hours': 0.75,
        '30-60min': 0.5,
        '<30min': 0.25,
        'stillUsing': 0
      };
      dayPoints += screenPoints[log.screensOff as keyof typeof screenPoints] || 0;
    }
    
    // Caffeine timing (0-1 point)
    if (log.caffeine) {
      const caffeinePoints = {
        'none': 1,
        'before12': 0.8,
        '12-2pm': 0.5,
        '2-6pm': 0.2,
        'after6pm': 0
      };
      dayPoints += caffeinePoints[log.caffeine as keyof typeof caffeinePoints] || 0;
    }
    
    // Meal timing before bed (0-0.5 points)
    if (log.lastMeal) {
      const mealPoints = {
        '3+hours': 0.5,
        '2-3hours': 0.4,
        '1-2hours': 0.2,
        '<1hour': 0.1,
        'justAte': 0
      };
      dayPoints += mealPoints[log.lastMeal as keyof typeof mealPoints] || 0;
    }
    
    // Stress level (0-1 point, inverted)
    if (log.stress) {
      dayPoints += (5 - log.stress) * 0.25; // 1(calm)->1, 5(stressed)->0
    }
    
    // Snooze behavior (0-0.5 points)
    if (log.snooze) {
      const snoozePoints = {
        'noAlarm': 0.5,
        'no': 0.5,
        '1-2times': 0.25,
        '3+times': 0
      };
      dayPoints += snoozePoints[log.snooze as keyof typeof snoozePoints] || 0;
    }
    
    totalPoints += dayPoints;
  });

  // Calculate average percentage
  const avgPoints = totalPoints / logs.length;
  const percentage = Math.round((avgPoints / maxPointsPerDay) * 100);
  
  // Determine color based on percentage
  let color: string;
  if (percentage >= 75) {
    color = '#27AE60'; // Green
  } else if (percentage >= 50) {
    color = '#F39C12'; // Orange
  } else if (percentage >= 25) {
    color = '#E67E22'; // Dark orange
  } else {
    color = '#E74C3C'; // Red
  }
  
  return { percentage: Math.max(0, Math.min(100, percentage)), color };
};
