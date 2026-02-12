import { getRecentLogs } from './StorageService';

export type Insight = {
  type: 'pattern' | 'streak' | 'tip';
  message: string;
  confidence?: 'low' | 'medium' | 'high';
  impact?: 'positive' | 'negative';
};

export const generateInsights = async (): Promise<Insight[]> => {
  const logs = await getRecentLogs(14);
  const insights: Insight[] = [];

  if (logs.length < 3) {
    return [{
      type: 'tip',
      message: 'Keep logging for 3+ days to unlock personalized insights!',
    }];
  }

  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  // 1. Sleep Quality → Acne Connection (2-day lag)
  let lateSleepBadSkin = 0;
  let lateSleepCount = 0;

  for (let i = 0; i < sortedLogs.length - 2; i++) {
    const log = sortedLogs[i];
    const targetDate = new Date(log.date);
    targetDate.setDate(targetDate.getDate() + 2);
    const targetDateString = targetDate.toISOString().split('T')[0];
    const outcomeLog = sortedLogs.find(l => l.date === targetDateString);

    if (log.bedtime && outcomeLog?.acneLevel) {
      const hour = new Date(log.bedtime).getHours();
      const isLate = hour >= 23 || hour < 4;

      if (isLate) {
        lateSleepCount++;
        if (outcomeLog.acneLevel >= 3) {
          lateSleepBadSkin++;
        }
      }
    }
  }

  if (lateSleepCount >= 2 && (lateSleepBadSkin / lateSleepCount) > 0.6) {
    insights.push({
      type: 'pattern',
      message: 'Late bedtimes (after 11 PM) are linked to breakouts 2 days later.',
      confidence: 'high',
      impact: 'negative'
    });
  }

  // 2. Sugar Intake → Acne Connection (1-2 day lag)
  let highSugarBadSkin = 0;
  let highSugarCount = 0;

  for (let i = 0; i < sortedLogs.length - 1; i++) {
    const log = sortedLogs[i];
    const nextDayLog = sortedLogs[i + 1];

    if (log.sugarIntake && log.sugarIntake >= 4 && nextDayLog?.acneLevel) {
      highSugarCount++;
      if (nextDayLog.acneLevel >= 3) {
        highSugarBadSkin++;
      }
    }
  }

  if (highSugarCount >= 2 && (highSugarBadSkin / highSugarCount) > 0.6) {
    insights.push({
      type: 'pattern',
      message: 'High sugar days are followed by worse skin the next day.',
      confidence: 'high',
      impact: 'negative'
    });
  }

  // 3. Stress → Acne Connection (same day or next day)
  let highStressBadSkin = 0;
  let highStressCount = 0;

  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    if (log.stress && log.stress >= 4) {
      highStressCount++;
      if (log.acneLevel && log.acneLevel >= 3) {
        highStressBadSkin++;
      }
    }
  }

  if (highStressCount >= 3 && (highStressBadSkin / highStressCount) > 0.5) {
    insights.push({
      type: 'pattern',
      message: 'High stress days correlate with more breakouts.',
      confidence: 'medium',
      impact: 'negative'
    });
  }

  // 4. Hydration → Skin Quality
  let goodHydrationGoodSkin = 0;
  let goodHydrationCount = 0;

  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    if (log.waterIntake && log.waterIntake >= 4) {
      goodHydrationCount++;
      if (log.acneLevel && log.acneLevel <= 2) {
        goodHydrationGoodSkin++;
      }
    }
  }

  if (goodHydrationCount >= 3 && (goodHydrationGoodSkin / goodHydrationCount) > 0.6) {
    insights.push({
      type: 'pattern',
      message: 'Good hydration days are linked to clearer skin!',
      confidence: 'medium',
      impact: 'positive'
    });
  }

  // 5. Late Meal Timing → Skin
  let lateMealBadSkin = 0;
  let lateMealCount = 0;

  for (let i = 0; i < sortedLogs.length - 1; i++) {
    const log = sortedLogs[i];
    const nextDayLog = sortedLogs[i + 1];

    if (log.lastMealTime) {
      const hour = new Date(log.lastMealTime).getHours();
      if (hour >= 21 || hour < 4) { // After 9 PM
        lateMealCount++;
        if (nextDayLog?.acneLevel && nextDayLog.acneLevel >= 3) {
          lateMealBadSkin++;
        }
      }
    }
  }

  if (lateMealCount >= 2 && (lateMealBadSkin / lateMealCount) > 0.6) {
    insights.push({
      type: 'pattern',
      message: 'Late meals (after 9 PM) may be affecting your skin.',
      confidence: 'medium',
      impact: 'negative'
    });
  }

  // 6. General Tips if no patterns found
  if (insights.length === 0) {
    insights.push({
      type: 'tip',
      message: 'Keep tracking! We need more data to find patterns specific to you.',
    });
  }

  return insights.slice(0, 3); // Return max 3 insights
};

export const calculateRiskScore = async (): Promise<{ level: 'Low' | 'Moderate' | 'Elevated', color: string }> => {
  const logs = await getRecentLogs(3); // Last 3 days
  let riskPoints = 0;

  logs.forEach(log => {
    // Sleep risk factors
    if (log.bedtime) {
      const hour = new Date(log.bedtime).getHours();
      if (hour >= 23 || hour < 4) riskPoints += 1.5; // Late sleep is a major factor
    }
    if (log.sleepQuality && log.sleepQuality <= 2) riskPoints += 1;

    // Diet risk factors
    if (log.sugarIntake && log.sugarIntake >= 4) riskPoints += 1;
    if (log.lastMealTime) {
      const hour = new Date(log.lastMealTime).getHours();
      if (hour >= 21 || hour < 4) riskPoints += 0.5; // Late meals
    }
    if (log.waterIntake && log.waterIntake <= 2) riskPoints += 0.5; // Dehydration

    // Stress risk factors
    if (log.stress && log.stress >= 4) riskPoints += 1;
    
    // Energy (low energy may indicate poor recovery)
    if (log.energyLevel && log.energyLevel <= 2) riskPoints += 0.5;

    // Legacy support
    if (log.sugar === 'treat') riskPoints += 1;
  });

  if (riskPoints >= 5) return { level: 'Elevated', color: '#E74C3C' };
  if (riskPoints >= 2) return { level: 'Moderate', color: '#F39C12' };
  return { level: 'Low', color: '#27AE60' };
};
