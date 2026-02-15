import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/components/useColorScheme";
import * as Notifications from "expo-notifications";
import {
  requestPermissions,
  scheduleDailyPrompts,
} from "../services/NotificationService";
import { ClerkProvider, useAuth, SignedIn, SignedOut } from "@clerk/clerk-expo";
import { apiService } from "../services/ApiService";
import { AuthScreen } from "@/components/ClerkAuth";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from automatic hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
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

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const screen = data.screen;
        const type = data.type;

        if (screen === "survey") {
          router.push(type ? `/survey?type=${type}` : "/survey");
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
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <RootLayoutNav />
    </ClerkProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { getToken, isSignedIn } = useAuth();

  // Set auth token when it changes
  useEffect(() => {
    const updateToken = async () => {
      if (!isSignedIn) {
        apiService.setAuthToken(null);
        return;
      }

      let token: string | null = null;
      try {
        token = await getToken({ template: "supabase" });
      } catch {
        token = null;
      }

      if (!token) {
        try {
          token = await getToken();
        } catch {
          token = null;
        }
      }

      apiService.setAuthToken(token);
    };
    updateToken();
  }, [getToken, isSignedIn]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SignedIn>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>
      </SignedIn>
      <SignedOut>
        <AuthScreen />
      </SignedOut>
    </ThemeProvider>
  );
}
