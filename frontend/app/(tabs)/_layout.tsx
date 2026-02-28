import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={20} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1F2937',
        tabBarInactiveTintColor: '#9AA1AD',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          height: 66,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 8 : 10,
          backgroundColor: '#FCFCFD',
          borderTopColor: '#E7EAF0',
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Clarity',
          tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="home" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="modal"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="cog" color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
