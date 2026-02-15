import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';

/**
 * Simplified authentication using Clerk hooks with Tailwind styling.
 * Uses redirect-based OAuth for better iOS Safari/PWA compatibility.
 */
export function AuthScreen() {
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buildRedirectUrl = (path: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return new URL(path, window.location.origin).toString();
    }
    return path;
  };

  const onOAuthPress = async (strategy: 'oauth_google' | 'oauth_github' | 'oauth_apple', provider: string) => {
    if (!signInLoaded || !signIn) return;

    try {
      setLoading(true);
      setError('');
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: buildRedirectUrl('/sso-callback'),
        redirectUrlComplete: buildRedirectUrl('/'),
      });
    } catch (err: any) {
      console.error(`OAuth redirect error (${provider}):`, err);
      setError(`Failed to sign in with ${provider}`);
      setLoading(false);
    }
  };

  const onSignInPress = async () => {
    if (!signInLoaded) return;
    try {
      setLoading(true);
      setError('');
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const onSignUpPress = async () => {
    if (!signUpLoaded) return;
    try {
      setLoading(true);
      setError('');
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyPress = async () => {
    if (!signUpLoaded) return;
    try {
      setLoading(true);
      setError('');
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActiveSignUp({ session: result.createdSessionId });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <View className="flex-1 justify-center items-center p-5 bg-[#F7F7F7]">
        <Text className="text-5xl font-bold text-[#2C3E50] mb-2">✨ Clarity</Text>
        <Text className="text-lg text-gray-500 mb-8">Enter the code sent to {email}</Text>
        <TextInput
          className="w-full max-w-[400px] h-[52px] border border-gray-200 rounded-xl px-4 mb-4 text-base bg-white"
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
        />
        {error ? <Text className="text-red-500 text-sm mb-3 text-center">{error}</Text> : null}
        <TouchableOpacity
          className="w-full max-w-[400px] h-[52px] bg-blue-500 rounded-xl justify-center items-center mt-2"
          onPress={onVerifyPress}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Verify</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setPendingVerification(false); setCode(''); }}>
          <Text className="mt-4 text-blue-500 text-[15px]">← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center p-5 bg-[#F7F7F7]">
      <Text className="text-5xl font-bold text-[#2C3E50] mb-2">✨ Clarity</Text>
      <Text className="text-lg text-gray-500 mb-8">
        {mode === 'signin' ? 'Welcome back' : 'Start your journey'}
      </Text>

      {/* OAuth Buttons */}
      <TouchableOpacity
        className="w-full max-w-[400px] h-[52px] bg-white rounded-xl border border-gray-200 flex-row justify-center items-center mb-3"
        onPress={() => onOAuthPress('oauth_google', 'Google')}
        disabled={loading}
      >
        <Text className="text-xl mr-3">🔍</Text>
        <Text className="text-gray-700 text-base font-semibold">Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="w-full max-w-[400px] h-[52px] bg-white rounded-xl border border-gray-200 flex-row justify-center items-center mb-3"
        onPress={() => onOAuthPress('oauth_github', 'GitHub')}
        disabled={loading}
      >
        <Text className="text-xl mr-3">🐙</Text>
        <Text className="text-gray-700 text-base font-semibold">Continue with GitHub</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="w-full max-w-[400px] h-[52px] bg-white rounded-xl border border-gray-200 flex-row justify-center items-center mb-3"
        onPress={() => onOAuthPress('oauth_apple', 'Apple')}
        disabled={loading}
      >
        <Text className="text-xl mr-3">🍎</Text>
        <Text className="text-gray-700 text-base font-semibold">Continue with Apple</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View className="w-full max-w-[400px] flex-row items-center my-6">
        <View className="flex-1 h-[1px] bg-gray-200" />
        <Text className="mx-4 text-gray-400 text-sm">or</Text>
        <View className="flex-1 h-[1px] bg-gray-200" />
      </View>

      {/* Email/Password Form */}
      <TextInput
        className="w-full max-w-[400px] h-[52px] border border-gray-200 rounded-xl px-4 mb-4 text-base bg-white"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        className="w-full max-w-[400px] h-[52px] border border-gray-200 rounded-xl px-4 mb-4 text-base bg-white"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      {error ? <Text className="text-red-500 text-sm mb-3 text-center">{error}</Text> : null}

      <TouchableOpacity
        className="w-full max-w-[400px] h-[52px] bg-blue-500 rounded-xl justify-center items-center mt-2"
        onPress={mode === 'signin' ? onSignInPress : onSignUpPress}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white text-base font-semibold">
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text className="mt-4 text-blue-500 text-[15px]">
          {mode === 'signin' ? 'Create account' : 'Already have an account?'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
