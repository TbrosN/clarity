import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';

export default function ModalScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 p-8 pt-16">
        {/* User Profile Section */}
        <View className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-3xl mb-8 border border-gray-100">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-[#2C3E50] mb-1">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Account'}
              </Text>
              <Text className="text-gray-600 text-sm">
                {user?.primaryEmailAddress?.emailAddress}
              </Text>
            </View>
            <View className="bg-blue-100 w-16 h-16 rounded-full items-center justify-center">
              <Text className="text-3xl">
                {user?.firstName ? user.firstName.charAt(0).toUpperCase() : '👤'}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            className="bg-red-500 py-3 rounded-xl items-center mt-2"
            onPress={handleSignOut}
          >
            <Text className="text-white font-semibold text-base">Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-4xl font-bold text-[#2C3E50] mb-4">
          How Clarity Works 💡
        </Text>
        
        <Text className="text-gray-600 text-lg mb-8">
          Two simple daily surveys to discover patterns in your sleep quality and energy levels.
        </Text>

        {/* Daily Surveys Section */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-[#2C3E50] mb-4">
            📋 Daily Surveys
          </Text>
          <Text className="text-gray-700 text-base mb-4">
            Complete two quick surveys each day to track your sleep habits and energy patterns:
          </Text>
          
          <View className="space-y-3">
            <View className="bg-blue-50 p-4 rounded-2xl mb-3 border border-blue-100">
              <View className="flex-row items-start mb-2">
                <Text className="text-3xl mr-3">🌙</Text>
                <View className="flex-1">
                  <Text className="font-bold text-[#2C3E50] text-lg">Before Bed (5 questions)</Text>
                  <Text className="text-gray-600 text-sm mt-1">
                    • When you plan to sleep{'\n'}
                    • Last meal timing{'\n'}
                    • Screen time before bed{'\n'}
                    • Caffeine intake{'\n'}
                    • Stress levels
                  </Text>
                </View>
              </View>
            </View>
            
            <View className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
              <View className="flex-row items-start mb-2">
                <Text className="text-3xl mr-3">☀️</Text>
                <View className="flex-1">
                  <Text className="font-bold text-[#2C3E50] text-lg">After Wake-Up (6 questions)</Text>
                  <Text className="text-gray-600 text-sm mt-1">
                    • Actual sleep time{'\n'}
                    • Wake time{'\n'}
                    • Snooze behavior{'\n'}
                    • Sleep quality{'\n'}
                    • Energy & alertness levels
                  </Text>
                </View>
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
            We'll remind you at the right times:
          </Text>
          <Text className="text-gray-600 text-sm">
            • Morning (8:00 AM) - After wake-up survey{'\n'}
            • Evening (11:00 PM) - Before bed survey
          </Text>
        </View>

        {/* Insights */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-[#2C3E50] mb-4">
            💡 Personal Insights
          </Text>
          <Text className="text-gray-700 text-base">
            After a few days, Clarity discovers patterns unique to you:
          </Text>
          <View className="bg-[#FFF5EB] p-4 rounded-2xl mt-4 border border-[#FFDCC2]">
            <Text className="text-gray-700 italic">
              "Late bedtimes (after 11 PM) are linked to lower energy 2 days later."
            </Text>
          </View>
          <View className="bg-[#E8F8F5] p-4 rounded-2xl mt-3 border border-[#A8D5BA]">
            <Text className="text-gray-700 italic">
              "Turning off screens 2+ hours before bed improves your sleep quality!"
            </Text>
          </View>
        </View>

        {/* Recommended Setup */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-[#2C3E50] mb-4">
            📱 Recommended Setup
          </Text>
          <View className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <Text className="text-gray-700 text-base mb-2 font-semibold">
              For the best experience:
            </Text>
            <Text className="text-gray-600 text-sm">
              • <Text className="font-semibold">iOS:</Text> Add to Home Screen from Safari{'\n'}
              • <Text className="font-semibold">Android:</Text> Install from Chrome{'\n'}
              • <Text className="font-semibold">Desktop:</Text> Use Chrome or Edge
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
