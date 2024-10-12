import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db, auth } from "@/app/firebaseConfig"; // Firestore config
import { Ionicons } from "@expo/vector-icons"; // Import icons from Expo
import { ThemedView } from "@/components/shared/ThemedView";
import { ThemedText } from "@/components/shared/ThemedText";

interface User {
  uid: string;
  username: string;
  streaks: number;
  reactionUids: string[];
  emojis: string[];
}

export default function Leaderboard() {
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    if (!currentUser) return;

    const leaderboardUsers: User[] = [];

    // Get current user's friends
    const friendsRef = doc(db, "users", currentUser.uid);
    const friendsDoc = await getDoc(friendsRef);
    const friendsData = friendsDoc.exists() ? friendsDoc.data().friends || {} : {};

    const friendsUids = Object.keys(friendsData).filter((uid) => friendsData[uid] === true);

    // Include current user UID in the list
    const allUids = [...friendsUids, currentUser.uid];

    // Fetch data for each user (friends and current user)
    const userPromises = allUids.map(async (uid) => {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        return {
          uid,
          username: userData.username,
          streaks: userData.streaks || 0,
          reactionUids: userData.reactionUids || [],
          emojis: userData.emojis || [],
        };
      }
      return null;
    });

    const fetchedUsers = await Promise.all(userPromises);
    const filteredUsers = fetchedUsers.filter((user) => user !== null) as User[];

    // Sorting logic with tiebreakers: streaks > reactions > emojis
    const sortedList = filteredUsers.sort((a, b) => {
        if (b.streaks === a.streaks) {
          if (b.reactionUids.length === a.reactionUids.length) {
            return b.emojis.length - a.emojis.length; // Compare emojis if streaks and reactions are tied
          }
          return b.reactionUids.length - a.reactionUids.length; // Compare reactions if streaks are tied
        }
        return b.streaks - a.streaks; // Compare streaks primarily
      });
    
    setUsers(sortedList);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={{marginTop: "35%"}}>Leaderboard</ThemedText>
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        initialNumToRender={8}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.userContainer}>
            <View style={styles.userInfo}>
              <ThemedText type="subtitle">@{item.username}</ThemedText>
              <ThemedText type="subtitle">
                🔥 {item.streaks} {/* Display streak count with fire emoji */}
              </ThemedText>
            </View>
            <View style={styles.statsContainer}>
              <ThemedText type="defaultSemiBold">
                Reactions: {item.reactionUids.length} {/* Length of reactionUids */}
              </ThemedText>
              <ThemedText type="defaultSemiBold">
                Emojis: {item.emojis.length} {/* Length of emojis */}
              </ThemedText>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000",
      padding: 16,
      alignItems: "center", // Center the content horizontally
    },
    userContainer: {
      width: "90%", // Optional, ensure the userContainer doesn't stretch too wide
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#ddd",
      marginLeft: '5%'
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "center",
    },
    username: {
      fontSize: 18,
      color: "#fff",
      marginRight: 10,
    },
    streaks: {
      fontSize: 16,
      color: "#ff4500", // Fire color for streaks
    },
    statsContainer: {
      flexDirection: "column",
      alignItems: "flex-end",
    },
    reactions: {
      color: "#fff",
      fontSize: 14,
    },
    emojis: {
      color: "#fff",
      fontSize: 14,
    },
    listContainer: {
      marginTop: "15%",
      paddingBottom: "50%",
    },
  });  