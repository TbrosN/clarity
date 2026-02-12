import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export type ReportOption = {
  value: number;
  emoji: string;
  label: string;
};

export type QuickReportProps = {
  title: string;
  subtitle?: string;
  options: ReportOption[];
  onSubmit: (value: number) => Promise<void> | void;
  onSkip?: () => void;
  layout?: 'grid' | 'horizontal' | 'vertical';
};

export default function QuickReport({
  title,
  subtitle,
  options,
  onSubmit,
  onSkip,
  layout = 'grid'
}: QuickReportProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async (value: number) => {
    if (isSubmitting) return;
    
    setSelected(value);
    setIsSubmitting(true);
    
    try {
      await onSubmit(value);
      
      // Brief delay for visual feedback, then navigate back
      setTimeout(() => {
        router.back();
      }, 400);
    } catch (error) {
      console.error('Failed to submit:', error);
      setIsSubmitting(false);
      setSelected(null);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      router.back();
    }
  };

  const getLayoutClasses = () => {
    switch (layout) {
      case 'horizontal':
        return 'flex-row justify-between gap-2';
      case 'vertical':
        return 'flex-col gap-3 w-full';
      case 'grid':
      default:
        return 'flex-row flex-wrap justify-between gap-4';
    }
  };

  const getItemClasses = () => {
    switch (layout) {
      case 'horizontal':
        return 'flex-1 aspect-square min-w-[60px]';
      case 'vertical':
        return 'w-full py-6';
      case 'grid':
      default:
        return options.length <= 3 ? 'w-[30%] aspect-square' : 'w-[45%] aspect-square';
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      {/* Header */}
      <View className="mb-12 items-center">
        <Text className="text-3xl font-bold text-gray-800 mb-2 text-center">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-base text-gray-500 text-center">
            {subtitle}
          </Text>
        )}
      </View>

      {/* Options */}
      <View className={`w-full px-4 ${getLayoutClasses()}`}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option.value)}
            disabled={isSubmitting}
            className={`${getItemClasses()} items-center justify-center rounded-2xl bg-white shadow-md border-2 ${
              selected === option.value
                ? 'border-[#FF6B4A] bg-[#FFF5F3]'
                : 'border-gray-100'
            }`}
          >
            <Text className="text-4xl mb-2">{option.emoji}</Text>
            <Text className="text-gray-700 font-semibold text-center">
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Skip Button */}
      <Pressable onPress={handleSkip} className="mt-12">
        <Text className="text-gray-400 text-sm">Skip for now</Text>
      </Pressable>
    </View>
  );
}
