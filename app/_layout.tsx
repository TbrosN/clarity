import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import InstallPWA from '@/components/InstallPWA';
import { useColorScheme } from '@/components/useColorScheme';
import * as Notifications from 'expo-notifications';
import { requestPermissions, scheduleDailyPrompts } from '../services/NotificationService';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from automatic hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Notification Setup
  useEffect(() => {
    async function setupNotifications() {
      const granted = await requestPermissions();
      if (granted) {
        await scheduleDailyPrompts();
      }
    }

    setupNotifications();

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data.screen;
      if (screen === 'check-in') {
        router.push('/check-in');
      } else if (screen === 'wind-down') {
        router.push('/wind-down');
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <>
      <RootLayoutNav />
      {Platform.OS === 'web' && <InstallPWA />}
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
