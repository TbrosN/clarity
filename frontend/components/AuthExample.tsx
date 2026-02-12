import React, { useState, useEffect } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { checkInApiService, CheckInCreate } from '@/services/CheckInApiService';

/**
 * Example component showing how to use Clerk authentication
 * and interact with the FastAPI backend
 */
export function AuthExample() {
  return <AuthenticatedView />;
}

/**
 * Shown when user is not signed in
 */
function SignInPrompt() {
  return (
    <View className="flex-1 p-5 justify-center items-center">
      <Text className="text-2xl font-bold mb-2">Welcome to Clarity</Text>
      <Text className="text-base text-gray-600 mb-5">Please sign in to continue</Text>
      {/* 
        For web PWA, you would add sign-in buttons here
        that redirect to Clerk's hosted pages or use Clerk UI components
      */}
      <Text className="text-xs text-gray-400 mt-5 text-center">
        Configure Clerk sign-in UI in your Clerk dashboard
      </Text>
    </View>
  );
}

/**
 * Shown when user is signed in
 */
function AuthenticatedView() {
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { user: dbUser, loading, error } = useCurrentUser();
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Fetch user stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const data = await checkInApiService.getStats(7);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const createSampleCheckIn = async () => {
    try {
      const checkIn: CheckInCreate = {
        mood_score: 7,
        energy_level: 6,
        stress_level: 4,
        notes: 'Sample check-in from app',
        check_in_type: 'quick',
      };
      
      await checkInApiService.createCheckIn(checkIn);
      alert('Check-in created successfully!');
      
      // Refresh stats
      await fetchStats();
    } catch (err) {
      console.error('Failed to create check-in:', err);
      alert('Failed to create check-in');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 p-5 justify-center items-center">
        <ActivityIndicator size="large" />
        <Text>Loading user data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 p-5 justify-center items-center">
        <Text className="text-red-600 text-lg font-bold mb-2">Error loading user data</Text>
        <Text>{error.message}</Text>
        <Button title="Try Again" onPress={() => window.location.reload()} />
      </View>
    );
  }

  return (
    <View className="flex-1 p-5 justify-center items-center">
      <Text className="text-2xl font-bold mb-2">Welcome, {clerkUser?.firstName || 'User'}!</Text>
      
      <View className="w-full my-2 p-4 bg-gray-100 rounded-lg">
        <Text className="text-lg font-bold mb-2">Clerk User Info</Text>
        <Text>Email: {clerkUser?.primaryEmailAddress?.emailAddress}</Text>
        <Text>User ID: {clerkUser?.id}</Text>
      </View>

      <View className="w-full my-2 p-4 bg-gray-100 rounded-lg">
        <Text className="text-lg font-bold mb-2">Database User Info</Text>
        {dbUser && (
          <>
            <Text>DB ID: {dbUser.id}</Text>
            <Text>Email: {dbUser.email}</Text>
            <Text>Name: {dbUser.first_name} {dbUser.last_name}</Text>
          </>
        )}
      </View>

      <View className="w-full my-2 p-4 bg-gray-100 rounded-lg">
        <Text className="text-lg font-bold mb-2">Check-in Stats (Last 7 Days)</Text>
        {loadingStats ? (
          <ActivityIndicator />
        ) : stats ? (
          <>
            <Text>Total Check-ins: {stats.count}</Text>
            {stats.averages && (
              <>
                <Text>Avg Mood: {stats.averages.mood_score}/10</Text>
                <Text>Avg Energy: {stats.averages.energy_level}/10</Text>
                <Text>Avg Stress: {stats.averages.stress_level}/10</Text>
              </>
            )}
          </>
        ) : (
          <Text>No stats available</Text>
        )}
        <Button title="Refresh Stats" onPress={fetchStats} />
      </View>

      <View className="w-full my-2 p-4 bg-gray-100 rounded-lg">
        <Button title="Create Sample Check-in" onPress={createSampleCheckIn} />
      </View>

      <View className="w-full my-2 p-4 bg-gray-100 rounded-lg">
        <Button title="Sign Out" onPress={() => signOut()} color="#dc2626" />
      </View>
    </View>
  );
}
