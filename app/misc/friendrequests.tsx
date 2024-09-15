import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
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

export default function FriendRequests() {
  const currentUser = auth.currentUser; // Get the current user
  const [friendRequests, setFriendRequests] = useState<User[]>([]); // Store incoming friend requests

  useEffect(() => {
    // Fetch friend requests on component mount
    fetchFriendRequests();
  }, []);

  // Fetch friend requests from Firestore
  const fetchFriendRequests = async () => {
    if (!currentUser) return;

    const currentUserRef = doc(db, "users", currentUser.uid);
    const currentUserDoc = await getDoc(currentUserRef);

    if (currentUserDoc.exists()) {
      const friends = currentUserDoc.data().friends || {};
      const requests: User[] = [];

      // Check for incoming friend requests (where the value is `false`)
      for (const [uid, accepted] of Object.entries(friends)) {
        if (!accepted) {
          const friendDoc = await getDoc(doc(db, "users", uid));
          if (friendDoc.exists()) {
            const friendData = friendDoc.data() as User;
            requests.push({
              uid: friendDoc.id,
              username: friendData.username,
              fname: friendData.fname,
              lname: friendData.lname,
            });
          }
        }
      }

      setFriendRequests(requests);
    }
  };

  // Accept a friend request
  const handleAcceptFriend = async (friend: User) => {
    if (!currentUser) return;

    try {
      // Update current user's "friends" field to true (accepted)
      const currentUserRef = doc(db, "users", currentUser.uid);
      await updateDoc(currentUserRef, {
        [`friends.${friend.uid}`]: true,
      });

      // Update friend's "friends" field to true (accepted)
      const friendRef = doc(db, "users", friend.uid);
      await updateDoc(friendRef, {
        [`friends.${currentUser.uid}`]: true,
      });

      // Remove the accepted request from the local state
      setFriendRequests((prev) => prev.filter((req) => req.uid !== friend.uid));
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="arrow-back" size={28} color="white" onPress={() => router.navigate('/(tabs)/search')} />
        <Text style={styles.headerTitle}>Friend Requests</Text>
      </View>

      {/* Friend Request List */}
      {friendRequests.length > 0 ? (
        <FlatList
          data={friendRequests}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <View style={styles.requestContainer}>
              <Text style={styles.userName}>
                {item.fname} {item.lname} (@{item.username})
              </Text>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptFriend(item)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <Text style={styles.noRequestsText}>No friend requests found</Text>
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
  requestContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    marginHorizontal: '5%'
  },
  userName: {
    fontSize: 16,
    color: "#fff",
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  noRequestsText: {
    marginTop: 20,
    textAlign: "center",
    color: "#fff",
  },
});
