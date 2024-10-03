import { router, useNavigation } from "expo-router";
import Login from "./auth/login";
import { auth } from "./firebaseConfig";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import registerForPushNotificationsAsync from "./notifs";
import * as Notifications from 'expo-notifications';
import { ActivityIndicator, Platform, View, StyleSheet } from "react-native";
import { Image } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function Index() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );

  const navigation = useNavigation();


  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      await registerForPushNotificationsAsync();
      if (Platform.OS === 'android') {
        Notifications.getNotificationChannelsAsync().then(value => setChannels(value ?? []));
      }
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        setNotification(notification);
      });
  
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log(response);
      });

      if (user) router.replace("/(tabs)/");
      else router.replace("/auth/login");
  
      return () => {
        notificationListener.current &&
          Notifications.removeNotificationSubscription(notificationListener.current);
        responseListener.current &&
          Notifications.removeNotificationSubscription(responseListener.current);
      };
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image
        source={require('@/assets/images/app_logo_transparent.png')}
        style={styles.logo}
      />
      
      {/* Loading Spinner */}
      <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000', // Set your preferred background color
  },
  logo: {
    width: "60%", // Adjust width relative to screen size
    height: "50%", // Adjust height relative to screen size
    marginBottom: 20,
  },
  spinner: {
    marginTop: 20,
  },
});