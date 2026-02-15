import { useClerk } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, Platform } from 'react-native';

export default function SsoCallbackScreen() {
  const clerk = useClerk();
  const [error, setError] = useState('');

  const buildRedirectUrl = (path: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return new URL(path, window.location.origin).toString();
    }
    return path;
  };

  useEffect(() => {
    const completeAuth = async () => {
      try {
        await clerk.handleRedirectCallback({
          signInUrl: '/sign-in',
          signUpUrl: '/sign-in',
          signInFallbackRedirectUrl: buildRedirectUrl('/'),
          signUpFallbackRedirectUrl: buildRedirectUrl('/'),
        });
      } catch (err: any) {
        console.error('SSO callback error:', err);
        setError(err?.errors?.[0]?.message || 'Unable to complete sign-in. Please try again.');
      }
    };

    completeAuth();
  }, [clerk]);

  return (
    <View className="flex-1 items-center justify-center bg-[#F7F7F7] px-6">
      {error ? (
        <Text className="text-red-500 text-center text-base">{error}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-600 text-base">Completing sign-in...</Text>
        </>
      )}
    </View>
  );
}
