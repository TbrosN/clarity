import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Set authentication token for all requests
   */
  setAuthToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  /**
   * Generic GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  // User endpoints
  async getCurrentUser() {
    return this.get('/users/me');
  }

  async updateCurrentUser(data: { first_name?: string; last_name?: string }) {
    return this.put('/users/me', data);
  }

  // Email reminder preferences
  async getEmailReminderPreferences() {
    return this.get('/preferences/email-reminders');
  }

  async updateEmailReminderPreferences(data: {
    timezone?: string;
    wake?: { target_local_time?: string; enabled?: boolean };
    wind_down?: { target_local_time?: string; enabled?: boolean };
  }) {
    return this.put('/preferences/email-reminders', data);
  }

  async updateTimezone(timezone: string) {
    return this.post('/preferences/timezone', { timezone });
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }

  async databaseHealthCheck() {
    return this.get('/health/db');
  }
}

export const apiService = new ApiService();
export default apiService;
