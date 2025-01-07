import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Image, 
  ActivityIndicator 
} from "react-native";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebaseConfig"; 
import { ThemedView } from "@/components/shared/ThemedView";
import { Ionicons } from "@expo/vector-icons"; 
import { router } from "expo-router";

interface User {
  uid: string;
  username: string;
  fname: string;
  lname: string;
  pfp?: string;
}

export default function FriendRequests() {
  const currentUser = auth.currentUser;
  const [friendRequests, setFriendRequests] = useState<User[]>([]);
  const [currentUserName, setName] = useState("");
  const [loadingMap, setLoadingMap] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true); // New loading state

  useEffect(() => {
    fetchFriendRequests();
  }, []);

  const fetchFriendRequests = async () => {
    if (!currentUser) return;

    try {
      const currentUserRef = doc(db, "users", currentUser.uid);
      const currentUserDoc = await getDoc(currentUserRef);

      if (currentUserDoc.exists()) {
        const friends = currentUserDoc.data().friends || {};
        setName(currentUserDoc.data().fname);

        const requests: User[] = [];
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
                pfp: friendData.pfp || ""
              });
            }
          }
        }
        setFriendRequests(requests);
      }
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    } finally {
      setLoading(false); // Stop loading regardless of outcome
    }
  };

  const getFriendToken = async (friendUid: string) => {
    const friendDocRef = doc(db, 'users', friendUid);
    const friendSnapshot = await getDoc(friendDocRef);
    return friendSnapshot.data()?.pushToken || null;
  };

  const sendFriendAcceptedNotification = async (friendUid: string) => {
    try {
      const friendToken = await getFriendToken(friendUid);
      if (friendToken) {
        const message = {
          to: friendToken,
          sound: 'default',
          title: '🎉 Friend Request Accepted',
          body: `${currentUserName} accepted your friend request!`,
          data: { friendUid },
        };

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        console.log('Friend request acceptance notification sent successfully!');
      } else {
        console.log('Friend does not have a registered Expo push token.');
      }
    } catch (error) {
      console.error('Error sending friend request acceptance notification:', error);
    }
  };

  const handleAcceptFriend = async (friend: User) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const currentUserRef = doc(db, "users", currentUser.uid);
      const friendRef = doc(db, "users", friend.uid);

      await updateDoc(currentUserRef, {
        [`friends.${friend.uid}`]: true,
      });
      await updateDoc(friendRef, {
        [`friends.${currentUser.uid}`]: true,
      });

      setFriendRequests((prev) => prev.filter((req) => req.uid !== friend.uid));
      await sendFriendAcceptedNotification(friend.uid);
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const renderRequestItem = ({ item }: { item: User }) => {
    const isLoading = loadingMap[item.uid] || false;

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestLeft}>
          <View style={styles.avatarContainer}>
            {isLoading && <ActivityIndicator style={styles.loadingIndicator} color="#FF69B4" />}
            {item.pfp ? (
              <Image
                source={{ uri: item.pfp }}
                style={styles.profilePic}
                onLoadStart={() => setLoadingMap((prev) => ({ ...prev, [item.uid]: true }))}
                onLoadEnd={() => setLoadingMap((prev) => ({ ...prev, [item.uid]: false }))}
              />
            ) : (
              <Ionicons name="person-circle-outline" size={50} color="#FFFFFF" />
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.nameText}>
              {item.fname} {item.lname}
            </Text>
            <Text style={styles.usernameText}>@{item.username}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptFriend(item)}>
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/(tabs)/search')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Requests</Text>
      </View>

      {loading ? (
        // While loading, just show the ActivityIndicator
        <ActivityIndicator 
          size="large" 
          color="#FF69B4" 
          style={{ marginTop: 40 }} 
        />
      ) : friendRequests.length > 0 ? (
        <FlatList
          data={friendRequests}
          keyExtractor={(item) => item.uid}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="people-outline" size={60} color="#555" style={{ marginBottom: 20 }} />
          <Text style={styles.noRequestsText}>No friend requests found</Text>
          <Text style={styles.noRequestsSubtext}>When someone sends you a friend request, it will appear here.</Text>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: "space-between",
  },
  requestLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  loadingIndicator: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 1,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderColor: "#FF69B4",
    borderWidth: 1,
  },
  userInfo: {
    flex: 1,
  },
  nameText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  usernameText: {
    color: "#888",
    fontSize: 14,
    marginTop: 2,
  },
  acceptButton: {
    backgroundColor: "#FF69B4",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  acceptButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyStateContainer: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  noRequestsText: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 5,
  },
  noRequestsSubtext: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 14,
    marginBottom: 20,
  },
});