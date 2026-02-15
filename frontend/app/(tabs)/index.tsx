import { generateInsights, Insight } from '@/services/InsightService';
import { fetchPersonalBaselines, PersonalBaselinesResponse, getMetricIcon, getMetricLabel } from '@/services/BaselineService';
import { DailyLog, getDailyLog } from '@/services/StorageService';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [baselines, setBaselines] = useState<PersonalBaselinesResponse | null>(null);
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

    // Insights
    const generated = await generateInsights();
    setInsights(Array.isArray(generated) ? generated : []);

    // Baselines
    const baselinesData = await fetchPersonalBaselines();
    setBaselines(baselinesData);
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

  const getDeviationColor = (deviationPct: number | null, metricType: string): string => {
    if (!deviationPct) return '#9CA3AF';
    
    // For stress, positive deviation is bad
    const isStress = metricType === 'stress';
    const effectiveDeviation = isStress ? -deviationPct : deviationPct;
    
    if (effectiveDeviation >= 10) return '#10B981'; // Green - significantly better
    if (effectiveDeviation >= 5) return '#34D399'; // Light green - better
    if (effectiveDeviation <= -10) return '#EF4444'; // Red - significantly worse
    if (effectiveDeviation <= -5) return '#F87171'; // Light red - worse
    return '#9CA3AF'; // Gray - neutral
  };

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
          <View className="flex-row gap-2">
            <Link href="/modal" asChild>
              <TouchableOpacity className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
                <Text className="text-lg">💡</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Quick Stats */}
        <View className="mt-4 flex-row items-center">
          <Text className="text-gray-500 text-sm">
            {[beforeBedComplete, afterWakeComplete].filter(Boolean).length} of 2 surveys completed today ✓
          </Text>
        </View>
      </View>

      {/* Personal Baselines Section */}
      {baselines && baselines.tracking_days >= 5 && baselines.baselines.length > 0 ? (
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-800 font-bold text-xl">Your Baselines</Text>
            <Link href="/baselines" asChild>
              <TouchableOpacity>
                <Text className="text-[#2C3E50] font-medium text-sm">View All →</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Show top 3 baselines */}
          {baselines.baselines.slice(0, 3).map((baseline) => {
            const deviationColor = getDeviationColor(baseline.deviation_percentage, baseline.metric);
            const hasDeviation = baseline.deviation !== null && baseline.current_value !== null;
            
            return (
              <View key={baseline.metric} className="bg-white p-5 rounded-3xl shadow-sm mb-3 border border-gray-100">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-3xl mr-3">{getMetricIcon(baseline.metric)}</Text>
                    <View className="flex-1">
                      <Text className="text-gray-800 font-bold text-base">{getMetricLabel(baseline.metric)}</Text>
                      {baseline.interpretation && (
                        <Text className="text-gray-500 text-xs mt-1">{baseline.interpretation}</Text>
                      )}
                    </View>
                  </View>
                  {hasDeviation && (
                    <View>
                      <Text className="text-right text-xs text-gray-400 mb-1">vs baseline</Text>
                      <Text className="text-right font-bold text-lg" style={{ color: deviationColor }}>
                        {baseline.deviation > 0 ? '+' : ''}{baseline.deviation?.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-gray-400 text-xs">Baseline</Text>
                    <Text className="text-gray-800 font-semibold text-lg">
                      {baseline.baseline} <Text className="text-xs text-gray-500">{baseline.unit}</Text>
                    </Text>
                  </View>
                  {baseline.current_value !== null && (
                    <View>
                      <Text className="text-gray-400 text-xs text-right">Recent (7d)</Text>
                      <Text className="font-semibold text-lg text-right" style={{ color: deviationColor }}>
                        {baseline.current_value} <Text className="text-xs text-gray-500">{baseline.unit}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* View All Button */}
          <Link href="/baselines" asChild>
            <TouchableOpacity className="bg-[#2C3E50] p-4 rounded-2xl items-center">
              <Text className="text-white font-bold">View All Baselines & Behavior Impacts</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : baselines && baselines.tracking_days > 0 && baselines.tracking_days < 5 ? (
        <View className="mb-6">
          <Text className="text-gray-800 font-bold text-xl mb-4">Your Baselines</Text>
          <View className="bg-yellow-50 p-5 rounded-3xl border border-yellow-200">
            <View className="flex-row items-center mb-2">
              <Text className="text-3xl mr-3">📊</Text>
              <Text className="text-gray-800 font-bold text-lg">Almost there!</Text>
            </View>
            <Text className="text-gray-600 mb-3">
              You've tracked {baselines.tracking_days} days. Complete {5 - baselines.tracking_days} more days to unlock your personalized baselines.
            </Text>
            <View className="bg-yellow-100 h-2 rounded-full overflow-hidden">
              <View
                className="h-full bg-yellow-500 rounded-full"
                style={{ width: `${(baselines.tracking_days / 5) * 100}%` }}
              />
            </View>
          </View>
        </View>
      ) : null}

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
          <View className="flex-row items-center mb-4">
            <Text className="text-gray-800 font-bold text-xl flex-1">Insights</Text>
            <Text className="text-xs text-gray-400 uppercase tracking-wider">
              {insights.filter(i => i.confidence === 'high').length > 0 ? 'HIGH CONFIDENCE' : 'PERSONALIZED'}
            </Text>
          </View>
          {insights.map((insight, index) => {
            const getInsightIcon = (type: string, impact?: string) => {
              if (type === 'pattern' && impact === 'negative') return '⚠️';
              if (type === 'pattern' && impact === 'positive') return '✨';
              if (type === 'streak') return '🔥';
              return '💡';
            };

            const getInsightColor = (impact?: string, confidence?: string) => {
              if (impact === 'negative') return {
                bg: 'bg-red-50',
                border: 'border-red-200',
                badge: 'bg-red-100',
                badgeText: 'text-red-700',
                numberColor: '#DC2626',
              };
              if (impact === 'positive') return {
                bg: 'bg-green-50',
                border: 'border-green-200',
                badge: 'bg-green-100',
                badgeText: 'text-green-700',
                numberColor: '#059669',
              };
              return {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                badge: 'bg-blue-100',
                badgeText: 'text-blue-700',
                numberColor: '#2563EB',
              };
            };

            // Function to parse and format the message with highlighted numbers
            const formatMessage = (message: string, numberColor: string) => {
              // Split message by numbers and units (e.g., "3.5/5", "7+ hours", "50%")
              const parts: Array<{ text: string; isNumber: boolean }> = [];
              const regex = /(\d+\.?\d*\s*[+]?\s*(?:\/\d+|hours?|h|%|out of \d+)?)/g;
              let lastIndex = 0;
              let match;

              while ((match = regex.exec(message)) !== null) {
                // Add text before the number
                if (match.index > lastIndex) {
                  parts.push({ text: message.slice(lastIndex, match.index), isNumber: false });
                }
                // Add the number
                parts.push({ text: match[0], isNumber: true });
                lastIndex = match.index + match[0].length;
              }
              
              // Add remaining text
              if (lastIndex < message.length) {
                parts.push({ text: message.slice(lastIndex), isNumber: false });
              }

              return (
                <Text className="text-gray-800 text-base leading-6">
                  {parts.map((part, idx) => 
                    part.isNumber ? (
                      <Text key={idx} className="font-bold text-lg" style={{ color: numberColor }}>
                        {part.text}
                      </Text>
                    ) : (
                      <Text key={idx}>{part.text}</Text>
                    )
                  )}
                </Text>
              );
            };

            const colors = getInsightColor(insight.impact, insight.confidence);
            const insightIcon = getInsightIcon(insight.type, insight.impact);

            return (
              <View key={index} className={`${colors.bg} p-5 rounded-3xl mb-3 ${colors.border} border shadow-sm`}>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-3xl mr-3">{insightIcon}</Text>
                    <View className="flex-1">
                      <Text className="text-gray-800 font-bold text-base mb-1">
                        {insight.type === 'pattern' ? 'Pattern Detected' : 
                         insight.type === 'streak' ? 'Streak' : 'Tip'}
                      </Text>
                      <Text className="text-gray-500 text-xs">
                        {insight.confidence ? `${insight.confidence} confidence` : 'Based on your data'}
                      </Text>
                    </View>
                  </View>
                  {insight.confidence && (
                    <View className={`px-3 py-1 rounded-full ${colors.badge}`}>
                      <Text className={`text-xs font-medium ${colors.badgeText}`}>
                        {insight.confidence}
                      </Text>
                    </View>
                  )}
                </View>
                
                {formatMessage(insight.message, colors.numberColor)}
              </View>
            );
          })}
        </View>
      )}

      {/* History Link */}
      <Link href="/(tabs)/two" asChild>
        <TouchableOpacity className="mt-4 items-center">
          <Text className="text-brand-dark font-medium opacity-50">View History</Text>
        </TouchableOpacity>
      </Link>

    </ScrollView>
  );
}
