import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/contexts/AuthContext';
import { PlayerProvider } from '../src/contexts/PlayerContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { Colors } from '../src/constants/Colors';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PlayerProvider>
          <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="player"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="playlist/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="upload" options={{ headerShown: false }} />
        </Stack>
        </PlayerProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
