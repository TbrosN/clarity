import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { apiService } from '../services/ApiService';

interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  clerk_user_id: string;
  created_at: string;
}

/**
 * Hook to fetch and manage current user data from the backend
 */
export function useCurrentUser() {
  const { isSignedIn, getToken } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      if (!isSignedIn) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Ensure token is set
        const token = await getToken();
        apiService.setAuthToken(token);
        
        // Fetch user from backend
        const userData = await apiService.getCurrentUser();
        setUser(userData as User);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [isSignedIn, getToken]);

  const updateUser = async (data: { first_name?: string; last_name?: string }) => {
    try {
      const updatedUser = await apiService.updateCurrentUser(data);
      setUser(updatedUser as User);
      return updatedUser;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    user,
    loading,
    error,
    updateUser,
  };
}
