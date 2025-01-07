import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
  Dimensions,
  ScrollView
} from "react-native";
import { router, useNavigation } from "expo-router";
import { collection, query, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import Fuse from "fuse.js";

function formatLastSeen(timestamp?: number) {
  if (!timestamp) return "Active now";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Active now";
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Active ${diffDays}d ago`;
}

interface User {
  uid: string;
  username: string;
  fname: string;
  lname: string;
  friends?: { [uid: string]: boolean };
  friendsCount: number;
  pfp?: string;
  lastSeen?: number;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

export default function Search() {
  const navigation = useNavigation();
  const currentUser = auth.currentUser;
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [addedFriends, setAddedFriends] = useState<{ [uid: string]: boolean }>({});
  const [friendsMap, setFriendsMap] = useState<{ [uid: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({});
  const [filterCategory, setFilterCategory] = useState<"all" | "friendsoffriends" | "online" | "myfriends">("all");

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    fetchAllUsers();
  }, [navigation]);

  const fuse = useMemo(() => {
    return new Fuse(users, {
      keys: ["username", "fname", "lname"],
      includeScore: true,
      threshold: 0.4,
    });
  }, [users]);

  const fetchAllUsers = async () => {
    if (!currentUser) return;
    setLoading(true);
    const userList: User[] = [];
    const seen = new Set();

    const currentUserRef = doc(db, "users", currentUser.uid);
    const currentUserDoc = await getDoc(currentUserRef);
    const currentUserData = currentUserDoc.exists() ? currentUserDoc.data() : {};
    const friendsData = currentUserData.friends || {};

    const allUsersQuery = query(collection(db, "users"));
    const userSnapshot = await getDocs(allUsersQuery);

    for (const userDoc of userSnapshot.docs) {
      const userData = userDoc.data() as User;
      const friendsCount = userData.friends ? Object.keys(userData.friends).length : 0;
      if (!seen.has(userDoc.id) && userDoc.id !== currentUser.uid) {
        seen.add(userDoc.id);
        userList.push({
          uid: userDoc.id,
          username: userData.username || "",
          fname: userData.fname || "",
          lname: userData.lname || "",
          friendsCount,
          pfp: userData.pfp || "",
          friends: userData.friends,
          lastSeen: userData.lastSeen,
        });
      }
    }

    setUsers(userList);
    setFriendsMap(friendsData);
    setLoading(false);
  };

  const handleAddFriend = async (otherUser: User) => {
    if (!currentUser) return;
    try {
      const otherUserRef = doc(db, "users", otherUser.uid);
      await updateDoc(otherUserRef, {
        [`friends.${currentUser.uid}`]: false,
      });
      setAddedFriends((prev) => ({ ...prev, [otherUser.uid]: true }));
    } catch (error) {
      console.error("Error adding friend:", error);
    }
  };

  let displayedUsers = useMemo(() => {
    let list = users;

    if (filterCategory === "friendsoffriends") {
      // show users who are friends of user's friends
      const directFriends = Object.keys(friendsMap).filter((uid) => friendsMap[uid] === true);
      list = list.filter((u) => {
        if (friendsMap[u.uid] === true) return false; // already a direct friend
        if (u.uid === currentUser?.uid) return false; // the user themselves
        if (!u.friends) return false;
        const uFriends = Object.keys(u.friends);
        // Check if this user is a friend of at least one direct friend
        return uFriends.some((fid) => directFriends.includes(fid));
      });
    } else if (filterCategory === "online") {
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      list = list.filter((u) => !u.lastSeen || u.lastSeen > fiveMinsAgo);
    } else if (filterCategory === "myfriends") {
      list = list.filter((u) => friendsMap[u.uid] === true);
    }

    if (searchTerm.trim()) {
      const results = fuse.search(searchTerm);
      list = results.map((res) => res.item);
    }
    return list;
  }, [users, searchTerm, fuse, filterCategory, friendsMap, currentUser]);

  const noResults = displayedUsers.length === 0 && !loading;

  const renderUserItem = ({ item }: { item: User }) => {
    const isFriend = friendsMap[item.uid] === true;
    const requestSent = addedFriends[item.uid];

    let buttonLabel = "Add Friend";
    let buttonStyle = styles.addFriendButton;
    let buttonTextColor = "#FF69B4";
    let iconName: keyof typeof Ionicons.glyphMap | null = null;

    if (isFriend) {
      buttonLabel = "Friends";
      buttonStyle = [styles.addFriendButton, styles.friendsButton];
      buttonTextColor = "#FFF";
      iconName = "checkmark-circle";
    } else if (requestSent) {
      buttonLabel = "Requested";
      buttonStyle = [styles.addFriendButton, styles.requestedButton];
      buttonTextColor = "#FF69B4";
      iconName = "time-outline";
    }

    return (
      <TouchableOpacity
        style={styles.userCard}
        key={item.uid}
        onPress={() => {
          // Navigate to friend profile
          router.push({
            pathname: '/misc/friendprofile',
            params: { friendUid: item.uid },
          });
        }}
        activeOpacity={0.9}
      >
        <View style={styles.avatarContainer}>
          {imageLoading[item.uid] && <ActivityIndicator style={styles.loadingIndicator} color="#FF69B4" />}
          {item.pfp ? (
            <Image
              source={{ uri: item.pfp }}
              style={styles.avatar}
              onLoadStart={() => setImageLoading((prev) => ({ ...prev, [item.uid]: true }))}
              onLoadEnd={() => setImageLoading((prev) => ({ ...prev, [item.uid]: false }))}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={60} color="#FFFFFF" />
          )}
          <View style={styles.avatarBorder} />
        </View>
        <Text style={styles.friendName} numberOfLines={1}>{item.fname} {item.lname}</Text>
        <Text style={styles.friendUsername} numberOfLines={1}>@{item.username}</Text>
        <Text style={styles.friendCount}>{item.friendsCount} friends</Text>
        <Text style={styles.lastActive}>{formatLastSeen(item.lastSeen)}</Text>

        {isFriend || requestSent ? (
          <View style={buttonStyle}>
            {iconName && <Ionicons name={iconName} size={16} color={buttonTextColor} style={{ marginRight: 5 }} />}
            <Text style={[styles.buttonText, { color: buttonTextColor }]}>{buttonLabel}</Text>
          </View>
        ) : (
          <TouchableOpacity style={buttonStyle} onPress={() => handleAddFriend(item)} activeOpacity={0.9}>
            <Text style={[styles.buttonText, { color: buttonTextColor }]}>{buttonLabel}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        {/* Top row with title and requests icon */}
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Discover New Connections</Text>
          <TouchableOpacity 
            style={styles.requestsIconContainer}
            onPress={() => router.push("/misc/friendrequests")}
          >
            <Ionicons name="person-add-outline" size={24} color="#FF69B4" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerUnderline} />
        <Text style={styles.headerSubtitle}>Expand your network with amazing people</Text>

        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            placeholder="Search by name or username"
            placeholderTextColor="#666"
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
          <TouchableOpacity
            onPress={() => setFilterCategory("all")}
            style={[styles.chip, filterCategory === "all" && styles.activeChip]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterCategory === "all" && styles.activeChipText]}>All Users</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterCategory("friendsoffriends")}
            style={[styles.chip, filterCategory === "friendsoffriends" && styles.activeChip]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterCategory === "friendsoffriends" && styles.activeChipText]}>
              Friends of Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterCategory("online")}
            style={[styles.chip, filterCategory === "online" && styles.activeChip]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterCategory === "online" && styles.activeChipText]}>Online Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterCategory("myfriends")}
            style={[styles.chip, filterCategory === "myfriends" && styles.activeChip]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterCategory === "myfriends" && styles.activeChipText]}>My Friends</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading && (
        <ActivityIndicator size="large" color="#FF69B4" style={{ marginTop: 40 }} />
      )}

      {!loading && !noResults && (
        <FlatList
          data={displayedUsers}
          keyExtractor={(item) => item.uid}
          renderItem={renderUserItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.gridContentContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {noResults && (
        <View style={styles.emptyContainer}>
          <Ionicons name="sad-outline" size={60} color="#555" style={{ marginBottom: 20 }} />
          <Text style={styles.noResultsText}>No matches found</Text>
          <Text style={styles.noResultsSubtext}>Try a different search or a different category.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: "#000",
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestsIconContainer: {
    padding: 6,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
    marginRight: 10,
  },
  headerUnderline: {
    width: 50,
    height: 2,
    backgroundColor: "#FF69B4",
    marginVertical: 8,
  },
  headerSubtitle: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 20,
  },
  searchWrapper: {
    position: "relative",
    marginBottom: 15,
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: 11,
  },
  searchInput: {
    height: 40,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingLeft: 36,
    paddingRight: 10,
    color: "#FFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#333",
  },
  chipsScroll: {
    marginBottom: 10,
  },
  chipsContainer: {
    alignItems: 'center',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#444",
    marginRight: 10,
    backgroundColor: "#000",
  },
  chipText: {
    color: "#aaa",
    fontWeight: "600",
    fontSize: 13,
  },
  activeChip: {
    borderColor: "#FF69B4",
  },
  activeChipText: {
    color: "#FF69B4",
  },
  gridContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    paddingTop: 20,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 20,
  },
  userCard: {
    width: CARD_WIDTH,
    backgroundColor: "#141414",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 10,
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIndicator: {
    position: 'absolute',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    zIndex: 2,
  },
  avatarBorder: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#FF69B4",
    zIndex: 1,
  },
  friendName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center",
    maxWidth: CARD_WIDTH - 20,
  },
  friendUsername: {
    color: "#bbb",
    fontSize: 12,
    marginBottom: 4,
    textAlign: "center",
    maxWidth: CARD_WIDTH - 20,
  },
  friendCount: {
    color: "#777",
    fontSize: 12,
    marginBottom: 2,
    textAlign: "center",
  },
  lastActive: {
    color: "#888",
    fontSize: 12,
    marginBottom: 12,
    textAlign: "center",
  },
  addFriendButton: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF69B4",
    backgroundColor: "transparent",
  },
  friendsButton: {
    backgroundColor: "#FF69B4",
    borderColor: "#FF69B4",
  },
  requestedButton: {
    borderWidth: 1,
    borderColor: "#FF69B4",
    backgroundColor: "transparent",
  },
  buttonText: {
    fontWeight: "700",
    fontSize: 13,
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  noResultsText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 5,
  },
  noResultsSubtext: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});