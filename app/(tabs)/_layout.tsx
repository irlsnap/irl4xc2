import { Tabs, useNavigation } from 'expo-router';
import React, { useEffect } from 'react';

import { MaterialIcons } from '@expo/vector-icons';
import { Octicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {backgroundColor: Colors.dark.background},
        tabBarActiveBackgroundColor: Colors.dark.background,
        tabBarInactiveBackgroundColor: Colors.dark.background,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarLabel:() => {return null},
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Octicons name='home' size={24} color={"#fff"} />
            // <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Octicons name='megaphone' size={24} color={"#fff"} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name='add-to-photos' size={24} color={"#fff"} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Octicons name='search' size={24} color={"#fff"} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Octicons name='person' size={24} color={"#fff"} />
          ),
        }}
      />
    </Tabs>
  );
}
