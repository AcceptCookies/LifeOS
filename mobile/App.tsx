import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { setUnauthCallback } from './src/api';
import AuthScreen from './src/screens/AuthScreen';
import HabitsScreen from './src/screens/HabitsScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import PantryScreen from './src/screens/PantryScreen';

type TabKey = 'habits' | 'workout' | 'pantry' | 'shop' | 'recipes';

const TABS: { key: TabKey; icon: string }[] = [
  { key: 'habits',  icon: 'activity'      },
  { key: 'workout', icon: 'zap'           },
  { key: 'pantry',  icon: 'coffee'        },
  { key: 'shop',    icon: 'shopping-cart' },
  { key: 'recipes', icon: 'book-open'     },
];

function TabBar({ active, onPress }: { active: TabKey; onPress: (k: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[S.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map(({ key, icon }) => (
        <TouchableOpacity key={key} style={S.tabBtn} onPress={() => onPress(key)} activeOpacity={0.7}>
          <Feather name={icon as any} size={24} color={active === key ? '#22c55e' : '#363636'} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AppInner() {
  const [authState, setAuthState] = useState<'loading' | 'authed' | 'unauthed'>('loading');
  const [activeTab, setActiveTab] = useState<TabKey>('habits');

  useEffect(() => {
    SecureStore.getItemAsync('lifeos_token').then(t => {
      setAuthState(t ? 'authed' : 'unauthed');
    });
    setUnauthCallback(() => setAuthState('unauthed'));
  }, []);

  if (authState === 'loading') {
    return (
      <View style={S.centered}>
        <Text style={S.loadingText}>LifeOS</Text>
      </View>
    );
  }

  if (authState === 'unauthed') {
    return <AuthScreen onAuth={() => setAuthState('authed')} />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'habits':  return <HabitsScreen />;
      case 'workout': return <WorkoutScreen />;
      default:        return <PantryScreen activeTab={activeTab} />;
    }
  };

  return (
    <View style={S.root}>
      <View style={S.content}>{renderScreen()}</View>
      <TabBar active={activeTab} onPress={setActiveTab} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppInner />
    </SafeAreaProvider>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { flex: 1 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f0f0f',
  },
  loadingText: {
    color: '#444', fontSize: 20, fontFamily: 'Courier New',
    fontWeight: '700', letterSpacing: 5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#080808',
    borderTopWidth: 1,
    borderTopColor: '#161616',
  },
  tabBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 14, paddingBottom: 6,
  },
});
