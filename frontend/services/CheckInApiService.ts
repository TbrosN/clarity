import { apiService } from './ApiService';

export interface CheckIn {
  id: number;
  mood_score: number;
  energy_level: number;
  stress_level: number;
  notes?: string;
  check_in_type: 'morning' | 'evening' | 'quick';
  created_at: string;
}

export interface CheckInCreate {
  mood_score: number;
  energy_level: number;
  stress_level: number;
  notes?: string;
  check_in_type: 'morning' | 'evening' | 'quick';
}

export interface CheckInUpdate {
  mood_score?: number;
  energy_level?: number;
  stress_level?: number;
  notes?: string;
}

export interface CheckInStats {
  days: number;
  count: number;
  averages: {
    mood_score: number;
    energy_level: number;
    stress_level: number;
  } | null;
  message?: string;
}

/**
 * Service for managing check-in data with the backend API
 */
class CheckInApiService {
  /**
   * Create a new check-in
   */
  async createCheckIn(data: CheckInCreate): Promise<CheckIn> {
    return apiService.post<CheckIn>('/check-ins', data);
  }

  /**
   * Get user's check-in history
   */
  async getCheckIns(params?: {
    limit?: number;
    offset?: number;
    days?: number;
  }): Promise<CheckIn[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.days) queryParams.append('days', params.days.toString());
    
    const url = `/check-ins${queryParams.toString() ? `?${queryParams}` : ''}`;
    return apiService.get<CheckIn[]>(url);
  }

  /**
   * Get a specific check-in by ID
   */
  async getCheckIn(id: number): Promise<CheckIn> {
    return apiService.get<CheckIn>(`/check-ins/${id}`);
  }

  /**
   * Update a check-in
   */
  async updateCheckIn(id: number, data: CheckInUpdate): Promise<CheckIn> {
    return apiService.put<CheckIn>(`/check-ins/${id}`, data);
  }

  /**
   * Delete a check-in
   */
  async deleteCheckIn(id: number): Promise<void> {
    return apiService.delete(`/check-ins/${id}`);
  }

  /**
   * Get check-in statistics
   */
  async getStats(days: number = 7): Promise<CheckInStats> {
    return apiService.get<CheckInStats>(`/check-ins/stats/summary?days=${days}`);
  }
}

export const checkInApiService = new CheckInApiService();
export default checkInApiService;
