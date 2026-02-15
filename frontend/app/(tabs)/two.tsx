import { apiService } from '@/services/ApiService';
import { Insight } from '@/services/InsightService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

type HistoryResponse = {
  id: number;
  value: string | number | boolean;
  value_type: 'numeric' | 'text' | 'bool' | 'time' | 'timestamp';
};

type HistoryLog = {
  date: string;
  responses: Record<string, HistoryResponse>;
};

const LABELS: Record<string, string> = {
  // Sleep tracking
  wakeTime: 'Wake time',
  bedtime: 'Bedtime',
  sleepQuality: 'Sleep quality',
  
  // Before Bed Survey
  plannedSleepTime: 'Planned sleep time',
  lastMeal: 'Last meal timing',
  screensOff: 'Screens off timing',
  caffeine: 'Caffeine timing',
  stress: 'Stress level',
  
  // After Wake Survey
  actualSleepTime: 'Actual sleep time',
  snooze: 'Snooze behavior',
  energy: 'Energy level',
  sleepiness: 'Sleepiness level',
};

export default function HistoryScreen() {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<number | null>(null);
  const [editingResponseType, setEditingResponseType] = useState<HistoryResponse['value_type'] | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const loadData = async () => {
    const [historyData, insightsData] = await Promise.all([
      apiService.get<{ logs: HistoryLog[] }>('/logs/history?days=30'),
      apiService.get<Insight[]>('/insights'),
    ]);
    setLogs(historyData.logs);
    setInsights(insightsData);
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

  const startEdit = (response: HistoryResponse) => {
    const current = response.value;
    setEditingResponseId(response.id);
    setEditingResponseType(response.value_type);
    setEditingValue(String(current));
  };

  const saveEdit = async () => {
    if (!editingResponseId || !editingResponseType) return;

    let payload: Record<string, string | number | boolean> | null = null;
    if (editingResponseType === 'numeric') {
      const parsed = Number(editingValue);
      if (Number.isNaN(parsed)) return;
      payload = { value_numeric: parsed };
    } else if (editingResponseType === 'bool') {
      payload = { value_bool: editingValue === 'true' };
    } else if (editingResponseType === 'timestamp') {
      const parsedDate = new Date(editingValue);
      if (Number.isNaN(parsedDate.getTime())) return;
      payload = { value_timestamp: parsedDate.toISOString() };
    } else if (editingResponseType === 'time') {
      payload = { value_time: editingValue };
    } else {
      payload = { value_text: editingValue };
    }

    await apiService.put(`/responses/${editingResponseId}`, payload);
    setEditingResponseId(null);
    setEditingResponseType(null);
    setEditingValue('');
    await loadData();
  };

  const formatValue = (response: HistoryResponse): string => {
    if (response.value_type === 'timestamp' && typeof response.value === 'string') {
      const parsed = new Date(response.value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString();
      }
    }
    if (response.value_type === 'bool' && typeof response.value === 'boolean') {
      return response.value ? 'Yes' : 'No';
    }
    return String(response.value);
  };

  return (
    <ScrollView
      className="flex-1 bg-[#F7F7F7]"
      contentContainerStyle={{ padding: 20, paddingTop: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="mb-6">
        <Text className="text-3xl font-bold text-[#2C3E50]">History</Text>
      </View>
      {insights.length > 0 && (
        <View className="mb-6">
          <Text className="text-[#2C3E50] font-bold text-xl mb-3">Insights</Text>
          {insights.map((insight, index) => (
            <View key={index} className="bg-[#FFF5EB] p-4 rounded-2xl mb-2 border border-[#FFDCC2]">
              <Text className="text-[#2C3E50]">{insight.message}</Text>
            </View>
          ))}
        </View>
      )}

      {logs.length === 0 ? (
        <View className="items-center mt-20">
          <Text className="text-gray-400 text-lg">No logs yet.</Text>
          <Text className="text-gray-400">Start logging to build your history.</Text>
        </View>
      ) : (
        logs.map((log, index) => (
          <View key={index} className="bg-white p-4 rounded-2xl mb-3 shadow-sm">
            <Text className="text-gray-500 font-medium mb-2">{log.date}</Text>
            <View className="gap-2">
              {Object.entries(log.responses).map(([questionKey, response]) => (
                <View key={`${log.date}-${questionKey}`} className="flex-row justify-between items-center">
                  <Text className="text-gray-700">{LABELS[questionKey] ?? questionKey}</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[#2C3E50] font-semibold">{formatValue(response)}</Text>
                    <Pressable
                      className="bg-gray-100 px-3 py-1 rounded-full"
                      onPress={() => startEdit(response)}
                    >
                      <Text className="text-xs text-gray-700">Edit</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      {editingResponseId && editingResponseType && (
        <View className="bg-white p-4 rounded-2xl mb-3 shadow-sm">
          <Text className="text-gray-700 mb-2">Edit answer ({editingResponseType})</Text>
          {editingResponseType === 'bool' ? (
            <View className="flex-row gap-2 mb-3">
              <Pressable
                className={`px-4 py-2 rounded-xl ${editingValue === 'true' ? 'bg-[#2C3E50]' : 'bg-gray-100'}`}
                onPress={() => setEditingValue('true')}
              >
                <Text className={editingValue === 'true' ? 'text-white' : 'text-gray-700'}>Yes</Text>
              </Pressable>
              <Pressable
                className={`px-4 py-2 rounded-xl ${editingValue === 'false' ? 'bg-[#2C3E50]' : 'bg-gray-100'}`}
                onPress={() => setEditingValue('false')}
              >
                <Text className={editingValue === 'false' ? 'text-white' : 'text-gray-700'}>No</Text>
              </Pressable>
            </View>
          ) : (
            <TextInput
              value={editingValue}
              onChangeText={setEditingValue}
              keyboardType={editingResponseType === 'numeric' && Platform.OS !== 'web' ? 'numeric' : 'default'}
              className="border border-gray-200 rounded-xl px-3 py-2 mb-3"
              placeholder={
                editingResponseType === 'timestamp'
                  ? 'ISO datetime (e.g. 2026-02-14T22:30:00Z)'
                  : editingResponseType === 'time'
                    ? 'HH:MM:SS'
                    : 'Enter a new value'
              }
            />
          )}
          <View className="flex-row gap-2">
            <Pressable className="bg-[#2C3E50] px-4 py-2 rounded-xl" onPress={saveEdit}>
              <Text className="text-white">Save</Text>
            </Pressable>
            <Pressable
              className="bg-gray-100 px-4 py-2 rounded-xl"
              onPress={() => {
                setEditingResponseId(null);
                setEditingResponseType(null);
                setEditingValue('');
              }}
            >
              <Text className="text-gray-700">Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
