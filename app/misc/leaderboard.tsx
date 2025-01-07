import { useCallback, useState } from "react";
import {
  StyleSheet,
  Image,
  View,
  FlatList,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { db } from "../firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

const screenWidth = Dimensions.get("window").width;

export default function Leaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboardData = useCallback(async () => {
    setLoading(true);
    const usersQuery = query(
      collection(db, "users"),
      orderBy("streakCount", "desc")
    );
    const querySnapshot = await getDocs(usersQuery);
    const usersData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setUsers(usersData);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboardData();
    }, [fetchLeaderboardData])
  );

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const rank = index + 1;
    const isTopThree = rank <= 3;

    let rankIcon: string | null = null;
    if (rank === 1) {
      rankIcon = "👑";
    } else if (rank === 2) {
      rankIcon = "🥈";
    } else if (rank === 3) {
      rankIcon = "🥉";
    }

    return (
      <View style={[styles.userCard, isTopThree && styles.topUserCard]}>
        <View style={styles.leftSection}>
          <ThemedText style={[styles.rankText, isTopThree && styles.topRankText]}>
            {rankIcon || `#${rank}`}
          </ThemedText>
          {item.pfp ? (
            <Image source={{ uri: item.pfp }} style={styles.profileImage} />
          ) : (
            <Ionicons
              name="person-circle-outline"
              size={50}
              color="#FFFFFF"
              style={styles.defaultProfileIcon}
            />
          )}
        </View>
        <View style={styles.middleSection}>
          <ThemedText
            style={[styles.username, isTopThree && styles.topUsername]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.username || "Unknown User"}
          </ThemedText>
        </View>
        <View style={styles.rightSection}>
          <View style={styles.streakContainer}>
            <ThemedText style={styles.streakText}>
              {item.streakCount || 0}
            </ThemedText>
            <ThemedText style={styles.streakEmoji}>🔥</ThemedText>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.container}>
        {/* A simple View instead of LinearGradient */}
        <View style={[StyleSheet.absoluteFill, styles.backgroundOverlay]} />

        <ThemedText type="title" style={styles.title}>
          Leaderboard
        </ThemedText>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF69B4" />
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.noUsersText}>
                  Looks like no one's here yet. Be the first to make your mark!
                </ThemedText>
              </View>
            }
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const cardPadding = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  backgroundOverlay: {
    backgroundColor: "#C71585", // Replaces the gradient with a solid color.
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FF69B4",
    textAlign: "center",
    marginTop: 70, // same as original
    marginBottom: 20,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 20,
    marginTop: 65, // Slightly less than 120 so it’s moved up a bit
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    borderRadius: 14,
    padding: cardPadding,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#333",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4.65,
    elevation: 5,
  },
  topUserCard: {
    backgroundColor: "#2c1e27",
    borderColor: "#FF69B4",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: screenWidth * 0.3,
  },
  rankText: {
    fontSize: 16,
    color: "#FFF",
    fontWeight: "600",
    marginRight: 10,
    maxWidth: 40,
    textAlign: "center",
  },
  topRankText: {
    fontSize: 18,
    color: "#FF69B4",
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultProfileIcon: {
    alignSelf: "center",
  },
  middleSection: {
    flex: 1,
    paddingHorizontal: 10,
  },
  username: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
  },
  topUsername: {
    color: "#FF69B4",
  },
  rightSection: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF69B4",
    marginRight: 5,
  },
  streakEmoji: {
    fontSize: 16,
  },
  emptyContainer: {
    marginTop: 50,
    alignItems: "center",
  },
  noUsersText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    width: "80%",
  },
});
