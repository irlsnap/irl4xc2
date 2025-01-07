import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  Platform,
  Dimensions,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

interface User {
  uid: string;
  username: string;
  fname: string;
  lname: string;
  pfp?: string;
  friends?: { [uid: string]: boolean };
  friendsCount: number;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // minus margins, divided by 2 columns

export default function Friends() {
  const currentUser = auth.currentUser;
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoadingMap, setImageLoadingMap] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    if (!currentUser) return;

    try {
      const currentUserRef = doc(db, "users", currentUser.uid);
      const currentUserDoc = await getDoc(currentUserRef);

      if (currentUserDoc.exists()) {
        const friendsList: User[] = [];
        const friendsData = currentUserDoc.data().friends || {};

        for (const [uid, accepted] of Object.entries(friendsData)) {
          if (accepted) {
            const friendDoc = await getDoc(doc(db, "users", uid));
            if (friendDoc.exists()) {
              const friendData = friendDoc.data() as User;
              const friendsCount = friendData.friends ? Object.keys(friendData.friends).length : 0;
              friendsList.push({
                uid: friendDoc.id,
                username: friendData.username,
                fname: friendData.fname,
                lname: friendData.lname,
                pfp: friendData.pfp || "",
                friendsCount,
              });
            }
          }
        }

        setFriends(friendsList);
      }
    } catch (error) {
      console.error("Error fetching friends: ", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter((friend) => {
    const fullName = (friend.fname + " " + friend.lname).toLowerCase();
    return (
      fullName.includes(searchTerm.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const friendCountDisplay = friends.length > 0 ? `(${friends.length})` : "";

  const renderFriendItem = ({ item }: { item: User }) => {
    const isImageLoading = imageLoadingMap[item.uid] || false;

    return (
      <TouchableOpacity
        style={styles.friendCard}
        activeOpacity={0.9}
        onPress={() => {
          // Navigate to friend's profile if desired
          // router.push({ pathname: "/misc/friendprofile", params: { friendUid: item.uid } });
        }}
      >
        <View style={styles.avatarWrapper}>
          {isImageLoading && <ActivityIndicator style={styles.loadingIndicator} color="#FF69B4" />}
          {item.pfp ? (
            <Image
              source={{ uri: item.pfp }}
              style={styles.friendAvatar}
              onLoadStart={() => setImageLoadingMap((prev) => ({ ...prev, [item.uid]: true }))}
              onLoadEnd={() => setImageLoadingMap((prev) => ({ ...prev, [item.uid]: false }))}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="person-circle-outline" size={70} color="#FFFFFF" />
          )}
        </View>
        <Text style={styles.friendName}>
          {item.fname} {item.lname}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
        <View style={styles.friendCountContainer}>
          <Ionicons name="people-outline" size={14} color="#FF69B4" style={{ marginRight: 4 }} />
          <Text style={styles.friendCount}>{item.friendsCount} friends</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Hero / Header Section */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => router.navigate("/(tabs)/search")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>
        <Text style={styles.headerTitle}>Your Friends {friendCountDisplay}</Text>
        <Text style={styles.headerSubtitle}>Celebrate your connections.</Text>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#888"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF69B4" style={{ marginTop: "20%" }} />
      ) : filteredFriends.length > 0 ? (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriendItem}
          contentContainerStyle={styles.gridContentContainer}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color="#555" style={{ marginBottom: 20 }} />
          <Text style={styles.noFriendsText}>No matching friends found</Text>
          <Text style={styles.noFriendsSubtext}>
            Try searching for a different name or username.
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/misc/friendrequests")}
            activeOpacity={0.85}
          >
            <Text style={styles.addButtonText}>Find More Friends</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button to Add Friends */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => router.push("/misc/friendrequests")}
      >
        <Ionicons name="person-add-outline" size={24} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  headerContainer: {
    // Formerly LinearGradient. Use a solid background color instead.
    backgroundColor: "#FF69B4",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  headerSubtitle: {
    color: "#ddd",
    fontSize: 14,
    marginBottom: 20,
  },
  searchWrapper: {
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: 10,
  },
  searchInput: {
    height: 40,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingLeft: 40,
    paddingRight: 10,
    color: "#FFF",
    fontSize: 14,
  },

  gridContentContainer: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 100, // space for FAB
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 20,
  },
  friendCard: {
    width: CARD_WIDTH,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarWrapper: {
    marginBottom: 10,
    position: "relative",
  },
  loadingIndicator: {
    position: "absolute",
    top: 30,
    left: CARD_WIDTH / 2 - 10,
    zIndex: 1,
  },
  friendAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderColor: "#FF69B4",
    borderWidth: 2,
  },
  friendName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  friendUsername: {
    color: "#bbb",
    fontSize: 13,
    marginBottom: 6,
    textAlign: "center",
  },
  friendCountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendCount: {
    color: "#ccc",
    fontSize: 12,
  },

  emptyContainer: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  noFriendsText: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 5,
  },
  noFriendsSubtext: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 14,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: "#FF69B4",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  addButtonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 40,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FF69B4",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF69B4",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
