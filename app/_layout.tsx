import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack initialRouteName="auth/">
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/forgotpassword" />
      <Stack.Screen name="auth/signup" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="misc/friendrequests" options={{ headerShown: false }} />
      <Stack.Screen name="misc/friends" options={{ headerShown: false }} />
      <Stack.Screen name="misc/friendprofile" options={{ headerShown: false }} />
      <Stack.Screen name="misc/reactionvideo" options={{ headerShown: false }} />
    </Stack>
  );
}
