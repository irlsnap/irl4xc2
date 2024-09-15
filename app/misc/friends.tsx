import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebaseConfig"; // Firestore config
import { ThemedView } from "@/components/shared/ThemedView";
import { Ionicons } from "@expo/vector-icons"; // Import icons from Expo
import { router } from "expo-router";

interface User {
  uid: string;
  username: string;
  fname: string;
  lname: string;
}

export default function Friends() {
  const currentUser = auth.currentUser; // Get the current user
  const [friends, setFriends] = useState<User[]>([]); // Store the list of friends

  useEffect(() => {
    // Fetch friends on component mount
    fetchFriends();
  }, []);

  // Fetch the current user's friends from Firestore
  const fetchFriends = async () => {
    if (!currentUser) return;

    const currentUserRef = doc(db, "users", currentUser.uid);
    const currentUserDoc = await getDoc(currentUserRef);

    if (currentUserDoc.exists()) {
      const friendsList: User[] = [];
      const friendsData = currentUserDoc.data().friends || {};

      // Fetch friends whose status is `true` (friendship accepted)
      for (const [uid, accepted] of Object.entries(friendsData)) {
        if (accepted) {
          const friendDoc = await getDoc(doc(db, "users", uid));
          if (friendDoc.exists()) {
            const friendData = friendDoc.data() as User;
            friendsList.push({
              uid: friendDoc.id,
              username: friendData.username,
              fname: friendData.fname,
              lname: friendData.lname,
            });
          }
        }
      }

      setFriends(friendsList);
    }
  };

  // Render individual friend item
  const renderFriendItem = ({ item }: { item: User }) => (
    <View style={styles.friendContainer}>
      <Text style={styles.friendName}>
        {item.fname} {item.lname} (@{item.username})
      </Text>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="arrow-back" size={28} color="white" onPress={() => router.navigate('/(tabs)/search')} />
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      {/* Friend List */}
      {friends.length > 0 ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriendItem}
          contentContainerStyle={{ marginHorizontal: 16 }}
        />
      ) : (
        <Text style={styles.noFriendsText}>You have no friends yet.</Text>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    marginLeft: 16,
  },
  friendContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  friendName: {
    fontSize: 18,
    color: "#fff",
  },
  noFriendsText: {
    textAlign: "center",
    color: "#fff",
    marginTop: 20,
  },
});
