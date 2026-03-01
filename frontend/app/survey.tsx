import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { saveDailyLog } from '../services/StorageService';

type SurveyQuestion = {
  id: string;
  field: string;
  title: string;
  subtitle?: string;
  type: 'time' | 'enum' | 'likert';
  options?: Array<{ value: string | number; emoji: string; label: string }>;
};

const SURVEYS = {
  beforeBed: {
    title: '🌙 Start of Evening Wind-down',
    subtitle: 'Evening check-in - 4 questions',
    questions: [
      {
        id: 'q1',
        field: 'sleepTime',
        title: 'When did you start your wind-down before bed?',
        type: 'enum',
        options: [
          { value: '1hr', emoji: '🧘', label: '1 hour+ before bed' },
          { value: '30mins', emoji: '🧘', label: '30-60 mins before bed' },
          { value: '<30mins', emoji: '🧘', label: '<30 mins before bed' },
        ],
      },
      {
        id: 'q2',
        field: 'lastMeal',
        title: 'When was your last meal?',
        type: 'enum',
        options: [
          { value: '4', emoji: '✨', label: '4+ hours before bed' },
          { value: '3', emoji: '🍽️', label: '3-4 hours before bed' },
          { value: '2', emoji: '🍕', label: '2-3 hours before bed' },
          { value: '1', emoji: '🥪', label: '<1 hour before bed' },
        ],
      },
      {
        id: 'q3',
        field: 'screensOff',
        title: 'When did you turn off screens?',
        subtitle: 'Phone, TV, computer',
        type: 'enum',
        options: [
          { value: '60', emoji: '✨', label: '1+ hours before bed' },
          { value: '30-60', emoji: '📺', label: '30-60 mins before bed' },
          { value: '<30mins', emoji: '📱', label: '<30 mins before bed' },
        ],
      },
      {
        id: 'q4',
        field: 'caffeine',
        title: 'When did you last have caffeine?',
        type: 'enum',
        options: [
          { value: 'before12', emoji: '☕', label: 'None or before 12 PM' },
          { value: '12-2pm', emoji: '🕐', label: '12–2 PM' },
          { value: '2-6pm', emoji: '🕔', label: '2–6 PM' },
          { value: 'after6pm', emoji: '🌙', label: 'After 6 PM' },
        ],
      }
    ] as SurveyQuestion[],
  },
  afterWake: {
    title: '☀️ After Wake-Up',
    subtitle: 'Morning check-in - 2 questions',
    questions: [
      {
        id: 'q1',
        field: 'sleepiness',
        title: 'How sleepy do you feel right now?',
        type: 'likert',
        options: [
          { value: 1, emoji: '🥱', label: 'Extremely sleepy' },
          { value: 2, emoji: '😴', label: 'Very sleepy' },
          { value: 3, emoji: '😐', label: 'Neutral' },
          { value: 4, emoji: '🙂', label: 'Alert' },
          { value: 5, emoji: '✨', label: 'Very alert' },
        ],
      },
      {
        id: 'q2',
        field: 'morningLight',
        title: 'When did you get sunlight this morning?',
        subtitle: 'Planned or already completed',
        type: 'enum',
        options: [
          { value: '0-30mins', emoji: '☀️', label: '<30 mins after waking' },
          { value: '30-60mins', emoji: '☀️', label: '30-60 mins after waking' },
          { value: 'none', emoji: '☀️', label: 'No natural light' },
        ],
      },
    ] as SurveyQuestion[],
  },
};

export default function SurveyScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const surveyType = (params.type as 'beforeBed' | 'afterWake') || 'beforeBed';
  const survey = SURVEYS[surveyType];

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [timeValue, setTimeValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = survey.questions[currentStep];
  const progress = ((currentStep + 1) / survey.questions.length) * 100;

  const handleAnswer = async (value: string | number) => {
    if (isSubmitting) return;

    const newAnswers = { ...answers, [currentQuestion.field]: value };
    setAnswers(newAnswers);

    // If this is the last question, submit
    if (currentStep === survey.questions.length - 1) {
      setIsSubmitting(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        await saveDailyLog({
          date: today,
          ...newAnswers,
        });

        // Brief delay for visual feedback
        setTimeout(() => {
          router.back();
        }, 400);
      } catch (error) {
        console.error('Failed to save survey:', error);
        setIsSubmitting(false);
      }
    } else {
      // Move to next question
      setCurrentStep(currentStep + 1);
      setTimeValue('');
    }
  };

  const handleTimeSubmit = () => {
    if (timeValue.trim()) {
      handleAnswer(timeValue);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSkip = () => {
    if (currentStep < survey.questions.length - 1) {
      setCurrentStep(currentStep + 1);
      setTimeValue('');
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="pt-16 pb-6 px-6 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-4">
          <Pressable onPress={handleBack}>
            <Text className="text-2xl">←</Text>
          </Pressable>
          <Text className="text-gray-500 text-sm font-medium">
            {currentStep + 1} of {survey.questions.length}
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-[#FF6B4A] rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center px-6 py-8">
          {/* Question Header */}
          <View className="mb-12 items-center">
            <Text className="text-3xl font-bold text-gray-800 mb-2 text-center">
              {currentQuestion.title}
            </Text>
            {currentQuestion.subtitle && (
              <Text className="text-base text-gray-500 text-center">
                {currentQuestion.subtitle}
              </Text>
            )}
          </View>

          {/* Time Picker */}
          {currentQuestion.type === 'time' && (
            <View className="w-full max-w-md">
              {React.createElement('input', {
                type: 'time',
                value: timeValue,
                onChange: (e: any) => setTimeValue(e.target.value),
                onKeyDown: (e: any) => {
                  if (e.key === 'Enter' && timeValue) handleTimeSubmit();
                },
                autoFocus: true,
                style: {
                  width: '100%',
                  padding: '16px 24px',
                  fontSize: '28px',
                  textAlign: 'center' as const,
                  backgroundColor: '#f9fafb',
                  borderRadius: '16px',
                  border: '2px solid #e5e7eb',
                  marginBottom: '24px',
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#1f2937',
                },
              })}
              <Pressable
                onPress={handleTimeSubmit}
                disabled={!timeValue}
                className={`w-full py-4 rounded-2xl items-center ${
                  timeValue
                    ? 'bg-[#FF6B4A]'
                    : 'bg-gray-200'
                }`}
              >
                <Text className={`font-semibold text-lg ${
                  timeValue ? 'text-white' : 'text-gray-400'
                }`}>
                  {currentStep === survey.questions.length - 1 ? 'Finish' : 'Continue'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Enum Options */}
          {currentQuestion.type === 'enum' && (
            <View className="w-full flex-col gap-3">
              {currentQuestion.options?.map((option) => (
                <Pressable
                  key={String(option.value)}
                  onPress={() => handleAnswer(option.value)}
                  disabled={isSubmitting}
                  className="w-full py-6 px-6 flex-row items-center bg-white rounded-2xl shadow-sm border-2 border-gray-100"
                >
                  <Text className="text-3xl mr-4">{option.emoji}</Text>
                  <Text className="text-gray-700 font-semibold text-lg flex-1">
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Likert Scale */}
          {currentQuestion.type === 'likert' && (
            <View className="w-full flex-row flex-wrap justify-between gap-4 px-4">
              {currentQuestion.options?.map((option) => (
                <Pressable
                  key={String(option.value)}
                  onPress={() => handleAnswer(option.value)}
                  disabled={isSubmitting}
                  className="w-[30%] aspect-square items-center justify-center rounded-2xl bg-white shadow-md border-2 border-gray-100"
                >
                  <Text className="text-4xl mb-2">{option.emoji}</Text>
                  <Text className="text-gray-700 font-semibold text-center text-sm">
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Skip Button */}
          {currentQuestion.type !== 'time' && (
            <Pressable onPress={handleSkip} className="mt-12">
              <Text className="text-gray-400 text-sm">Skip this question</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
