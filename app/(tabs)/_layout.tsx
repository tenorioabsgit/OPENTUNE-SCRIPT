import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import MiniPlayer from '../../src/components/MiniPlayer';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useLanguage } from '../../src/contexts/LanguageContext';

export default function TabLayout() {
  const { currentTrack } = usePlayer();
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.tabBarBackground,
            borderTopColor: 'transparent',
            height: Layout.tabBarHeight,
            paddingBottom: 6,
            paddingTop: 6,
          },
          tabBarActiveTintColor: Colors.textPrimary,
          tabBarInactiveTintColor: Colors.textInactive,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab.home'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: t('tab.search'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: t('tab.library'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      {currentTrack && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: Layout.tabBarHeight,
    left: 0,
    right: 0,
  },
});
