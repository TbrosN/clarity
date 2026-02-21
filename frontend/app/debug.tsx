import { apiService } from '@/services/ApiService';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DebugScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // // Disable access to debug page - redirect to home
  // useEffect(() => {
  //   router.replace('/(tabs)');
  // }, []);

  const generateSampleData = async (days: number) => {
    setLoading(true);
    setLastAction(null);
    try {
      const result = await apiService.post<any>(`/debug/generate-sample-data?days=${days}`, {});
      setLastAction(`✅ Generated ${result.days} days of sample data`);
      Alert.alert('Success', `Generated ${result.days} days of data from ${result.date_range.start} to ${result.date_range.end}`);
      // Refresh summary
      await fetchSummary();
    } catch (error) {
      setLastAction('❌ Failed to generate data');
      Alert.alert('Error', 'Failed to generate sample data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete ALL your data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setLastAction(null);
            try {
              const result = await apiService.delete<any>('/debug/clear-all-data?confirm=true');
              setLastAction(`🗑️ Deleted ${result.deleted_count} responses`);
              Alert.alert('Deleted', `Removed ${result.deleted_count} responses`);
              setSummary(null);
              await fetchSummary();
            } catch (error) {
              setLastAction('❌ Failed to delete data');
              Alert.alert('Error', 'Failed to delete data');
              console.error(error);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const result = await apiService.get<any>('/debug/baseline-summary');
      setSummary(result);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#F7F7F7]" contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      {/* Header */}
      <View className="mb-8">
        <Text className="text-4xl font-bold text-[#2C3E50] mb-2">🛠️ Debug Mode</Text>
        <Text className="text-gray-500">Test baselines with sample data</Text>
      </View>

      {/* Last Action */}
      {lastAction && (
        <View className="bg-blue-50 p-4 rounded-2xl mb-4 border border-blue-200">
          <Text className="text-gray-800 font-medium">{lastAction}</Text>
        </View>
      )}

      {/* Quick Actions */}
      <View className="mb-6">
        <Text className="text-gray-800 font-bold text-xl mb-4">Quick Actions</Text>

        {/* Generate Data Buttons */}
        <TouchableOpacity
          className="bg-green-500 p-5 rounded-3xl shadow-sm mb-3"
          onPress={() => generateSampleData(30)}
          disabled={loading}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg mb-1">Generate 30 Days</Text>
              <Text className="text-white/80 text-sm">Create realistic sample data</Text>
            </View>
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-2xl">📊</Text>}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-blue-500 p-5 rounded-3xl shadow-sm mb-3"
          onPress={() => generateSampleData(14)}
          disabled={loading}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg mb-1">Generate 14 Days</Text>
              <Text className="text-white/80 text-sm">Shorter test dataset</Text>
            </View>
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-2xl">📈</Text>}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-purple-500 p-5 rounded-3xl shadow-sm mb-3"
          onPress={() => generateSampleData(7)}
          disabled={loading}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg mb-1">Generate 7 Days</Text>
              <Text className="text-white/80 text-sm">Minimal test data</Text>
            </View>
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-2xl">📉</Text>}
          </View>
        </TouchableOpacity>

        {/* Check Summary */}
        <TouchableOpacity
          className="bg-gray-800 p-5 rounded-3xl shadow-sm mb-3"
          onPress={fetchSummary}
          disabled={loading}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg mb-1">Check Data Summary</Text>
              <Text className="text-white/80 text-sm">See what data you have</Text>
            </View>
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-2xl">🔍</Text>}
          </View>
        </TouchableOpacity>

        {/* Clear All Data */}
        <TouchableOpacity
          className="bg-red-500 p-5 rounded-3xl shadow-sm"
          onPress={clearAllData}
          disabled={loading}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg mb-1">Clear All Data</Text>
              <Text className="text-white/80 text-sm">⚠️ Deletes everything!</Text>
            </View>
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-2xl">🗑️</Text>}
          </View>
        </TouchableOpacity>
      </View>

      {/* Data Summary */}
      {summary && (
        <View className="mb-6">
          <Text className="text-gray-800 font-bold text-xl mb-4">Data Summary</Text>

          <View className="bg-white p-5 rounded-3xl shadow-sm mb-3">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-600 text-lg">Total Days Tracked</Text>
              <Text className="text-3xl font-bold text-[#2C3E50]">{summary.total_days}</Text>
            </View>

            <View className={`p-3 rounded-2xl ${summary.ready_for_baselines ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <Text className="text-center font-medium text-lg">{summary.message}</Text>
            </View>
          </View>

          {/* Metrics */}
          {Object.keys(summary.metrics).length > 0 && (
            <View className="bg-white p-5 rounded-3xl shadow-sm mb-3">
              <Text className="text-gray-800 font-bold text-lg mb-3">📊 Metrics</Text>
              {Object.entries(summary.metrics).map(([key, count]) => (
                <View key={key} className="flex-row items-center justify-between py-2 border-b border-gray-100">
                  <Text className="text-gray-600">{key}</Text>
                  <Text className="text-gray-800 font-semibold">{count as number} days</Text>
                </View>
              ))}
            </View>
          )}

          {/* Behaviors */}
          {Object.keys(summary.behaviors).length > 0 && (
            <View className="bg-white p-5 rounded-3xl shadow-sm mb-3">
              <Text className="text-gray-800 font-bold text-lg mb-3">🎯 Behaviors</Text>
              {Object.entries(summary.behaviors).map(([key, count]) => (
                <View key={key} className="flex-row items-center justify-between py-2 border-b border-gray-100">
                  <Text className="text-gray-600">{key}</Text>
                  <Text className="text-gray-800 font-semibold">{count as number} days</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Navigation */}
      <View className="mb-6">
        <Text className="text-gray-800 font-bold text-xl mb-4">Test Features</Text>

        <TouchableOpacity
          className="bg-[#2C3E50] p-5 rounded-3xl shadow-sm mb-3"
          onPress={() => router.push('/baselines')}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg">View Baselines</Text>
              <Text className="text-white/80 text-sm">See personal baselines screen</Text>
            </View>
            <Text className="text-2xl text-white">→</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-[#2C3E50] p-5 rounded-3xl shadow-sm mb-3"
          onPress={() => router.push('/(tabs)')}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg">View Dashboard</Text>
              <Text className="text-white/80 text-sm">See insights integration</Text>
            </View>
            <Text className="text-2xl text-white">→</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-[#2C3E50] p-5 rounded-3xl shadow-sm"
          onPress={() => router.push('/(tabs)/two')}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white font-bold text-lg">View History</Text>
              <Text className="text-white/80 text-sm">Check logged data</Text>
            </View>
            <Text className="text-2xl text-white">→</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Warning */}
      <View className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
        <Text className="text-yellow-800 text-sm text-center">
          ⚠️ This is a debug screen. Generated data will be mixed with your real data.
        </Text>
      </View>
    </ScrollView>
  );
}
