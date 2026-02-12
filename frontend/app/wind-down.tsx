import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { saveDailyLog } from '../services/StorageService';

export default function WindDownScreen() {
  const router = useRouter();

  const handleBedtime = async () => {
    const today = new Date().toISOString().split('T')[0];
    await saveDailyLog({ 
      date: today, 
      bedtime: new Date().toISOString() 
    });
    
    // Brief delay for visual feedback
    setTimeout(() => {
      router.back();
    }, 400);
  };

  return (
    <View className="flex-1 items-center justify-center bg-[#2C3E50] p-6">
      <View className="items-center w-full">
        <Text className="text-2xl font-bold text-white mb-2 text-center">
          Ready to recharge? 💤
        </Text>
        <Text className="text-gray-400 mb-10 text-center">
          Log your bedtime • Better sleep = Better skin
        </Text>

        <Pressable
          className="w-64 h-64 rounded-full bg-[#FF9F87] items-center justify-center shadow-2xl border-4 border-[#FFB09C] active:scale-95"
          onPress={handleBedtime}
        >
          <Text className="text-white text-3xl font-bold text-center">
            Going to{'\n'}Sleep Now 🌙
          </Text>
        </Pressable>

        <View className="mt-12">
          <Text className="text-gray-400 text-sm text-center mb-4">
            Before bed, check in:
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              className="bg-white/10 px-6 py-3 rounded-full"
              onPress={() => router.push('/check-in?type=stress')}
            >
              <Text className="text-white font-medium">🧘‍♀️ Stress</Text>
            </Pressable>
            <Pressable
              className="bg-white/10 px-6 py-3 rounded-full"
              onPress={() => router.push('/quick-report?type=sugar')}
            >
              <Text className="text-white font-medium">🍪 Sugar</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable onPress={() => router.back()} className="absolute bottom-10">
        <Text className="text-gray-500 text-sm">Cancel</Text>
      </Pressable>
    </View>
  );
}
