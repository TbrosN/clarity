import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { saveDailyLog } from '../services/StorageService';

export default function WindDownScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [logData, setLogData] = useState<any>({});

  const today = new Date().toISOString().split('T')[0];

  const handleNext = async (key: string, value: any) => {
    const newData = { ...logData, [key]: value };
    setLogData(newData);

    if (step < 2) {
      setStep(step + 1);
    } else {
      // Final save
      await saveDailyLog({ date: today, ...newData, bedtime: new Date().toISOString() });
      router.push('../');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0: // Sugar / Diet
        return (
          <View className="items-center w-full">
            <Text className="text-2xl font-bold text-white mb-8 text-center">Did you nourish your skin today?</Text>
            <TouchableOpacity
              className="w-full bg-[#A8D5BA] py-5 rounded-2xl mb-4 items-center shadow-lg"
              onPress={() => handleNext('sugar', 'clean')}
            >
              <Text className="text-[#2C3E50] text-xl font-bold">🥗 Yes, kept it clean!</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-full bg-[#34495E] py-5 rounded-2xl items-center border border-gray-600"
              onPress={() => handleNext('sugar', 'treat')}
            >
              <Text className="text-gray-300 text-lg">🍪 Enjoyed a treat</Text>
            </TouchableOpacity>
          </View>
        );
      case 1: // Stress
        return (
          <View className="items-center w-full">
            <Text className="text-2xl font-bold text-white mb-8 text-center">How is your energy?</Text>
            <View className="flex-row justify-between w-full gap-4">
              <TouchableOpacity
                className="flex-1 bg-[#81CA9D] py-8 rounded-2xl items-center"
                onPress={() => handleNext('stress', 1)}
              >
                <Text className="text-4xl mb-2">🧘‍♀️</Text>
                <Text className="text-white font-bold">Zen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-[#E74C3C] py-8 rounded-2xl items-center"
                onPress={() => handleNext('stress', 5)}
              >
                <Text className="text-4xl mb-2">🤯</Text>
                <Text className="text-white font-bold">Frazzled</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="w-full mt-4 py-4 rounded-xl items-center"
              onPress={() => handleNext('stress', 3)}
            >
              <Text className="text-gray-400">Somewhere in between</Text>
            </TouchableOpacity>
          </View>
        );
      case 2: // Bedtime
        return (
          <View className="items-center w-full">
            <Text className="text-2xl font-bold text-white mb-2 text-center">Ready to recharge?</Text>
            <Text className="text-gray-400 mb-10 text-center">Early sleep = Glowing skin.</Text>

            <TouchableOpacity
              className="w-64 h-64 rounded-full bg-[#FF9F87] items-center justify-center shadow-2xl border-4 border-[#FFB09C]"
              onPress={() => handleNext('cleansed', true)} // Implicitly logs bedtime too
            >
              <Text className="text-white text-3xl font-bold">Sleep Now 💤</Text>
            </TouchableOpacity>
          </View>
        );
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-[#2C3E50] p-6">
      {renderStep()}

      <TouchableOpacity onPress={() => router.back()} className="absolute bottom-10">
        <Text className="text-gray-500 text-sm">Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
