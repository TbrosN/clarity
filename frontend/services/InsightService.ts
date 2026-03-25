import { apiService } from './ApiService';

export type Insight = {
  type: 'pattern' | 'streak' | 'tip';
  message: string;
  confidence?: 'low' | 'medium' | 'high';
  impact?: 'positive' | 'negative';
  action?: string | null;
  citations?: InsightCitation[] | null;
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

const normalizeInsight = (value: Insight): Insight => ({
  ...value,
  citations: Array.isArray(value.citations) ? value.citations : [],
  source_metric_keys: Array.isArray(value.source_metric_keys) ? value.source_metric_keys : [],
});

const normalizeInsights = (payload: unknown): Insight[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isInsight).map(normalizeInsight);
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.insights)) {
      return obj.insights.filter(isInsight).map(normalizeInsight);
    }
    if (Array.isArray(obj.data)) {
      return obj.data.filter(isInsight).map(normalizeInsight);
    }
  }

  return [];
};

const REMOTE_INSIGHTS_ENABLED = false;

const BASIC_TIPS: Insight[] = [
  {
    type: 'tip',
    confidence: 'high',
    impact: 'positive',
    message:
      'Last meal 4+ hours before bed. Why it matters: giving digestion more runway before sleep can lower evening arousal and reduce overnight wake-ups, helping steadier next-day energy.',
  },
  {
    type: 'tip',
    confidence: 'high',
    impact: 'positive',
    message:
      'Screens off and begin wind-down 1+ hours before bed. Why it matters: reducing bright light and stimulation before sleep can help melatonin rise and often cuts sleep-onset time by about 10-30 minutes.',
  },
  {
    type: 'tip',
    confidence: 'high',
    impact: 'positive',
    message:
      'End caffeine before 12 PM. Why it matters: caffeine can linger for 5-8+ hours, so earlier cutoffs usually mean less bedtime stimulation and better sleep depth.',
  },
  {
    type: 'tip',
    confidence: 'high',
    impact: 'positive',
    message:
      'Get morning light within 30 minutes of waking. Why it matters: early daylight anchors your circadian clock and is linked to better daytime alertness and easier nighttime sleep onset.',
  },
];

const pickBasicTip = (): Insight => {
  const index = Math.floor(Math.random() * BASIC_TIPS.length);
  const selected = BASIC_TIPS[index] ?? BASIC_TIPS[0];
  return { ...selected, citations: [], source_metric_keys: [] };
};

const generateInsightsFromApi = async (): Promise<Insight[]> => {
  try {
    const payload = await apiService.get<unknown>('/insights');
    const normalized = normalizeInsights(payload);
    if (normalized.length > 0) {
      return normalized;
    }
  } catch (error) {
    console.error('Failed to fetch insights from API:', error);
  }

  return [];
};

export const generateInsights = async (): Promise<Insight[]> => {
  if (REMOTE_INSIGHTS_ENABLED) {
    const apiInsights = await generateInsightsFromApi();
    if (apiInsights.length > 0) {
      return apiInsights;
    }
  }

  return [pickBasicTip()];
};

export const calculateEnergyLevel = async (): Promise<{ percentage: number, color: string }> => {
  try {
    return await apiService.get<{ percentage: number; color: string }>('/energy-efficiency');
  } catch (error) {
    console.error('Failed to fetch energy efficiency from API:', error);
    return { percentage: 50, color: '#F39C12' };
  }
};
