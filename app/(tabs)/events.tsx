import { Link, useNavigation } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import ComingSoonPage from "../misc/comingsoon";

export default function Events() {
  const navigation = useNavigation();

    useEffect(() => {
        navigation.setOptions({ headerShown: false });
      }, [navigation]);

  return (
    <ComingSoonPage/>
    // <View
    //   style={{
    //     flex: 1,
    //     justifyContent: "center",
    //     alignItems: "center",
    //   }}
    // >
    //   <Text>Edit app/events.tsx to edit this screen.</Text>
    //   <Link href={"/auth/login"}>hello</Link>
    // </View>
  );
}
