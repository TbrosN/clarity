import { DailyLog, getRecentLogs } from '@/services/StorageService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

export default function HistoryScreen() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const data = await getRecentLogs(30);
    setLogs(data);
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
      <View className="mb-6">
        <Text className="text-3xl font-bold text-[#2C3E50]">History</Text>
      </View>

      {logs.length === 0 ? (
        <View className="items-center mt-20">
          <Text className="text-gray-400 text-lg">No logs yet.</Text>
          <Text className="text-gray-400">Start your journey today!</Text>
        </View>
      ) : (
        logs.map((log, index) => (
          <View key={index} className="bg-white p-4 rounded-2xl mb-3 shadow-sm flex-row justify-between items-center">
            <View>
              <Text className="text-gray-500 font-medium mb-1">{log.date}</Text>
              <View className="flex-row gap-2">
                {log.skinRating && <Text>Skin: {log.skinRating}/5</Text>}
                {log.stress && <Text>Stress: {log.stress}</Text>}
              </View>
            </View>
            <View className="items-end">
              <Text className="text-brand-primary font-bold">
                {log.skinRating ? (log.skinRating >= 4 ? '✨' : log.skinRating <= 2 ? '🚨' : '😐') : '-'}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
