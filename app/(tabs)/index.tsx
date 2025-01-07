import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  View,
  Dimensions,
  FlatList,
  StyleSheet,
  Pressable,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image"; // using expo-image for caching
import { Video, ResizeMode, Audio } from "expo-av";
import Carousel from "react-native-reanimated-carousel";
import ComingSoonPage from "../misc/comingsoon";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import Leaderboard from "../misc/leaderboard";

const BOTTOM_NAV_HEIGHT = 80;
const { height: screenHeight, width: screenWidth } = Dimensions.get("window");
const Tab = createMaterialTopTabNavigator();

export default function MyTabs() {
  let [fontsLoaded] = useFonts({
    "Zoi-Regular": require("@/assets/fonts/Zoi-Regular.otf"),
  });

  if (!fontsLoaded) return null;

  return (
    <Tab.Navigator
      initialRouteName="friends"
      screenOptions={{
        tabBarActiveTintColor: "#fff",
        tabBarIndicatorStyle: { backgroundColor: "#fff" },
        tabBarIndicatorContainerStyle: { width: "70%", left: "5%" },
        tabBarLabelStyle: {
          fontSize: 16,
          lineHeight: 24,
          fontFamily: "Zoi-Regular",
        },
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          position: "absolute",
          top: "13%", // bring it down slightly
          height: "5%",
          width: "100%",
        },
      }}
    >
      <Tab.Screen name="leaderboard" component={Leaderboard} />
      <Tab.Screen name="friends" component={FeedScreen} />
      <Tab.Screen name="school" component={ComingSoonPage} />
    </Tab.Navigator>
  );
}

// ------------------------------------------------------------------

function FeedScreen() {
  const [userHasPost, setUserHasPost] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [videos, setVideos] = useState<Array<VideoItem>>([]);

  // For controlling the Grid Modal
  const [showGrid, setShowGrid] = useState<boolean>(false);
  // We'll pre-mount the grid once feed is loaded, so it appears instantly.
  const [gridMounted, setGridMounted] = useState<boolean>(false);

  // For controlling which video the user is currently watching
  const isFocused = useIsFocused();
  const [currentViewableItemIndex, setCurrentViewableItemIndex] = useState(0);

  // We'll store unsubscribes to Firestore so we can clean them up
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // We'll reference the main FlatList so we can programmatically scroll
  const feedListRef = useRef<FlatList<any>>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchUser = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userSnapshot = await getDoc(userDocRef);
          const userPost = userSnapshot.data()?.post || "";
          setUserHasPost(Boolean(userPost));
        } catch (error) {
          console.error("Error fetching latest post:", error);
        }
      };
      fetchUser();
    }, [])
  );

  useEffect(() => {
    // Allow audio in silent mode on iOS
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    fetchFriendVideos();

    return () => {
      // Cleanup friend listeners
      unsubscribeRefs.current.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once feed loads and we have videos, mount the grid so it's ready
  useEffect(() => {
    if (!isLoading && videos.length > 0) {
      setGridMounted(true);
    }
  }, [isLoading, videos]);

  const fetchFriendVideos = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const unsubscribe = onSnapshot(userDocRef, async (userSnapshot) => {
        const userData = userSnapshot.data() || {};
        const userPost = userData.post || "";
        if (!userPost) {
          setUserHasPost(false);
          setVideos([]);
          setIsLoading(false);
          return;
        }
        setUserHasPost(true);

        const friends = userData.friends || {};
        const friendUIDs = Object.keys(friends).filter((uid) => friends[uid]);

        // We'll collect everyone's video data in a map
        const allVideosMap = new Map<string, VideoItem>();

        // Clear old unsubscribers
        unsubscribeRefs.current.forEach((unsub) => unsub());
        unsubscribeRefs.current = [];

        // 1) Grab current user's video info
        allVideosMap.set(currentUser.uid, {
          uid: currentUser.uid,
          post: userPost, // HLS .m3u8
          username: userData.username || "Me",
          thumbnail: userData.thumbnail || "",
          pfp: userData.pfp || "",
          reactions: userData.reactions || [],
        });

        // 2) For each friend
        if (friendUIDs.length > 0) {
          friendUIDs.forEach((uid) => {
            const friendDocRef = doc(db, "users", uid);
            const friendUnsub = onSnapshot(friendDocRef, async (snap) => {
              const friendData = snap.data() || {};
              const friendPosts = friendData.post || "";
              if (!friendPosts) {
                // remove if they have no post
                if (allVideosMap.has(uid)) {
                  allVideosMap.delete(uid);
                  updateVideoState([...allVideosMap.values()]);
                }
                setIsLoading(false);
                return;
              }

              const friendUsername = friendData.username || "Unknown";
              const friendPfp = friendData.pfp || "";
              const friendReactions = friendData.reactions || [];

              // add the secret "click" reaction
              const filteredReactions = [
                ...friendReactions.filter((r: string) => r !== ""),
                "https://firebasestorage.googleapis.com/v0/b/irl-app-3e412.appspot.com/o/click.mp4?alt=media&token=aac533fa-8ca3-4881-bb44-b4786c648ea9",
              ];

              allVideosMap.set(uid, {
                uid,
                post: friendPosts,
                username: friendUsername,
                thumbnail: friendData.thumbnail || "",
                pfp: friendPfp,
                reactions: filteredReactions,
              });

              updateVideoState([...allVideosMap.values()]);
              setIsLoading(false);
            });
            unsubscribeRefs.current.push(friendUnsub);
          });
        } else {
          // no friends
          updateVideoState([...allVideosMap.values()]);
          setIsLoading(false);
        }
      });
      unsubscribeRefs.current.push(unsubscribe);
    } catch (error) {
      console.error("Error fetching friend videos:", error);
      setIsLoading(false);
    }
  };

  // Sort + set videos
  const updateVideoState = useCallback((videosArr: VideoItem[]) => {
    // Sort by reaction count (excluding the “click.mp4” placeholder)
    videosArr.sort((a, b) => {
      const aCount = a.reactions.filter((r) => !r.includes("click.mp4")).length;
      const bCount = b.reactions.filter((r) => !r.includes("click.mp4")).length;
      return bCount - aCount;
    });
    setVideos(videosArr);
  }, []);

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    []
  );

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentViewableItemIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]);

  // Detect “pull-down” beyond a threshold to open grid
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      // If user pulls down ~80px beyond the top, show the grid
      if (offsetY < -80 && !showGrid) {
        setShowGrid(true);
      }
    },
    [showGrid]
  );

  // Jump to a given video index from the grid
  const jumpToVideo = useCallback(
    (index: number) => {
      // 1) Validate index
      if (index < 0 || index >= videos.length) return;

      // 2) Hide grid
      setShowGrid(false);

      // 3) Try scrolling
      requestAnimationFrame(() => {
        try {
          feedListRef.current?.scrollToIndex({ index, animated: false });
          setCurrentViewableItemIndex(index);
        } catch (err) {
          console.warn("scrollToIndex error:", err);
        }
      });
    },
    [videos.length]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: VideoItem; index: number }) => {
      return (
        <Item
          item={item}
          index={index}
          shouldPlay={isFocused && index === currentViewableItemIndex}
          totalVideos={videos.length}
        />
      );
    },
    [isFocused, currentViewableItemIndex, videos.length]
  );

  // If user hasn't posted yet, show a “go post!” page
  if (!userHasPost) {
    return <ComingSoonPage text="You haven't posted yet. Go Post!" />;
  }

  // Spinner until the feed is loaded
  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // If no videos at all
  if (videos.length === 0) {
    return <ComingSoonPage text="No Posts yet. Add more friends!" />;
  }

  return (
    <View style={styles.container}>
      {/* Logo in top-right corner */}
      <Image
        source={require("@/assets/images/app_logo_transparent.png")}
        style={styles.logo}
      />

      <FlatList
        ref={feedListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.uid}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        initialNumToRender={3}
        windowSize={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={100}
        snapToInterval={screenHeight - BOTTOM_NAV_HEIGHT}
        decelerationRate="fast"
        snapToAlignment="start"
        disableIntervalMomentum
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      {/* “Grid” overlay (BeReal-like calendar) */}
      {gridMounted && (
        <Modal visible={showGrid} animationType="none" transparent>
          <View style={styles.gridModalOverlay}>
            <View style={styles.gridContainer}>
              <Text style={styles.gridTitle}>Grid View</Text>

              <FlatList
                data={videos}
                keyExtractor={(item) => item.uid}
                numColumns={3}
                style={{ alignSelf: "stretch" }}
                columnWrapperStyle={{
                  justifyContent: "flex-start",
                  marginBottom: 10,
                }}
                renderItem={({ item, index }) => {
                  return (
                    <TouchableOpacity
                      style={styles.gridItemBox}
                      onPress={() => jumpToVideo(index)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={styles.gridItemBoxText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                      >
                        {item.username}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Close button */}
              <TouchableOpacity
                style={styles.gridCloseButton}
                onPress={() => setShowGrid(false)}
              >
                <Ionicons name="close-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ------------------------------------------------------------------

type VideoItem = {
  uid: string;
  post: string; // HLS .m3u8 URL
  username: string;
  thumbnail: string;
  pfp: string;
  reactions: string[];
};

const Item = memo(function Item({
  item,
  index,
  shouldPlay,
  totalVideos,
}: {
  shouldPlay: boolean;
  item: VideoItem;
  index: number;
  totalVideos: number;
}) {
  const video = useRef<Video | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [showThumbnail, setShowThumbnail] = useState<boolean>(true);

  const router = useRouter();

  // Navigate to the friend’s profile
  const navigateToFriendProfile = useCallback(() => {
    router.push({
      pathname: "/misc/friendprofile",
      params: { friendUid: item.uid },
    });
  }, [item.uid, router]);

  // Single-tap on main video => toggle play/pause
  const handleVideoPress = useCallback(() => {
    if (status?.isPlaying) {
      video.current?.pauseAsync();
    } else {
      video.current?.playAsync();
    }
  }, [status?.isPlaying]);

  // Auto-play / pause logic
  useEffect(() => {
    if (!video.current) return;
    if (shouldPlay) {
      video.current.playAsync();
      // Optionally prefetch the next video if you want
      prefetchNextVideo(index + 1, totalVideos);
    } else {
      video.current.pauseAsync();
      video.current.setPositionAsync(0);
    }
  }, [shouldPlay]);

  const onPlaybackStatusUpdate = useCallback((st: any) => {
    setStatus(st);
  }, []);

  const onReadyForDisplay = useCallback(() => {
    setShowThumbnail(false);
  }, []);

  const prefetchNextVideo = useCallback(
    async (nextIndex: number, total: number) => {
      // Optional: Preload the next HLS video in background
      if (nextIndex >= total) return;
      // ...
    },
    []
  );

  // Count “real” reaction videos (excluding "click.mp4")
  const reactionCount = useMemo(() => {
    return item.reactions.filter((r) => !r.includes("click.mp4")).length;
  }, [item.reactions]);

  return (
    <View>
      {/* MAIN Pressable => toggles the main post video */}
      <Pressable onPress={handleVideoPress}>
        {/* Reaction carousel near bottom-left */}
        <View style={styles.reactionCarouselContainer}>
          <View style={styles.reactionCarouselWrapper}>
            <Carousel
              snapEnabled
              loop
              width={screenWidth / 3.5}
              height={screenWidth / 2.3}
              scrollAnimationDuration={500}
              data={item.reactions}
              renderItem={({ item: reactionItem }) => (
                <RealMoji
                  item={reactionItem}
                  shouldPlay={false} // We'll handle toggling inside RealMoji
                  friendUid={item.uid}
                />
              )}
            />
            {reactionCount > 0 && (
              <View style={styles.reactionCountContainer}>
                <Text style={styles.reactionCountText}>{reactionCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* MAIN video container */}
        <View style={styles.videoContainer}>
          {/* Show thumbnail until onReadyForDisplay triggers */}
          {showThumbnail && item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail, cache: "force-cache" }}
              style={styles.video}
              contentFit="cover"
              transition={300}
            />
          ) : null}

          <Video
            ref={video}
            source={{ uri: item.post }}
            style={styles.video}
            isLooping
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onReadyForDisplay={onReadyForDisplay}
            automaticallyWaitsToMinimizeStalling={false}
          />

          {/* top row: user info (PROFILE PIC + USERNAME) */}
          <TouchableOpacity
            style={styles.topRowContainer}
            onPress={navigateToFriendProfile}
          >
            <View style={styles.topLeftUserInfo}>
              <View style={styles.topLeftPfpWrapper}>
                {item.pfp ? (
                  <Image
                    source={{ uri: item.pfp, cache: "force-cache" }}
                    style={styles.topLeftPfpImage}
                    contentFit="cover"
                    transition={300}
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={18}
                    color="#fff"
                    style={styles.iconShadow}
                  />
                )}
              </View>
              <Text style={styles.topLeftName}>{item.username}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Pressable>
    </View>
  );
});

// ------------------------------------------------------------------

/** 
 * RealMoji:
 * Tapping on it checks if it's the special "click.mp4" => if so, open camera to record Reaction.
 * If not, simply toggle play/pause on that reaction clip.
 */
const RealMoji = memo(function RealMoji({
  item,
  shouldPlay,
  friendUid,
}: {
  shouldPlay: boolean;
  item: string;
  friendUid: string;
}) {
  const emojiRef = useRef<Video | null>(null);
  const [emojiStatus, setEmojiStatus] = useState<any>(null);
  const router = useRouter();

  // Always start paused at the first frame
  useEffect(() => {
    if (!emojiRef.current) return;
    emojiRef.current.setPositionAsync(0);
    emojiRef.current.pauseAsync();
  }, []);

  const handlePress = useCallback(async () => {
    const currentUserUid = auth.currentUser?.uid;
    if (!currentUserUid) {
      alert("You must be logged in to react.");
      return;
    }

    // If it's the special "click" reaction
    if (item.includes("click.mp4")) {
      try {
        const friendDocRef = doc(db, "users", friendUid);
        const friendSnapshot = await getDoc(friendDocRef);
        if (friendSnapshot.exists()) {
          const friendData = friendSnapshot.data();
          const alreadyReacted = friendData?.reactionUids?.includes(
            currentUserUid
          );
          if (alreadyReacted) {
            alert("Already reacted to this video");
            return;
          }
        }
      } catch (err) {
        console.error("Error checking friend's data:", err);
      }

      // If not already reacted, open ReactionVideo camera
      router.push({
        pathname: "/misc/reactionvideo",
        params: { friendUid },
      });
    } else {
      // Otherwise, toggle play/pause on this RealMoji
      if (emojiStatus?.isPlaying) {
        emojiRef.current?.pauseAsync();
      } else {
        emojiRef.current?.playAsync();
      }
    }
  }, [friendUid, item, emojiStatus]);

  return (
    <View style={styles.reactionContainer}>
      <Pressable onPress={handlePress}>
        <Video
          ref={emojiRef}
          source={{ uri: item }}
          style={styles.video}
          isLooping
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          onPlaybackStatusUpdate={(st) => setEmojiStatus(st)}
        />
      </Pressable>
    </View>
  );
});

// ------------------------------------------------------------------
// STYLES
// ------------------------------------------------------------------

const styles = StyleSheet.create({
  logo: {
    width: "15%",
    height: "15%",
    right: "5%",
    position: "absolute",
    zIndex: 2,
    backgroundColor: "transparent",
    top: "2%",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight - BOTTOM_NAV_HEIGHT,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  reactionCarouselContainer: {
    flex: 1,
    position: "absolute",
    zIndex: 4,
    bottom: 30,
    left: 20,
  },
  reactionCarouselWrapper: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.2)",
    position: "relative",
  },
  reactionCountContainer: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ff69b4",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  reactionCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  reactionContainer: {
    flex: 1,
    justifyContent: "center",
    borderRadius: 5,
  },
  iconShadow: {
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 2,
  },
  topRowContainer: {
    position: "absolute",
    top: "20%",
    width: "100%",
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    zIndex: 5,
  },
  topLeftUserInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  topLeftPfpWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 6,
  },
  topLeftPfpImage: {
    width: 28,
    height: 28,
  },
  topLeftName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 2,
  },

  // Grid modal
  gridModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  gridContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: "center",
  },
  gridTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  gridItemBox: {
    width: (screenWidth * 0.9 - 40) / 3,
    height: (screenWidth * 0.9 - 40) / 3,
    borderRadius: 8,
    backgroundColor: "#666",
    marginBottom: 10,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  gridItemBoxText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  gridCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 5,
  },
});