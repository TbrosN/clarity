import { apiService } from './ApiService';

export type Insight = {
  type: 'pattern' | 'streak' | 'tip';
  message: string;
  confidence?: 'low' | 'medium' | 'high';
  impact?: 'positive' | 'negative';
  action?: string | null;
  citations?: InsightCitation[];
  source_metric_keys?: string[];
};

export type InsightCitation = {
  fact_id: string;
  label: string;
  value: number | string;
  unit?: string | null;
  window_days: number;
  sample_size?: number | null;
  n_good?: number | null;
  n_poor?: number | null;
  method: string;
  provenance: string;
  source_metric_keys: string[];
};

const isInsight = (value: unknown): value is Insight => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Insight>;
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.message === 'string'
  );
};

const normalizeInsights = (payload: unknown): Insight[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isInsight);
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.insights)) {
      return obj.insights.filter(isInsight);
    }
    if (Array.isArray(obj.data)) {
      return obj.data.filter(isInsight);
    }
  }

  return [];
};

export const generateInsights = async (): Promise<Insight[]> => {
  try {
    const payload = await apiService.get<unknown>('/insights');
    const normalized = normalizeInsights(payload);
    if (normalized.length > 0) {
      return normalized;
    }
  } catch (error) {
    console.error('Failed to fetch insights from API:', error);
  }

  return [{
    type: 'tip',
    message: 'Keep tracking for a few more days to unlock personalized insights.',
  }];
};

export const calculateEnergyLevel = async (): Promise<{ percentage: number, color: string }> => {
  try {
    return await apiService.get<{ percentage: number; color: string }>('/energy-efficiency');
  } catch (error) {
    console.error('Failed to fetch energy efficiency from API:', error);
    return { percentage: 50, color: '#F39C12' };
  }
};
