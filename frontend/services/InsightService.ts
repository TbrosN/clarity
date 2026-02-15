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
  try {
    return await apiService.get<{ percentage: number; color: string }>('/energy-efficiency');
  } catch (error) {
    console.error('Failed to fetch energy efficiency from API:', error);
    return { percentage: 50, color: '#F39C12' };
  }
};
