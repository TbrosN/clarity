import InsightMessageWithCitations from '@/components/InsightMessageWithCitations';
import { useInsights } from '@/contexts/InsightsContext';
import { generateInsights, Insight } from '@/services/InsightService';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

const getInsightStyle = (insight: Insight) => {
  if (insight.impact === 'positive') {
    return {
      bg: '#EEF9F4',
      border: '#CAECDC',
      numberColor: '#2E8B67',
    };
  }
  if (insight.impact === 'negative') {
    return {
      bg: '#FEF4F4',
      border: '#F6D3D3',
      numberColor: '#C25252',
    };
  }
  if (insight.type === 'streak') {
    return {
      bg: '#FFF8EF',
      border: '#F4DFC4',
      numberColor: '#B5762D',
    };
  }
  return {
    bg: '#EFF3FF',
    border: '#D5DFFB',
    numberColor: '#5163A8',
  };
};

export default function InsightsScreen() {
  const { insights, setInsights } = useInsights();
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = useCallback(async () => {
    const data = await generateInsights();
    setInsights(Array.isArray(data) ? data : []);
  }, [setInsights]);

  useEffect(() => {
    if (insights.length === 0) {
      loadInsights();
    }
  }, [insights.length, loadInsights]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInsights();
    setRefreshing(false);
  }, [loadInsights]);

  return (
    <ScrollView
      className="flex-1 bg-[#F7F7F7]"
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="mb-6">
        <Text className="text-3xl font-bold text-[#2C3E50]">Insights</Text>
        <Text className="text-gray-500 mt-1">Your current personalized insights</Text>
      </View>

      {insights.length === 0 ? (
        <View className="items-center mt-20">
          <Text className="text-gray-400 text-lg">No insights yet.</Text>
          <Text className="text-gray-400">Keep logging to unlock patterns.</Text>
        </View>
      ) : (
        insights.map((insight, index) => {
          const style = getInsightStyle(insight);
          return (
            <View
              key={`${insight.type}-${index}`}
              className="p-4 rounded-2xl mb-3 border"
              style={{ backgroundColor: style.bg, borderColor: style.border }}
            >
              <InsightMessageWithCitations
                message={insight.message}
                citations={insight.citations}
                numberColor={style.numberColor}
              />
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
