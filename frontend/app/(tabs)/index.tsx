import { calculateEnergyLevel, generateInsights, Insight } from '@/services/InsightService';
import { DailyLog, getDailyLog } from '@/services/StorageService';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [energyLevel, setEnergyLevel] = useState<{ percentage: number, color: string }>({ percentage: 100, color: '#27AE60' });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [beforeBedComplete, setBeforeBedComplete] = useState(false);
  const [afterWakeComplete, setAfterWakeComplete] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    const log = await getDailyLog(today);
    setTodayLog(log);

    // Check survey completion
    // Before bed survey is complete if we have: planned sleep time, last meal, screens off, caffeine, and stress
    const beforeBedFields = [
      log?.plannedSleepTime,
      log?.lastMeal,
      log?.screensOff,
      log?.caffeine,
      log?.stress
    ];
    setBeforeBedComplete(beforeBedFields.every(field => field !== null && field !== undefined));

    // After wake survey is complete if we have: actual sleep time, wake time, snooze, sleep quality, energy, sleepiness
    const afterWakeFields = [
      log?.actualSleepTime,
      log?.wakeTime,
      log?.snooze,
      log?.sleepQuality,
      log?.energy,
      log?.sleepiness
    ];
    setAfterWakeComplete(afterWakeFields.every(field => field !== null && field !== undefined));

    // Energy Level
    const level = await calculateEnergyLevel();
    setEnergyLevel(level);

    // Insights
    const generated = await generateInsights();
    setInsights(Array.isArray(generated) ? generated : []);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-[#F7F7F7]"
      contentContainerStyle={{ padding: 20, paddingTop: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View className="mb-8">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-gray-500 text-lg font-medium">Today's Focus</Text>
            <Text className="text-4xl font-bold text-[#2C3E50]">Clarity</Text>
          </View>
          <Link href="/modal" asChild>
            <TouchableOpacity className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
              <Text className="text-lg">💡</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Quick Stats */}
        <View className="mt-4 flex-row items-center">
          <Text className="text-gray-500 text-sm">
            {[beforeBedComplete, afterWakeComplete].filter(Boolean).length} of 2 surveys completed today ✓
          </Text>
        </View>
      </View>

      {/* Energy Efficiency */}
      <View className="bg-white p-6 rounded-3xl shadow-sm mb-6 border border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-400 font-medium uppercase text-xs tracking-wider">Energy Efficiency</Text>
          <Text className="text-2xl">🔋</Text>
        </View>

        {/* Percentage Display */}
        <Text className="text-5xl font-bold mb-2" style={{ color: energyLevel.color }}>
          {energyLevel.percentage}%
        </Text>

        {/* Battery Bar */}
        <View className="bg-gray-100 h-3 rounded-full overflow-hidden mb-3">
          <View
            className="h-full rounded-full"
            style={{
              width: `${energyLevel.percentage}%`,
              backgroundColor: energyLevel.color
            }}
          />
        </View>

        <Text className="text-gray-400 text-sm">Based on your sleep habits and daily patterns.</Text>
      </View>

      {/* Daily Surveys */}
      <View className="mb-6">
        <Text className="text-gray-800 font-bold text-xl mb-4">Daily Surveys</Text>

        {/* Before Bed Survey */}
        <TouchableOpacity
          className="bg-white p-6 rounded-3xl shadow-sm mb-4 border border-gray-100"
          onPress={() => router.push('/survey?type=beforeBed')}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Text className="text-3xl mr-3">🌙</Text>
                <Text className="text-gray-800 font-bold text-lg">Before Bed</Text>
              </View>
              <Text className="text-gray-500 text-sm mb-1">5 quick questions about your evening</Text>
              <Text className="text-gray-400 text-xs">Sleep time · Meals · Screens · Caffeine · Stress</Text>
            </View>
            <View className={`w-12 h-12 rounded-full items-center justify-center ${beforeBedComplete ? 'bg-green-100' : 'bg-gray-50'}`}>
              <Text className="text-xl">{beforeBedComplete ? '✓' : '→'}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* After Wake Survey */}
        <TouchableOpacity
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
          onPress={() => router.push('/survey?type=afterWake')}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Text className="text-3xl mr-3">☀️</Text>
                <Text className="text-gray-800 font-bold text-lg">After Wake-Up</Text>
              </View>
              <Text className="text-gray-500 text-sm mb-1">6 questions about your sleep & morning</Text>
              <Text className="text-gray-400 text-xs">Sleep time · Wake time · Sleep quality · Energy</Text>
            </View>
            <View className={`w-12 h-12 rounded-full items-center justify-center ${afterWakeComplete ? 'bg-green-100' : 'bg-gray-50'}`}>
              <Text className="text-xl">{afterWakeComplete ? '✓' : '→'}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Insights */}
      {insights.length > 0 && (
        <View className="mb-6">
          <Text className="text-[#2C3E50] font-bold text-xl mb-4">Insights</Text>
          {insights.map((insight, index) => (
            <View key={index} className="bg-[#FFF5EB] p-5 rounded-2xl mb-3 border border-[#FFDCC2]">
              <View className="flex-row items-center mb-2">
                <Text className="text-xl mr-2">{insight.type === 'pattern' ? '💡' : '📈'}</Text>
                <Text className="font-bold text-brand-primary uppercase text-xs tracking-wider">
                  {insight.impact === 'negative' ? 'Pattern Detected' : 'Tip'}
                </Text>
              </View>
              <Text className="text-[#2C3E50] text-lg leading-6">{insight.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* History Link (Placeholder for Tab 2) */}
      <Link href="/(tabs)/two" asChild>
        <TouchableOpacity className="mt-4 items-center">
          <Text className="text-brand-dark font-medium opacity-50">View History</Text>
        </TouchableOpacity>
      </Link>

    </ScrollView>
  );
}
