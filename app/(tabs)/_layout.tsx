import { Tabs, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Image } from 'expo-image';  // <-- use expo-image
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { View, StyleSheet } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const [userPfp, setUserPfp] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const loadUserPfp = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data?.pfp) {
            setUserPfp(data.pfp);
          }
        }
      } catch (error) {
        console.log('Error fetching user pfp:', error);
      }
    };
    loadUserPfp();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: Colors.dark.background },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#fff',
        tabBarLabel: () => null,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'videocam' : 'videocam-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/** Profile tab with expo-image for caching */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) =>
            userPfp ? (
              <Image
                source={{ uri: userPfp }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: focused ? 2 : 0,
                  borderColor: color,
                }}
                // This tells expo-image to cache in memory and on disk:
                cachePolicy="memory-disk"
                // Optionally specify how the image is resized/clipped:
                contentFit="cover"
                // You can also provide a tiny placeholder or a local fallback image
              />
            ) : (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
            ),
        }}
      />
    </Tabs>
  );
}