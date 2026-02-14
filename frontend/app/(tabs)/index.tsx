import { calculateRiskScore, generateInsights, Insight } from '@/services/InsightService';
import { DailyLog, getDailyLog } from '@/services/StorageService';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';

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

  // Listen for messages from service worker (notification actions)
  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
          const { screen, autoSubmitValue } = event.data;
          if (screen) {
            // Navigate to the screen with auto-submit value if provided
            const url = autoSubmitValue
              ? `${screen}&autoSubmit=${autoSubmitValue}`
              : screen;
            router.push(url as any);
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const sendTestNotification = async (type: 'acne' | 'stress' | 'sugar') => {
    const notifications = {
      acne: {
        title: "☀️ Good morning!",
        body: "How's your skin today?",
        screen: '/check-in?type=acne',
        actions: [
          { action: '5', title: '✨ Glowing' },
          { action: '3', title: '😐 Okay' },
          { action: '1', title: '🚨 Breakout' },
        ],
      },
      stress: {
        title: "🧘‍♀️ Stress check",
        body: "How stressed do you feel?",
        screen: '/check-in?type=stress',
        actions: [
          { action: '1', title: '🧘‍♀️ Zen' },
          { action: '3', title: '😐 Okay' },
          { action: '5', title: '🤯 Frazzled' },
        ],
      },
      sugar: {
        title: "🍪 Sugar intake",
        body: "How much sugar/carbs today?",
        screen: '/quick-report?type=sugar',
        actions: [
          { action: '1', title: '✨ Clean' },
          { action: '3', title: '😐 Moderate' },
          { action: '5', title: '🍰 Lots' },
        ],
      },
    };

    const config = notifications[type];

    if (Platform.OS === 'web') {
      // On web, use Service Worker for better PWA support
      if ('serviceWorker' in navigator && 'Notification' in window) {
        // Request permission if not already granted
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('Please enable notifications to test this feature');
            return;
          }
        }

        if (Notification.permission === 'granted') {
          try {
            // Register service worker if not already registered
            let registration = await navigator.serviceWorker.getRegistration();

            if (!registration) {
              registration = await navigator.serviceWorker.register('/service-worker.js');
              await navigator.serviceWorker.ready;
            }

            // Use service worker to show notification with actions
            await registration.showNotification(config.title, {
              body: config.body,
              icon: '/icon.png',
              badge: '/icon.png',
              tag: `clarity-${type}`,
              requireInteraction: false,
              // @ts-ignore - actions are supported but TypeScript types are incomplete
              actions: config.actions,
              data: {
                screen: config.screen,
                type: type,
              },
            });
          } catch (error) {
            console.error('Service worker notification error:', error);
            // Fallback to simple notification
            const notification = new Notification(config.title, {
              body: config.body,
              icon: '/icon.png',
            });
            notification.onclick = () => {
              window.focus();
              router.push(config.screen as any);
              notification.close();
            };
          }
        } else {
          alert('Notifications are blocked. Please enable them in your browser settings.');
        }
      } else {
        alert('This browser does not support notifications');
      }
    } else {
      // On native, send actual notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: config.title,
          body: config.body,
          data: { screen: config.screen.split('?')[0].substring(1), type: type },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1, // Send in 1 second
        },
      });
    }
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
          <Link href="/modal" asChild>
            <TouchableOpacity className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
              <Text className="text-lg">💡</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Quick Stats */}
        {todayLog && (
          <View className="mt-4 flex-row items-center">
            <Text className="text-gray-500 text-sm">
              {[
                todayLog.acneLevel,
                todayLog.sugarIntake,
                todayLog.stress,
                todayLog.sleepQuality,
                todayLog.touchHygiene,
              ].filter(Boolean).length} check-ins completed today ✓
            </Text>
          </View>
        )}
      </View>

      {/* Risk Meter */}
      <View className="bg-white p-6 rounded-3xl shadow-sm mb-6 border border-gray-100">
        <Text className="text-gray-400 font-medium mb-1 uppercase text-xs tracking-wider">Breakout Risk</Text>
        <Text className="text-3xl font-bold" style={{ color: risk.color }}>{risk.level}</Text>
        <Text className="text-gray-400 text-sm mt-2">Based on your recent sleep and stress.</Text>
      </View>

      {/* Quick Reports - Waze Style */}
      <View className="bg-white p-6 rounded-3xl shadow-sm mb-6 border border-gray-100">
        <Text className="text-gray-800 font-bold text-xl mb-4">What do you want to report? 📊</Text>

        <View className="flex-row flex-wrap gap-4">
          {/* Skin - The Outcome */}
          <TouchableOpacity
            className="w-[30%] items-center"
            onPress={() => router.push('/check-in?type=acne')}
          >
            <View className={`w-full aspect-square items-center justify-center rounded-2xl mb-2 ${todayLog?.acneLevel ? 'bg-[#E8F8F5]' : 'bg-gray-50'}`}>
              <Text className="text-3xl">🪞</Text>
            </View>
            <Text className="text-gray-600 text-xs font-medium text-center">Skin</Text>
          </TouchableOpacity>

          {/* Sugar/Carbs - The Fuel */}
          <TouchableOpacity
            className="w-[30%] items-center"
            onPress={() => router.push('/quick-report?type=sugar')}
          >
            <View className={`w-full aspect-square items-center justify-center rounded-2xl mb-2 ${todayLog?.sugarIntake ? 'bg-[#FFE6F0]' : 'bg-gray-50'}`}>
              <Text className="text-3xl">🍪</Text>
            </View>
            <Text className="text-gray-600 text-xs font-medium text-center">Sugar</Text>
          </TouchableOpacity>

          {/* Stress - The Internal Traffic */}
          <TouchableOpacity
            className="w-[30%] items-center"
            onPress={() => router.push('/check-in?type=stress')}
          >
            <View className={`w-full aspect-square items-center justify-center rounded-2xl mb-2 ${todayLog?.stress ? 'bg-[#F0E6FF]' : 'bg-gray-50'}`}>
              <Text className="text-3xl">🧘‍♀️</Text>
            </View>
            <Text className="text-gray-600 text-xs font-medium text-center">Stress</Text>
          </TouchableOpacity>

          {/* Sleep - The Recovery */}
          <TouchableOpacity
            className="w-[30%] items-center"
            onPress={() => router.push('/check-in?type=sleep')}
          >
            <View className={`w-full aspect-square items-center justify-center rounded-2xl mb-2 ${todayLog?.sleepQuality ? 'bg-[#EBDEF0]' : 'bg-gray-50'}`}>
              <Text className="text-3xl">💤</Text>
            </View>
            <Text className="text-gray-600 text-xs font-medium text-center">Sleep</Text>
          </TouchableOpacity>

          {/* Touch/Hygiene - The Hazard */}
          <TouchableOpacity
            className="w-[30%] items-center"
            onPress={() => router.push('/check-in?type=touch')}
          >
            <View className={`w-full aspect-square items-center justify-center rounded-2xl mb-2 ${todayLog?.touchHygiene ? 'bg-[#FFF5E6]' : 'bg-gray-50'}`}>
              <Text className="text-3xl">🖐️</Text>
            </View>
            <Text className="text-gray-600 text-xs font-medium text-center">Touch</Text>
          </TouchableOpacity>
        </View>
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

      {/* Debug Section */}
      {/* <View className="bg-gray-100 p-4 rounded-2xl mb-6 border border-gray-200">
        <Text className="text-gray-600 font-bold text-sm mb-3 uppercase tracking-wider">Debug Tools</Text>

        <View className="bg-blue-50 p-3 rounded-xl mb-3 border border-blue-200">
          <Text className="text-xs text-gray-700 mb-1">
            <Text className="font-bold">💡 Recommended Setup:</Text>
          </Text>
          <Text className="text-xs text-gray-600">
            📱 <Text className="font-semibold">iOS:</Text> Add to Home Screen from Safari{'\n'}
            🤖 <Text className="font-semibold">Android:</Text> Install from Chrome{'\n'}
            💻 <Text className="font-semibold">Desktop:</Text> Chrome or Edge for best experience{'\n'}
            {'\n'}
            <Text className="italic">Action buttons in notifications work on Chrome Android only</Text>
          </Text>
        </View>

        <TouchableOpacity
          className="bg-blue-500 py-3 rounded-xl items-center mb-2"
          onPress={() => sendTestNotification('acne')}
        >
          <Text className="text-white font-semibold">🔔 Send Skin Check-In Notification</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-purple-500 py-3 rounded-xl items-center mb-2"
          onPress={() => sendTestNotification('stress')}
        >
          <Text className="text-white font-semibold">🔔 Send Stress Check Notification</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-pink-500 py-3 rounded-xl items-center"
          onPress={() => sendTestNotification('sugar')}
        >
          <Text className="text-white font-semibold">🔔 Send Sugar Intake Notification</Text>
        </TouchableOpacity>
      </View> */}

      {/* History Link (Placeholder for Tab 2) */}
      <Link href="/(tabs)/two" asChild>
        <TouchableOpacity className="mt-4 items-center">
          <Text className="text-brand-dark font-medium opacity-50">View History</Text>
        </TouchableOpacity>
      </Link>

    </ScrollView>
  );
}
