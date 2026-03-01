import { apiService } from './ApiService';

export type BaselineMetric = {
  metric: string;
  baseline: number;
  current_value: number | null;
  deviation: number | null;
  deviation_percentage: number | null;
  unit: string;
  interpretation: string | null;
};

export type BehaviorImpact = {
  behavior: string;
  behavior_label: string;
  outcome: string;
  outcome_label: string;
  when_good: number;
  when_poor: number;
  your_impact: number;
  sample_size_good: number;
  sample_size_poor: number;
  confidence: 'low' | 'medium' | 'high';
  recommendation: string | null;
};

export type PersonalBaselinesResponse = {
  baselines: BaselineMetric[];
  behavior_impacts: BehaviorImpact[];
  tracking_days: number;
  last_updated: string;
};

export const fetchPersonalBaselines = async (): Promise<PersonalBaselinesResponse | null> => {
  try {
    return await apiService.get<PersonalBaselinesResponse>('/baselines');
  } catch (error) {
    console.error('Failed to fetch personal baselines:', error);
    return null;
  }
};

export const getMetricLabel = (metric: string): string => {
  const labels: Record<string, string> = {
    sleepiness: 'Alertness',
    sleepTime: 'Wind-down Timing',
    screensOff: 'Screens Timing',
    caffeine: 'Caffeine Timing',
    lastMeal: 'Meal Timing',
    morningLight: 'Morning Light',
  };
  return labels[metric] || metric;
};

export const getMetricIcon = (metric: string): string => {
  const icons: Record<string, string> = {
    sleepiness: '👁️',
    sleepTime: '🌙',
    screensOff: '📱',
    caffeine: '☕',
    lastMeal: '🍽️',
    morningLight: '☀️',
  };
  return icons[metric] || '📊';
};

export const getBehaviorIcon = (behavior: string): string => {
  const icons: Record<string, string> = {
    sleepTime: '🌙',
    screensOff: '📱',
    caffeine: '☕',
    lastMeal: '🍽️',
    morningLight: '☀️',
  };
  return icons[behavior] || '📊';
};
