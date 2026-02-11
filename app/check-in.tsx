import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { saveDailyLog } from '../services/StorageService';

const RATINGS = [
  { value: 1, label: "🚨", text: "Breakout" },
  { value: 2, label: "☁️", text: "Cloudy" },
  { value: 3, label: "😐", text: "Okay" },
  { value: 4, label: "🌤️", text: "Better" },
  { value: 5, label: "✨", text: "Glowing" },
];

export default function CheckInScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);

  const handleSave = async (rating: number) => {
    setSelected(rating);
    const today = new Date().toISOString().split('T')[0];
    await saveDailyLog({ date: today, skinRating: rating });

    // Simulate "Instant Reward" delay then close
    setTimeout(() => {
      router.push('../'); // Go back to tabs (dashboard)
    }, 600);
  };

  return (
    <View className="flex-1 items-center justify-center bg-[#F7F7F7] p-6">
      <Text className="text-3xl font-bold text-gray-800 mb-2">Good Morning! ☀️</Text>
      <Text className="text-lg text-gray-500 mb-10 text-center">How is your skin feeling today?</Text>

      <View className="flex-row flex-wrap justify-between gap-4 w-full px-4">
        {RATINGS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => handleSave(item.value)}
            className={`w-[45%] aspect-square items-center justify-center rounded-2xl bg-white shadow-sm border-2 ${selected === item.value ? 'border-brand-primary bg-orange-50' : 'border-transparent'}`}
          >
            <Text className="text-4xl mb-2">{item.label}</Text>
            <Text className="text-gray-600 font-medium">{item.text}</Text>
          </Pressable>
        ))}
      </View>

      <TouchableOpacity onPress={() => router.back()} className="mt-12">
        <Text className="text-gray-400 text-sm">Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}
