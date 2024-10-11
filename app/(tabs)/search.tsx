import React, { useEffect, useState } from "react";
import { View, Button, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { router, useNavigation } from "expo-router";
import { collection, query, getDocs, doc, getDoc, updateDoc, where } from "firebase/firestore";
import { db, auth } from "@/app/firebaseConfig";
import { ThemedView } from "@/components/shared/ThemedView";
import { ThemedTextInput } from "@/components/shared/ThemedTextInput";
import { Ionicons } from "@expo/vector-icons";

interface User {
  uid: string;
  username: string;
  fname: string;
  lname: string;
  friends?: { [uid: string]: boolean }; // Optional 'friends' field
  friendsCount: number; // Include friends count in the interface
}

export default function Search() {
  const navigation = useNavigation();
  const currentUser = auth.currentUser;
  const [searchTerm, setSearchTerm] = useState<string>(""); // Input value for search
  const [users, setUsers] = useState<User[]>([]); // Fetched users
  const [addedFriends, setAddedFriends] = useState<{ [uid: string]: boolean }>({}); // Track added friends

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    // Fetch all users when the component mounts
    fetchAllUsers();
  }, [navigation]);

// Function to fetch all users and their friend counts
const fetchAllUsers = async () => {
  if (!currentUser) return;

  const userList: User[] = [];
  const seen = new Set(); // To avoid duplicate users

  // Get current user's friends from Firestore
  const friendsRef = doc(db, "users", currentUser.uid);
  const friendsDoc = await getDoc(friendsRef);
  const friendsData = friendsDoc.exists() ? friendsDoc.data().friends || {} : {};

  // Helper function to check if a user is already a friend
  const isFriend = (uid: string) => friendsData[uid] === true;

  // Query to fetch all users
  const allUsersQuery = query(collection(db, "users"));
  const userSnapshot = await getDocs(allUsersQuery);

  // For each user, retrieve their data and friend count, excluding friends and current user
  for (const userDoc of userSnapshot.docs) {
    const userData = userDoc.data() as User;
    const friendsCount = userData.friends ? Object.keys(userData.friends).length : 0;

    if (!seen.has(userDoc.id) && !isFriend(userDoc.id) && userDoc.id !== currentUser.uid) {
      seen.add(userDoc.id); // Track seen users
      userList.push({
        uid: userDoc.id,
        username: userData.username,
        fname: userData.fname,
        lname: userData.lname,
        friendsCount, // Include the friend count
      });
    }
  }

  setUsers(userList); // Update the state with filtered users
};

  // Function to search users based on the search term
  const searchUsers = async () => {
    if (!searchTerm.trim()) return; // Avoid empty searches
    if (!currentUser) return;

    const userList: User[] = [];

    // Queries to search users by username, first name, and last name
    const usernameQuery = query(
      collection(db, "users"),
      where("username", ">=", searchTerm),
      where("username", "<=", searchTerm + "\uf8ff")
    );
    const fnameQuery = query(
      collection(db, "users"),
      where("fname", ">=", searchTerm),
      where("fname", "<=", searchTerm + "\uf8ff")
    );
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
          friendsCount: Object.keys(userData.friends || {}).length, // Safely count friends
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
          friendsCount: Object.keys(userData.friends || {}).length, // Safely count friends
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
          friendsCount: Object.keys(userData.friends || {}).length, // Safely count friends
        });
      }
    });

    setUsers(userList);
  };

    // Assume that 'getFriendToken' is a function that fetches the friend's notification token from Firestore
const getFriendToken = async (friendUid: string) => {
  const friendDoc = doc(db, 'users', friendUid);
  const friendSnapshot = await getDoc(friendDoc);
  return friendSnapshot.data()?.pushToken || null; // Assuming expoPushToken is stored in user data
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
        <TouchableOpacity onPress={() => router.push("/misc/friends")}>
          <Ionicons name="people-outline" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/misc/friendrequests")} style={styles.friendRequests}>
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
          initialNumToRender={10}
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <View style={styles.userContainer}>
              <Text style={styles.userName}>
                {item.fname} {item.lname} (@{item.username}) - {item.friendsCount} friends
              </Text>
              <TouchableOpacity
                style={[
                  styles.addFriendButton,
                  addedFriends[item.uid] && styles.addedFriendButton,
                ]}
                onPress={() => handleAddFriend(item)}
                disabled={addedFriends[item.uid]}
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
    width: '70%'
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
