import {
  BaselineMetric,
  BehaviorImpact,
  fetchPersonalBaselines,
  getBehaviorIcon,
  getMetricIcon,
  getMetricLabel,
  PersonalBaselinesResponse,
} from '@/services/BaselineService';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

export default function BaselinesScreen() {
  const [data, setData] = useState<PersonalBaselinesResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const baselines = await fetchPersonalBaselines();
    setData(baselines);
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

  const getImpactColor = (impact: number): string => {
    if (impact >= 1) return '#10B981'; // Green - high positive impact
    if (impact >= 0.5) return '#34D399'; // Light green - moderate positive
    if (impact <= -0.5) return '#EF4444'; // Red - negative impact
    return '#F59E0B'; // Orange - minimal impact
  };

  const renderBaselineCard = (baseline: BaselineMetric) => {
    const deviationColor = getDeviationColor(baseline.deviation_percentage, baseline.metric);
    const hasDeviation = baseline.deviation !== null && baseline.deviation_percentage !== null;
    const recentValue = baseline.current_value;
    const chartData = [
      { value: baseline.baseline, label: 'Baseline', frontColor: '#64748B' },
      ...(recentValue !== null ? [{ value: recentValue, label: 'Recent', frontColor: deviationColor }] : []),
    ];
    const maxChartValue = Math.max(baseline.baseline, recentValue ?? 0, 1) * 1.15;
    
    return (
      <View
        key={baseline.metric}
        className="bg-white p-4 rounded-2xl shadow-sm mb-3 border border-gray-100"
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Text className="text-2xl mr-2">{getMetricIcon(baseline.metric)}</Text>
            <View>
              <Text className="text-gray-800 font-bold text-sm">{getMetricLabel(baseline.metric)}</Text>
              <Text className="text-gray-400 text-xs">7-day comparison</Text>
            </View>
          </View>
        </View>

        <View className="bg-gray-50 p-3 rounded-xl mb-3">
          <BarChart
            data={chartData}
            height={120}
            maxValue={maxChartValue}
            noOfSections={4}
            barWidth={30}
            spacing={30}
            initialSpacing={12}
            endSpacing={12}
            roundedTop
            disableScroll
            hideRules
            hideYAxisText
            xAxisThickness={0}
            yAxisThickness={0}
            xAxisLabelTextStyle={{ color: '#6B7280', fontSize: 11 }}
          />
        </View>

        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-gray-600 text-xs">Baseline</Text>
          <Text className="text-gray-800 text-sm font-semibold">
            {baseline.baseline.toFixed(1)} {baseline.unit}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-gray-600 text-xs">Recent (7d)</Text>
          <Text className="text-sm font-semibold" style={{ color: recentValue !== null ? deviationColor : '#9CA3AF' }}>
            {recentValue !== null ? `${recentValue.toFixed(1)} ${baseline.unit}` : 'No data'}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-gray-500 text-[11px]">Delta from baseline</Text>
          {hasDeviation && (
            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: `${deviationColor}22` }}>
              <Text className="font-semibold text-[11px]" style={{ color: deviationColor }}>
                {(baseline.deviation_percentage || 0) > 0 ? '↑ ' : '↓ '}
                {Math.abs(baseline.deviation_percentage || 0).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {baseline.interpretation && (
          <View className="mt-2">
            <Text className="text-gray-400 text-[11px]" numberOfLines={2}>
              {baseline.interpretation}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderBehaviorImpactCard = (impact: BehaviorImpact) => {
    const impactColor = getImpactColor(impact.your_impact);
    const impactIsPositive = impact.your_impact >= 0.5;
    const impactIsSignificant = Math.abs(impact.your_impact) >= 0.5;
    
    return (
      <View key={`${impact.behavior}-${impact.outcome}`} className="bg-white p-5 rounded-3xl shadow-sm mb-4 border border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <Text className="text-3xl mr-2">{getBehaviorIcon(impact.behavior)}</Text>
            <View className="flex-1">
              <Text className="text-gray-800 font-bold text-base">{impact.behavior_label}</Text>
              <Text className="text-gray-400 text-xs">Impact on {impact.outcome_label}</Text>
            </View>
          </View>
          <View className={`px-3 py-1 rounded-full ${impact.confidence === 'high' ? 'bg-green-100' : 'bg-yellow-100'}`}>
            <Text className={`text-xs font-medium ${impact.confidence === 'high' ? 'text-green-700' : 'text-yellow-700'}`}>
              {impact.confidence} confidence
            </Text>
          </View>
        </View>

        <View className="mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-600 text-sm">When optimal:</Text>
            <Text className="text-lg font-bold text-green-600">{impact.when_good.toFixed(2)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-600 text-sm">When suboptimal:</Text>
            <Text className="text-lg font-bold text-red-600">{impact.when_poor.toFixed(2)}</Text>
          </View>
        </View>

        {impactIsSignificant && (
          <View className="bg-gradient-to-r p-4 rounded-2xl mb-3" style={{ backgroundColor: impactIsPositive ? '#ECFDF5' : '#FEF2F2' }}>
            <View className="flex-row items-center mb-2">
              <Text className="text-2xl mr-2">{impactIsPositive ? '📈' : '📉'}</Text>
              <Text className="font-bold text-lg" style={{ color: impactColor }}>
                {impactIsPositive ? '+' : ''}{impact.your_impact.toFixed(2)} points
              </Text>
            </View>
            <Text className="text-gray-700 text-sm">
              {impactIsPositive ? 'Positive' : 'Negative'} impact on your {impact.outcome_label.toLowerCase()}
            </Text>
          </View>
        )}

        {impact.recommendation && (
          <View className="bg-blue-50 p-3 rounded-2xl border border-blue-200">
            <View className="flex-row items-start">
              <Text className="text-lg mr-2">💡</Text>
              <Text className="text-gray-800 text-sm flex-1 leading-5">{impact.recommendation}</Text>
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <Text className="text-gray-400 text-xs">
            Based on {impact.sample_size_good + impact.sample_size_poor} days of data
          </Text>
        </View>
      </View>
    );
  };

  if (!data) {
    return (
      <ScrollView
        className="flex-1 bg-[#F7F7F7]"
        contentContainerStyle={{ padding: 20, paddingTop: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text className="text-gray-400 text-center mt-20">Loading baselines...</Text>
      </ScrollView>
    );
  }

  if (data.tracking_days < 5) {
    return (
      <ScrollView
        className="flex-1 bg-[#F7F7F7]"
        contentContainerStyle={{ padding: 20, paddingTop: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-8">
          <Text className="text-4xl font-bold text-[#2C3E50] mb-2">Personal Baselines</Text>
          <Text className="text-gray-500">Track how behaviors affect YOU specifically</Text>
        </View>

        <View className="bg-yellow-50 p-6 rounded-3xl border border-yellow-200">
          <Text className="text-3xl mb-3">📊</Text>
          <Text className="text-gray-800 font-bold text-lg mb-2">Keep Tracking</Text>
          <Text className="text-gray-600 leading-6">
            You've tracked {data.tracking_days} days. Complete at least 5 days of surveys to unlock your personalized baselines and behavior insights.
          </Text>
        </View>

        <Link href="/(tabs)" className="mt-6 bg-[#2C3E50] p-4 rounded-2xl items-center">
          <Text className="text-white font-bold">Complete Today's Surveys</Text>
        </Link>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#F7F7F7]"
      contentContainerStyle={{ padding: 20, paddingTop: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View className="mb-8">
        <Text className="text-4xl font-bold text-[#2C3E50] mb-2">Personal Baselines</Text>
        <Text className="text-gray-500">Based on {data.tracking_days} days of tracking</Text>
      </View>

      {/* Baselines Section */}
      {data.baselines.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center mb-4">
            <Text className="text-2xl font-bold text-[#2C3E50] flex-1">Your Baselines</Text>
            <Text className="text-xs text-gray-400 uppercase tracking-wider">vs recent 7 days</Text>
          </View>
          <Text className="text-gray-600 mb-4 leading-6">
            These are YOUR personal averages. See how your recent patterns compare to your typical performance.
          </Text>
          {data.baselines.map(renderBaselineCard)}
        </View>
      )}

      {/* Behavior Impacts Section */}
      {data.behavior_impacts.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center mb-4">
            <Text className="text-2xl font-bold text-[#2C3E50]">How Behaviors Affect YOU</Text>
          </View>
          <Text className="text-gray-600 mb-4 leading-6">
            Not everyone responds the same way. Here's how different behaviors specifically impact YOUR outcomes.
          </Text>
          {data.behavior_impacts.map(renderBehaviorImpactCard)}
        </View>
      )}

      {/* Footer Note */}
      <View className="bg-gray-100 p-4 rounded-2xl mb-8">
        <Text className="text-gray-600 text-sm text-center leading-6">
          These insights are personalized to YOUR data. Keep completing daily surveys to refine your baselines.
        </Text>
      </View>
    </ScrollView>
  );
}
