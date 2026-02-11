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
      message: 'Log consistent sleep and skin ratings for 3 days to unlock insights!',
    }];
  }

  // 1. Analyze Sleep Impact
  // Filter days where Bedtime was logged
  // Compare Skin Rating of (Day + 2) vs Bedtime of (Day) ??
  // Simple Lag: Compare Skin Rating of Day X vs Bedtime of Day X-1 (Since sleep affects next day mostly, or day after?)
  // User Prompt said: "Sleep after 11:30pm -> acne rating 2 days later"

  let lateSleepBadSkin = 0;
  let lateSleepCount = 0;

  // Sort logs by date ascending to iterate easily
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < sortedLogs.length - 2; i++) {
    const log = sortedLogs[i];
    const targetDate = new Date(log.date);
    targetDate.setDate(targetDate.getDate() + 2);
    const targetDateString = targetDate.toISOString().split('T')[0];

    const outcomeLog = sortedLogs.find(l => l.date === targetDateString);

    if (log.bedtime && outcomeLog?.skinRating) {
      const hour = new Date(log.bedtime).getHours();
      const isLate = hour >= 23 || hour < 4; // After 11 PM or before 4 AM

      if (isLate) {
        lateSleepCount++;
        if (outcomeLog.skinRating <= 3) { // 1-3 is bad/mediocre
          lateSleepBadSkin++;
        }
      }
    }
  }

  if (lateSleepCount >= 2 && (lateSleepBadSkin / lateSleepCount) > 0.6) {
    insights.push({
      type: 'pattern',
      message: 'When you sleep after 11 PM, your skin rating drops 2 days later.',
      confidence: 'high',
      impact: 'negative'
    });
  }

  // 2. Sugar Impact (Same logic, 1-2 day lag)
  // ... (Simpler MVP logic usually enough)

  // 3. Simple Streak
  const today = new Date().toISOString().split('T')[0];
  const lastLog = sortedLogs[sortedLogs.length - 1];
  if (lastLog && lastLog.date === today) {
    // insights.push({ type: 'streak', message: 'You logged today! Keep it up.' });
  }

  return insights;
};

export const calculateRiskScore = async (): Promise<{ level: 'Low' | 'Moderate' | 'Elevated', color: string }> => {
  const logs = await getRecentLogs(2); // Yesterday and Today
  // Simple heuristic
  let riskPoints = 0;

  logs.forEach(log => {
    if (log.sugar === 'treat') riskPoints += 1;
    if (log.stress && log.stress > 3) riskPoints += 1;
    if (log.bedtime) {
      const hour = new Date(log.bedtime).getHours();
      if (hour >= 23 || hour < 4) riskPoints += 1;
    }
  });

  if (riskPoints >= 3) return { level: 'Elevated', color: '#E74C3C' };
  if (riskPoints >= 1) return { level: 'Moderate', color: '#F39C12' };
  return { level: 'Low', color: '#27AE60' };
};
