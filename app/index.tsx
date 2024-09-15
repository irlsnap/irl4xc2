import { router } from "expo-router";
import Login from "./auth/login";
import { auth } from "./firebaseConfig";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

export default function Index() {
  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) router.replace("/(tabs)/")
    });
  }, []);

  return (
    <Login/>
  );
}
