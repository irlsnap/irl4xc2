import { router } from "expo-router";
import Login from "./auth/login";
import { auth } from "./firebaseConfig";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import registerForPushNotificationsAsync from "./notifs";
import * as Notifications from 'expo-notifications';
import { Platform } from "react-native";

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
  
      return () => {
        notificationListener.current &&
          Notifications.removeNotificationSubscription(notificationListener.current);
        responseListener.current &&
          Notifications.removeNotificationSubscription(responseListener.current);
      };
    });
  }, []);

  return (
    <Login/>
  );
}