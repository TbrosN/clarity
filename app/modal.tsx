import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 p-8 pt-16">
        <Text className="text-4xl font-bold text-[#2C3E50] mb-4">
          How Clarity Works 💡
        </Text>
        
        <Text className="text-gray-600 text-lg mb-8">
          Simple check-ins throughout your day to discover what affects your skin.
        </Text>

        {/* Quick Reports Section */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-[#2C3E50] mb-4">
            📊 Quick Reports
          </Text>
          <Text className="text-gray-700 text-base mb-4">
            Just like Waze lets you report traffic with a tap, Clarity makes it easy to track what matters:
          </Text>
          
          <View className="space-y-3">
            <View className="flex-row items-start mb-3">
              <Text className="text-2xl mr-3">🪞</Text>
              <View className="flex-1">
                <Text className="font-semibold text-[#2C3E50]">Skin & Acne</Text>
                <Text className="text-gray-600">Track breakouts and skin clarity</Text>
              </View>
            </View>
            
            <View className="flex-row items-start mb-3">
              <Text className="text-2xl mr-3">😊</Text>
              <View className="flex-1">
                <Text className="font-semibold text-[#2C3E50]">Mood & Stress</Text>
                <Text className="text-gray-600">How you feel affects your skin</Text>
              </View>
            </View>
            
            <View className="flex-row items-start mb-3">
              <Text className="text-2xl mr-3">⚡</Text>
              <View className="flex-1">
                <Text className="font-semibold text-[#2C3E50]">Energy Levels</Text>
                <Text className="text-gray-600">Track your daily vitality</Text>
              </View>
            </View>
            
            <View className="flex-row items-start mb-3">
              <Text className="text-2xl mr-3">💧</Text>
              <View className="flex-1">
                <Text className="font-semibold text-[#2C3E50]">Hydration & Diet</Text>
                <Text className="text-gray-600">Water and sugar intake matter</Text>
              </View>
            </View>
            
            <View className="flex-row items-start mb-3">
              <Text className="text-2xl mr-3">💤</Text>
              <View className="flex-1">
                <Text className="font-semibold text-[#2C3E50]">Sleep Quality</Text>
                <Text className="text-gray-600">Bedtime and sleep affect skin 2 days later</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-[#2C3E50] mb-4">
            🔔 Smart Notifications
          </Text>
          <Text className="text-gray-700 text-base mb-4">
            We'll check in throughout the day at the right times:
          </Text>
          <Text className="text-gray-600 text-sm">
            • Morning (8 AM) - Skin check{'\n'}
            • Mid-morning (10:30 AM) - Energy{'\n'}
            • Lunch (12:30 PM) - Hydration{'\n'}
            • Afternoon (3 PM) - Mood{'\n'}
            • Evening (6 PM) - Stress{'\n'}
            • Night (8 PM) - Sugar intake{'\n'}
            • Bedtime (9:30 PM) - Wind down
          </Text>
        </View>

        {/* Insights */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-[#2C3E50] mb-4">
            💡 Personal Insights
          </Text>
          <Text className="text-gray-700 text-base">
            After a few days, Clarity discovers connections unique to you:
          </Text>
          <View className="bg-[#FFF5EB] p-4 rounded-2xl mt-4 border border-[#FFDCC2]">
            <Text className="text-gray-700 italic">
              "Late bedtimes (after 11 PM) are linked to breakouts 2 days later."
            </Text>
          </View>
          <View className="bg-[#E8F8F5] p-4 rounded-2xl mt-3 border border-[#A8D5BA]">
            <Text className="text-gray-700 italic">
              "Good hydration days are linked to clearer skin!"
            </Text>
          </View>
        </View>

        <Pressable
          className="bg-[#FF6B4A] py-5 rounded-2xl items-center mb-8"
          onPress={() => router.back()}
        >
          <Text className="text-white text-xl font-bold">Got it! 🚀</Text>
        </Pressable>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
    </ScrollView>
  );
}
