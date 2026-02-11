import { calculateRiskScore, generateInsights, Insight } from '@/services/InsightService';
import { DailyLog, getDailyLog } from '@/services/StorageService';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [risk, setRisk] = useState<{ level: string, color: string }>({ level: 'Low', color: '#27AE60' });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    const log = await getDailyLog(today);
    setTodayLog(log);

    // Risk Score
    const riskScore = await calculateRiskScore();
    setRisk(riskScore);

    // Insights
    const generated = await generateInsights();
    setInsights(generated);
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
        <Text className="text-gray-500 text-lg font-medium">Today's Focus</Text>
        <Text className="text-4xl font-bold text-[#2C3E50]">Clarity</Text>
      </View>

      {/* Risk Meter */}
      <View className="bg-white p-6 rounded-3xl shadow-sm mb-6 border border-gray-100">
        <Text className="text-gray-400 font-medium mb-1 uppercase text-xs tracking-wider">Breakout Risk</Text>
        <Text className="text-3xl font-bold" style={{ color: risk.color }}>{risk.level}</Text>
        <Text className="text-gray-400 text-sm mt-2">Based on your recent sleep and stress.</Text>
      </View>

      {/* Daily Actions */}
      <View className="flex-row gap-4 mb-8">
        {/* Morning Check-in */}
        <TouchableOpacity
          className={`flex-1 p-5 rounded-3xl justify-between h-40 ${todayLog?.skinRating ? 'bg-[#E8F8F5]' : 'bg-white shadow-sm'}`}
          onPress={() => router.push('/check-in')}
          disabled={!!todayLog?.skinRating}
        >
          <View>
            <Text className="text-2xl mb-1">☀️</Text>
            <Text className="font-bold text-[#2C3E50] text-lg">Morning Check</Text>
          </View>
          <Text className="text-gray-500 font-medium">
            {todayLog?.skinRating ? 'Completed' : 'Tap to Log'}
          </Text>
        </TouchableOpacity>

        {/* Evening Wind-down */}
        <TouchableOpacity
          className={`flex-1 p-5 rounded-3xl justify-between h-40 ${todayLog?.bedtime ? 'bg-[#EBDEF0]' : 'bg-white shadow-sm'}`}
          onPress={() => router.push('/wind-down')}
          disabled={!!todayLog?.bedtime}
        >
          <View>
            <Text className="text-2xl mb-1">🌙</Text>
            <Text className="font-bold text-[#2C3E50] text-lg">Wind Down</Text>
          </View>
          <Text className="text-gray-500 font-medium">
            {todayLog?.bedtime ? 'Completed' : 'Tap to Log'}
          </Text>
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
