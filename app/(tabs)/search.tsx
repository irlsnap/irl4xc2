import React, { useEffect, useState } from "react";
import { View, Button, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { router, useNavigation } from "expo-router";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebaseConfig"; // Firestore config
import { ThemedView } from "@/components/shared/ThemedView";
import { ThemedTextInput } from "@/components/shared/ThemedTextInput";
import { Ionicons } from "@expo/vector-icons"; // Import icons from Expo

interface User {
  uid: string;
  username: string;
  fname: string;
  lname: string;
}

export default function Search() {
  const navigation = useNavigation();
  const currentUser = auth.currentUser; // Get the currently logged-in user
  const [searchTerm, setSearchTerm] = useState<string>(""); // Input value for search
  const [users, setUsers] = useState<User[]>([]); // Fetched users
  const [addedFriends, setAddedFriends] = useState<{ [uid: string]: boolean }>({}); // To track added friends

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Function to fetch users from Firestore based on search term
  const searchUsers = async () => {
    if (!searchTerm.trim()) return; // Avoid empty searches

    if (!currentUser) return;

    const userList: User[] = [];

    // Search by username
    const usernameQuery = query(
      collection(db, "users"),
      where("username", ">=", searchTerm),
      where("username", "<=", searchTerm + "\uf8ff")
    );

    // Search by first name
    const fnameQuery = query(
      collection(db, "users"),
      where("fname", ">=", searchTerm),
      where("fname", "<=", searchTerm + "\uf8ff")
    );

    // Search by last name
    const lnameQuery = query(
      collection(db, "users"),
      where("lname", ">=", searchTerm),
      where("lname", "<=", searchTerm + "\uf8ff")
    );

    // Perform all queries simultaneously
    const [usernameSnapshot, fnameSnapshot, lnameSnapshot] = await Promise.all([
      getDocs(usernameQuery),
      getDocs(fnameQuery),
      getDocs(lnameQuery),
    ]);

    // Add results to the userList, avoiding duplicates
    const seen = new Set(); // To avoid duplicate users
    const friendsRef = doc(db, "users", currentUser.uid);
    const friendsDoc = await getDoc(friendsRef);
    const friendsData = friendsDoc.exists() ? friendsDoc.data().friends || {} : {};

    const isFriend = (uid: string) => friendsData[uid] === true;

    usernameSnapshot.forEach((doc) => {
      const userData = doc.data() as User;
      if (!seen.has(doc.id) && !isFriend(doc.id)) {
        seen.add(doc.id);
        userList.push({
          uid: doc.id,
          username: userData.username,
          fname: userData.fname,
          lname: userData.lname,
        });
      }
    });

    fnameSnapshot.forEach((doc) => {
      const userData = doc.data() as User;
      if (!seen.has(doc.id) && !isFriend(doc.id)) {
        seen.add(doc.id);
        userList.push({
          uid: doc.id,
          username: userData.username,
          fname: userData.fname,
          lname: userData.lname,
        });
      }
    });

    lnameSnapshot.forEach((doc) => {
      const userData = doc.data() as User;
      if (!seen.has(doc.id) && !isFriend(doc.id)) {
        seen.add(doc.id);
        userList.push({
          uid: doc.id,
          username: userData.username,
          fname: userData.fname,
          lname: userData.lname,
        });
      }
    });

    setUsers(userList);
  };

  // Assume that 'getFriendToken' is a function that fetches the friend's notification token from Firestore
const getFriendToken = async (friendUid: string) => {
  const friendDoc = doc(db, 'users', friendUid);
  const friendSnapshot = await getDoc(friendDoc);
  return friendSnapshot.data()?.expoPushToken || null; // Assuming expoPushToken is stored in user data
};

const sendFriendRequestNotification = async (friendUid: string) => {
  try {
    // Fetch the friend's Expo push token
    const friendToken = await getFriendToken(friendUid);

    if (friendToken) {
      // Construct the notification message
      const message = {
        to: friendToken,
        sound: 'default',
        title: 'Friend Request 👀',
        body: 'You have a new friend request!',
        data: { friendUid }, // You can pass custom data with the notification
      };

      // Send the notification using Expo's push notification service
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      console.log('Friend request notification sent successfully!');
    } else {
      console.log('Friend does not have a registered Expo push token.');
    }
  } catch (error) {
    console.error('Error sending friend request notification:', error);
  }
};

// Function to add a friend and send a notification
const handleAddFriend = async (otherUser: User) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    // Update other user's "friends" field
    const otherUserRef = doc(db, 'users', otherUser.uid);
    await updateDoc(otherUserRef, {
      [`friends.${currentUser.uid}`]: false, // Mark as not yet accepted (pending)
    });

    // Mark the friend request as sent locally
    setAddedFriends((prev) => ({ ...prev, [otherUser.uid]: true }));

    // Send a notification to the friend about the friend request
    await sendFriendRequestNotification(otherUser.uid);
  } catch (error) {
    console.error('Error adding friend and sending notification:', error);
  }
};

  return (
    <ThemedView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/misc/friends')}>
          <Ionicons name="people-outline" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/misc/friendrequests')} style={styles.friendRequests}>
          <Text style={styles.friendRequestsText}>Friend Requests</Text>
          <Ionicons name="chevron-forward-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <ThemedTextInput
        placeholder="Search by username or name"
        text={searchTerm}
        onChangeText={setSearchTerm}
        style={styles.searchInput}
      />

      {/* Search Button */}
      <Button title="Search" onPress={searchUsers} />

      {/* Results */}
      {users.length > 0 ? (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <View style={styles.userContainer}>
              <Text style={styles.userName}>
                {item.fname} {item.lname} (@{item.username})
              </Text>
              <TouchableOpacity
                style={[
                  styles.addFriendButton,
                  addedFriends[item.uid] && styles.addedFriendButton,
                ]}
                onPress={() => handleAddFriend(item)}
                disabled={addedFriends[item.uid]} // Disable the button if already added
              >
                <Text style={styles.addFriendText}>
                  {addedFriends[item.uid] ? "Request Sent" : "Add Friend"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ marginHorizontal: "5%" }}
        />
      ) : (
        <Text style={styles.noResultsText}>No results found</Text>
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "5%",
    marginLeft: "2%",
  },
  friendRequests: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendRequestsText: {
    color: "white",
    marginRight: 8,
    fontSize: 16,
  },
  searchInput: {
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: "4%",
  },
  userContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  userName: {
    fontSize: 16,
    color: "#fff",
  },
  addFriendButton: {
    backgroundColor: "#3797EF",
    padding: 10,
    borderRadius: 6,
  },
  addedFriendButton: {
    backgroundColor: "transparent", // Make button transparent after request sent
    borderWidth: 1,
    borderColor: "#3797EF",
  },
  addFriendText: {
    color: "white",
    fontWeight: "bold",
  },
  noResultsText: {
    marginTop: 20,
    textAlign: "center",
    color: "#fff",
  },
});
