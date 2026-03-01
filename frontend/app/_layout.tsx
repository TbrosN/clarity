import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/components/useColorScheme";
import { InsightsProvider } from "@/contexts/InsightsContext";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { apiService } from "../services/ApiService";
import { getApiAuthToken } from "../services/AuthTokenService";

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

  if (!loaded) {
    return null;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <RootLayoutNav />
    </ClerkProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { getToken, isSignedIn, isLoaded } = useAuth();

  // Warm backend as soon as app loads to reduce first real-request latency.
  useEffect(() => {
    apiService.healthCheck().catch((error) => {
      console.warn("Backend warm-up ping failed:", error);
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  // Set auth token when it changes
  useEffect(() => {
    const updateToken = async () => {
      if (!isLoaded || !isSignedIn) {
        apiService.setAuthToken(null);
        return;
      }

      const token = await getApiAuthToken(getToken);
      apiService.setAuthToken(token);
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone) {
          await apiService.updateTimezone(timezone);
        }
      } catch (error) {
        console.warn("Timezone sync failed:", error);
      }
    };

    updateToken();
  }, [getToken, isLoaded, isSignedIn]);

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <InsightsProvider>
        <Stack>
          <Stack.Screen name="sso-callback" options={{ headerShown: false }} />

          <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
            <Stack.Screen name="survey" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </InsightsProvider>
    </ThemeProvider>
  );
}
