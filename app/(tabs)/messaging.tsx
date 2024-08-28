import { Link, useNavigation } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function Messaging() {
  const navigation = useNavigation();

    useEffect(() => {
        navigation.setOptions({ headerShown: false });
      }, [navigation]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edit app/Messaging.tsx to edit this screen.</Text>
      <Link href={"/auth/login"}>hello</Link>
    </View>
  );
}
