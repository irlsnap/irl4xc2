// FILE: Profile.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Text,
  Platform,
  ScrollView,
  FlatList,
  Easing,
  Animated,
  Dimensions,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

// ---- Firebase & Firestore Stuff ----
import { auth, db, storage } from "../firebaseConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  getDoc,
  doc,
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

// ---- Video Player (expo-av) ----
import { Video } from "expo-av";

// ---- Local Components ----
import VideoThumbnailComponent from "@/components/video/VideoThumbnailComponent";

/******************************************************************************
 * Helpers & Constants
 *****************************************************************************/
const USERNAME_REGEX = /^[a-zA-Z0-9._]+$/;

/** Checks Firestore if a doc in "users" has that username. Returns true if it exists. */
const checkUsernameExists = async (username: string): Promise<boolean> => {
  const qUser = query(collection(db, "users"), where("username", "==", username));
  const snapshot = await getDocs(qUser);
  return !snapshot.empty;
};

export const unstable_settings = {
  headerShown: false,
};

const COLORS = {
  background: "#000",
  accent: "#FF69B4", // Pink accent
  highlight: "#FFD54F",
  textPrimary: "#FFF",
  textSecondary: "#AAA",
  textMuted: "#666",
  cardBackground: "#111",
  cardItemBackground: "#222",
};

const SPACING = {
  xsmall: 4,
  small: 8,
  medium: 16,
  large: 24,
};

interface UserData {
  uid?: string;
  fname?: string;
  lname?: string;
  username?: string;
  pfp?: string;
  videos?: string[];
  hiddenVideos?: string[];
  pinnedVideos?: string[];
  friends?: Record<string, boolean>;
  streakCount?: number;
  bio?: string;

  // 2 changes / 14 days
  profileChangeCount?: number;
  lastProfileChangeDate?: Timestamp;
}

const DEFAULT_PFP = {
  uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAQAAABp6f8JAAAAZklEQVR42mNk+M/w38G/w38GwkMI0WAADDzv/9g+HsNuMfvLuBDFVzEvkvkvrN0fGAJMHo6+lEg+AA1wawYtlS6rCoClqWwhbq0r5ADQD1ukCzijumEiI6hICFMdkQDBAA8gOP5zJfn7QAAAABJRU5ErkJggg==",
};

/******************************************************************************
 * Simple Shimmer Placeholder (Static)
 * - No LinearGradient or fancy animation
 *****************************************************************************/
function ShimmerPlaceholder({ style }: { style?: any }) {
  // Just a static gray box for loading state
  return <View style={[styles.placeholderBase, style]} />;
}

/******************************************************************************
 * MAIN PROFILE COMPONENT
 *****************************************************************************/
export default function Profile() {
  const router = useRouter();

  // Basic states
  const [loading, setLoading] = useState<boolean>(true);
  const [videosLoading, setVideosLoading] = useState<boolean>(true);

  const [uid, setUid] = useState<string>("");
  const [fname, setFname] = useState<string>("");
  const [lname, setLname] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [bio, setBio] = useState<string>("");

  const [remoteImageURL, setRemoteImageURL] = useState<string>(DEFAULT_PFP.uri);
  const [localPfpURI, setLocalPfpURI] = useState<string>(DEFAULT_PFP.uri);

  const [hiddenVideos, setHiddenVideos] = useState<string[]>([]);
  const [pinnedVideos, setPinnedVideos] = useState<string[]>([]);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [viewsCount, setViewsCount] = useState<number>(0);
  const [allUserVideos, setAllUserVideos] = useState<string[]>([]);

  // Hiding / Pinning
  const [hideMode, setHideMode] = useState<boolean>(false);
  const [pinMode, setPinMode] = useState<boolean>(false);
  const [showHiddenVideos, setShowHiddenVideos] = useState<boolean>(false);

  // Settings modal
  const [settingsModalVisible, setSettingsModalVisible] = useState<boolean>(false);

  // Edit profile modal
  const [editProfileModal, setEditProfileModal] = useState<boolean>(false);
  const [tempFname, setTempFname] = useState<string>("");
  const [tempLname, setTempLname] = useState<string>("");
  const [tempUsername, setTempUsername] = useState<string>("");
  const [newBio, setNewBio] = useState<string>("");

  // Video options
  const [videoOptionsModal, setVideoOptionsModal] = useState<boolean>(false);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<string>("");

  // Feed overlay
  const [showFeed, setShowFeed] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // We'll store whichever array (pinned vs normal) in feedVideos
  const [feedVideos, setFeedVideos] = useState<string[]>([]);

  // Animated icon for Settings
  const rotation = useRef(new Animated.Value(0)).current;

  // Show 0 normal videos initially; user taps button to see more
  const [normalVideoLimit, setNormalVideoLimit] = useState<number>(0);

  /******************************************************************************
   * FETCH USER DATA
   *****************************************************************************/
  const fetchUserData = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.replace("/auth/login");
      return;
    }
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as UserData;
        setUid(currentUser.uid);
        setFname(data.fname || "");
        setLname(data.lname || "");
        setUsername(data.username || "");
        setBio(data.bio || "");

        // Profile pic
        const pfpURL = data.pfp || DEFAULT_PFP.uri;
        setRemoteImageURL(pfpURL);

        // Streak & Friends
        setStreakCount(data.streakCount ?? 0);
        const fCount = data.friends ? Object.keys(data.friends).length : 0;
        setFriendsCount(fCount);

        // Videos
        const userVideos = data.videos ? [...data.videos].reverse() : [];
        setAllUserVideos(userVideos);
        setHiddenVideos(data.hiddenVideos || []);
        setPinnedVideos(data.pinnedVideos || []);

        // Possibly load views count from "userVideos" doc
        try {
          const videoDocRef = doc(db, "userVideos", currentUser.uid);
          const videoDocSnap = await getDoc(videoDocRef);
          if (videoDocSnap.exists()) {
            const videoData = videoDocSnap.data();
            setViewsCount(videoData.views || 0);
          }
        } catch {
          setViewsCount(0);
        }
      } else {
        // If no doc in "users", sign out
        signOut(auth).then(() => router.replace("/auth/login"));
      }
    } catch (err) {
      console.error("Error loading user data:", err);
    }
    setLoading(false);
  }, [router]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  /******************************************************************************
   * LOAD PFP LOCALLY (faster)
   *****************************************************************************/
  useEffect(() => {
    if (!remoteImageURL) {
      setLocalPfpURI(DEFAULT_PFP.uri);
      return;
    }
    // Immediately set remote to show something quickly
    setLocalPfpURI(remoteImageURL);

    // Then do local caching in background
    (async () => {
      try {
        if (!uid) return;
        const storedLocalURI = await AsyncStorage.getItem(`pfp_${uid}`);
        if (storedLocalURI) {
          const fileInfo = await FileSystem.getInfoAsync(storedLocalURI);
          if (fileInfo.exists) {
            setLocalPfpURI(storedLocalURI);
            return;
          }
        }
        // If no local or it’s invalid, download & cache
        const downloadedURI = await downloadAndSaveImage(remoteImageURL, uid);
        setLocalPfpURI(downloadedURI);
        await AsyncStorage.setItem(`pfp_${uid}`, downloadedURI);
      } catch (error) {
        console.error("Error loading pfp:", error);
      }
    })();
  }, [remoteImageURL, uid]);

  /******************************************************************************
   * ARTIFICIAL LOADING DELAY FOR VIDEOS
   *****************************************************************************/
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setVideosLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  /******************************************************************************
   * UTILS
   *****************************************************************************/
  const getPfpFilename = (userUid: string) => `pfp_${userUid}.jpg`;

  const downloadAndSaveImage = async (url: string, userUid: string): Promise<string> => {
    try {
      const filename = getPfpFilename(userUid);
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        const downloaded = await FileSystem.downloadAsync(url, fileUri);
        return downloaded.uri;
      }
      return fileUri;
    } catch (error) {
      console.error("Error downloading image:", error);
      throw error;
    }
  };

  const removeLocalImage = async (userUid: string) => {
    try {
      const filename = getPfpFilename(userUid);
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }
    } catch (error) {
      console.error("Error removing local image:", error);
    }
  };

  /******************************************************************************
   * PICK & UPLOAD PFP
   *****************************************************************************/
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadMedia(result.assets[0].uri);
    }
  };

  const uploadMedia = async (localUri: string) => {
    if (!uid) return;
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const storageRef = ref(storage, uid);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        "state_changed",
        () => {},
        (error) => Alert.alert("Error", error.message),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          try {
            await updateDoc(doc(db, "users", uid), { pfp: url });
            // remove old local
            const oldLocalURI = await AsyncStorage.getItem(`pfp_${uid}`);
            if (oldLocalURI) {
              await removeLocalImage(uid);
              await AsyncStorage.removeItem(`pfp_${uid}`);
            }
            // download & store new
            const newLocalURI = await downloadAndSaveImage(url, uid);
            setLocalPfpURI(newLocalURI);
            await AsyncStorage.setItem(`pfp_${uid}`, newLocalURI);
            Alert.alert("Success", "Profile photo updated!");
          } catch (err: any) {
            Alert.alert("Error updating user data", err.message);
          }
        }
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  /******************************************************************************
   * SETTINGS ICON ANIMATION
   *****************************************************************************/
  const startSpinAnimation = (callback?: () => void) => {
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.linear,
    }).start(({ finished }) => {
      if (finished && callback) callback();
    });
  };

  const toggleSettingsModal = () => {
    startSpinAnimation(() => {
      setSettingsModalVisible(true);
    });
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  /******************************************************************************
   * HIDING/PINNING LOGIC
   *****************************************************************************/
  const onVideoLongPress = (videoUri: string) => {
    if (!hideMode && !pinMode) {
      setSelectedVideoForOptions(videoUri);
      setVideoOptionsModal(true);
    }
  };

  const toggleVideoHiddenDirectly = async (videoUri: string) => {
    const isHidden = hiddenVideos.includes(videoUri);
    const updated = isHidden
      ? hiddenVideos.filter((v) => v !== videoUri)
      : [...hiddenVideos, videoUri];
    setHiddenVideos(updated);
    if (uid) {
      await updateDoc(doc(db, "users", uid), { hiddenVideos: updated });
    }
  };

  const toggleVideoPinnedDirectly = async (videoUri: string) => {
    const isPinned = pinnedVideos.includes(videoUri);
    if (!isPinned && pinnedVideos.length >= 3) {
      Alert.alert("Limit Reached", "You can only pin up to 3 videos.");
      return;
    }
    const updated = isPinned
      ? pinnedVideos.filter((v) => v !== videoUri)
      : [...pinnedVideos, videoUri];
    setPinnedVideos(updated);
    if (uid) {
      await updateDoc(doc(db, "users", uid), { pinnedVideos: updated });
    }
  };

  const toggleVideoHidden = async () => {
    if (!selectedVideoForOptions) return;
    await toggleVideoHiddenDirectly(selectedVideoForOptions);
    setVideoOptionsModal(false);
  };

  const toggleVideoPinned = async () => {
    if (!selectedVideoForOptions) return;
    if (!pinnedVideos.includes(selectedVideoForOptions) && pinnedVideos.length >= 3) {
      Alert.alert("Limit Reached", "You can only pin up to 3 videos.");
      return;
    }
    await toggleVideoPinnedDirectly(selectedVideoForOptions);
    setVideoOptionsModal(false);
  };

  const enterPinMode = () => {
    if (hideMode) setHideMode(false);
    setPinMode(true);
    setSettingsModalVisible(false);
  };

  /******************************************************************************
   * PROFILE CHANGE LIMIT
   *****************************************************************************/
  const canChangeProfile = async () => {
    if (!uid) {
      Alert.alert("Error", "No user logged in.");
      return { allowed: false, profileChangeCount: 0, lastProfileChangeDate: Timestamp.now() };
    }
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      Alert.alert("Error", "User doc not found.");
      return { allowed: false, profileChangeCount: 0, lastProfileChangeDate: Timestamp.now() };
    }
    const data = snap.data() as UserData;
    let { profileChangeCount = 0, lastProfileChangeDate } = data;

    if (!lastProfileChangeDate) {
      return {
        allowed: true,
        profileChangeCount: 0,
        lastProfileChangeDate: Timestamp.now(),
      };
    }
    const now = Timestamp.now();
    const diffSeconds = now.seconds - lastProfileChangeDate.seconds;
    const diffDays = diffSeconds / (60 * 60 * 24);

    if (diffDays > 14) {
      profileChangeCount = 0;
    }
    if (profileChangeCount >= 2) {
      Alert.alert("Limit Reached", "You can only change your profile info 2 times every 14 days.");
      return { allowed: false, profileChangeCount, lastProfileChangeDate };
    }
    return { allowed: true, profileChangeCount, lastProfileChangeDate };
  };

  const saveProfileEdits = async () => {
    if (!tempFname || !tempLname) {
      Alert.alert("Missing name", "First and last name are required.");
      return;
    }
    if (!tempUsername) {
      Alert.alert("Missing username", "Please enter a username.");
      return;
    }
    if (!USERNAME_REGEX.test(tempUsername)) {
      Alert.alert("Invalid username", "Only letters, numbers, underscores, or dots allowed.");
      return;
    }
    const changedUsername = tempUsername !== username;
    if (changedUsername) {
      const taken = await checkUsernameExists(tempUsername);
      if (taken) {
        Alert.alert("Username Taken", "Please pick a different username.");
        return;
      }
    }
    const { allowed, profileChangeCount, lastProfileChangeDate } = await canChangeProfile();
    if (!allowed) return;

    try {
      const userRef = doc(db, "users", uid);
      let updatedCount = profileChangeCount + 1;
      let newLastDate = lastProfileChangeDate || Timestamp.now();
      const now = Timestamp.now();
      const diffSeconds = now.seconds - (lastProfileChangeDate?.seconds || 0);
      const diffDays = diffSeconds / (60 * 60 * 24);

      if (diffDays > 14) {
        updatedCount = 1;
        newLastDate = now;
      }

      await updateDoc(userRef, {
        fname: tempFname,
        lname: tempLname,
        username: tempUsername,
        bio: newBio,
        profileChangeCount: updatedCount,
        lastProfileChangeDate: updatedCount === 1 ? now : newLastDate,
      });

      setFname(tempFname);
      setLname(tempLname);
      setUsername(tempUsername);
      setBio(newBio);

      Alert.alert("Success", "Profile updated!");
      setEditProfileModal(false);
    } catch (err: any) {
      Alert.alert("Error updating profile", err.message);
    }
  };

  /******************************************************************************
   * FILTER / SLICE
   *****************************************************************************/
  const displayedPinnedVideos = showHiddenVideos
    ? pinnedVideos.filter((vid) => hiddenVideos.includes(vid))
    : pinnedVideos.filter((vid) => !hiddenVideos.includes(vid));

  const normalVideos = showHiddenVideos
    ? allUserVideos.filter((v) => hiddenVideos.includes(v) && !pinnedVideos.includes(v))
    : allUserVideos.filter((v) => !hiddenVideos.includes(v) && !pinnedVideos.includes(v));

  const displayedNormalVideos = normalVideos.slice(0, normalVideoLimit);

  const handleShowMore = () => {
    // If we haven't loaded any videos yet, start at 4
    if (normalVideoLimit === 0) {
      setNormalVideoLimit(4);
    } else {
      setNormalVideoLimit((prev) => prev + 4);
    }
  };

  const visibleVideosCount = allUserVideos.filter((v) => !hiddenVideos.includes(v)).length;
  const hasPostedToday = allUserVideos.length > 0;
  const nextPromptHours = 3;
  const nextPromptMinutes = 15;

  /******************************************************************************
   * RENDERING
   *****************************************************************************/
  // RENDER PINNED VIDEOS
  const renderPinnedVideos = () => {
    return displayedPinnedVideos.map((vid, index) => {
      if (videosLoading) {
        return (
          <View key={vid + index} style={styles.pinnedVideoContainer}>
            <ShimmerPlaceholder style={{ flex: 1 }} />
          </View>
        );
      }
      const handlePinnedPress = () => {
        if (hideMode) toggleVideoHiddenDirectly(vid);
        else if (pinMode) toggleVideoPinnedDirectly(vid);
        else {
          // Show pinned feed
          setFeedVideos(displayedPinnedVideos);
          setActiveIndex(index);
          setShowFeed(true);
        }
      };
      return (
        <View key={vid} style={styles.pinnedVideoContainer}>
          <TouchableOpacity
            onPress={handlePinnedPress}
            onLongPress={() => onVideoLongPress(vid)}
            style={styles.pinnedVideoInner}
          >
            <VideoThumbnailComponent videoUri={vid} style={styles.videoThumbnail} fastMode />
            <View style={styles.pinIconContainer}>
              <Ionicons name="pin" size={20} color={COLORS.textPrimary} />
            </View>
          </TouchableOpacity>
        </View>
      );
    });
  };

  // RENDER NORMAL VIDEO ITEM
  const renderNormalVideoItem = ({ item, index }: { item: string; index: number }) => {
    if (videosLoading) {
      return (
        <View style={styles.videoContainer}>
          <ShimmerPlaceholder style={styles.videoPlaceholder} />
        </View>
      );
    }
    const handlePress = () => {
      if (hideMode) toggleVideoHiddenDirectly(item);
      else if (pinMode) toggleVideoPinnedDirectly(item);
      else {
        // Show normal feed
        setFeedVideos(normalVideos);
        setActiveIndex(index);
        setShowFeed(true);
      }
    };
    return (
      <TouchableOpacity
        style={styles.videoContainer}
        onPress={handlePress}
        onLongPress={() => onVideoLongPress(item)}
      >
        <VideoThumbnailComponent videoUri={item} style={styles.videoThumbnail} fastMode />
      </TouchableOpacity>
    );
  };

  /******************************************************************************
   * MAIN RETURN
   *****************************************************************************/
  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Settings Gear (top-right) */}
      <TouchableOpacity
        onPress={toggleSettingsModal}
        style={styles.settingsIconContainer}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="settings-outline" size={24} color={COLORS.textPrimary} />
        </Animated.View>
      </TouchableOpacity>

      <ScrollView style={{ backgroundColor: COLORS.background }}>
        {/* HERO */}
        <View style={styles.heroContainer}>
          <View style={styles.heroContent}>
            <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
              <Image source={{ uri: localPfpURI }} style={styles.profileImage} />
            </TouchableOpacity>

            {loading ? (
              <>
                <ShimmerPlaceholder
                  style={{
                    width: 120,
                    height: 20,
                    borderRadius: 0,
                    marginVertical: SPACING.small,
                  }}
                />
                <ShimmerPlaceholder
                  style={{
                    width: 80,
                    height: 15,
                    borderRadius: 0,
                    marginBottom: SPACING.small,
                  }}
                />
              </>
            ) : (
              <>
                <Text style={styles.name}>
                  {fname} {lname}
                </Text>
                <Text style={styles.handle}>@{username}</Text>
                {bio ? (
                  <Text style={styles.bio}>{bio}</Text>
                ) : (
                  <Text style={styles.bioPlaceholder}>Add a short bio</Text>
                )}
                <TouchableOpacity
                  style={styles.editProfileButton}
                  onPress={() => {
                    // Populate with existing data first
                    setTempFname(fname);
                    setTempLname(lname);
                    setTempUsername(username);
                    setNewBio(bio);
                    setEditProfileModal(true);
                  }}
                >
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* METRICS */}
        {!loading && (
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <View style={styles.metricBadge}>
                <Text style={styles.metricValue}>{streakCount}</Text>
              </View>
              <Text style={styles.metricLabel}>🔥 Score</Text>
            </View>
            <TouchableOpacity style={styles.metricItem} onPress={() => router.push("/misc/friends")}>
              <View style={styles.metricBadge}>
                <Text style={styles.metricValue}>{friendsCount}</Text>
              </View>
              <Text style={styles.metricLabel}>👥 Friends</Text>
            </TouchableOpacity>
            <View style={styles.metricItem}>
              <View style={styles.metricBadge}>
                <Text style={styles.metricValue}>{visibleVideosCount}</Text>
              </View>
              <Text style={styles.metricLabel}>🎥 Videos</Text>
            </View>
          </View>
        )}

        {/* PINNED */}
        {displayedPinnedVideos.length > 0 && !showHiddenVideos && (
          <View style={styles.pinnedSection}>
            <Text style={styles.pinnedTitle}>Pinned</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.pinnedScroll, { justifyContent: "flex-start" }]}
            >
              {renderPinnedVideos()}
            </ScrollView>
          </View>
        )}

        {displayedPinnedVideos.length > 0 && !showHiddenVideos && <View style={{ height: 15 }} />}

        {/* PROMPT BANNER if user has no normal videos */}
        {!showHiddenVideos && !hasPostedToday && !loading && (
          <View style={styles.promptBanner}>
            <View style={styles.promptHighlight} />
            <Text style={styles.promptTitle}>Show us what you're doing!</Text>
            <Text style={styles.promptSubtitle}>
              Next prompt in: {nextPromptHours}h {nextPromptMinutes}m
            </Text>
          </View>
        )}

        {/* Hide/Pin Bars */}
        {hideMode && (
          <View style={styles.hideModeBar}>
            <Text style={styles.hideModeText}>Tap to hide/unhide</Text>
            <TouchableOpacity onPress={() => setHideMode(false)}>
              <Text style={styles.hideModeDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
        {pinMode && (
          <View style={styles.hideModeBar}>
            <Text style={styles.hideModeText}>Tap to pin/unpin (Max 3)</Text>
            <TouchableOpacity onPress={() => setPinMode(false)}>
              <Text style={styles.hideModeDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* If user has 0 normal videos => show CTA */}
        {!showHiddenVideos && !hasPostedToday && !loading && normalVideos.length === 0 && (
          <View style={styles.noVideosCTAContainer}>
            <Text style={styles.noVideosCTAText}>No videos yet</Text>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => Alert.alert("Coming Soon", "Route to create a new post.")}
            >
              <Text style={styles.recordButtonText}>Record Today's Clip</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Normal Videos (Grid) */}
        {normalVideoLimit > 0 && (
          <View style={styles.normalVideosContainer}>
            <FlatList
              data={displayedNormalVideos}
              keyExtractor={(item) => item}
              numColumns={2}
              renderItem={renderNormalVideoItem}
              columnWrapperStyle={{
                justifyContent: "center",
              }}
              ListEmptyComponent={
                !loading &&
                videosLoading && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {[...Array(2)].map((_, i) => (
                      <View key={i} style={styles.videoContainer}>
                        <ShimmerPlaceholder style={styles.videoPlaceholder} />
                      </View>
                    ))}
                  </View>
                )
              }
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Show More Button */}
        {normalVideos.length > 0 && normalVideoLimit < normalVideos.length && (
          <View style={{ alignItems: "center", marginVertical: SPACING.medium }}>
            <TouchableOpacity style={styles.showMoreButton} onPress={handleShowMore}>
              <Text style={styles.showMoreText}>
                {normalVideoLimit === 0 ? "See More Videos" : "Show More"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Full-Screen Feed Overlay */}
      <Modal
        visible={showFeed}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowFeed(false)}
      >
        <VideoFeedOverlay
          videos={feedVideos}
          startIndex={activeIndex}
          onClose={() => setShowFeed(false)}
        />
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <Pressable
          style={styles.settingsModalOverlay}
          onPress={() => setSettingsModalVisible(false)}
        >
          <View style={styles.settingsModalContent}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsList} showsVerticalScrollIndicator={false}>
              <Text style={styles.settingsSectionTitle}>Account</Text>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setTempFname(fname);
                  setTempLname(lname);
                  setTempUsername(username);
                  setNewBio(bio);
                  setEditProfileModal(true);
                }}
              >
                <View style={styles.settingsItemInner}>
                  <Ionicons
                    name="person-circle-outline"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: SPACING.small }}
                  />
                  <Text style={styles.settingsItemText}>Edit Profile Info</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem}>
                <View style={styles.settingsItemInner}>
                  <Ionicons
                    name="eye-outline"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: SPACING.small }}
                  />
                  <Text style={styles.settingsItemText}>Profile Visibility</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem}>
                <View style={styles.settingsItemInner}>
                  <Ionicons
                    name="ban"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: SPACING.small }}
                  />
                  <Text style={styles.settingsItemText}>Manage Blocked Users</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.settingsSectionTitle}>Privacy & Posts</Text>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setShowHiddenVideos(!showHiddenVideos);
                }}
              >
                <View style={styles.settingsItemInner}>
                  <Ionicons
                    name="eye-off-outline"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: SPACING.small }}
                  />
                  <Text style={styles.settingsItemText}>
                    {showHiddenVideos ? "Hide Hidden Videos" : "Manage Hidden Videos"}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} onPress={enterPinMode}>
                <View style={styles.settingsItemInner}>
                  <Ionicons
                    name="pin-outline"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: SPACING.small }}
                  />
                  <Text style={styles.settingsItemText}>Manage Pinned Videos</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.settingsSectionTitle}>Support & More</Text>
              <TouchableOpacity style={styles.settingsItem}>
                <View style={styles.settingsItemInner}>
                  <Ionicons
                    name="help-circle-outline"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: SPACING.small }}
                  />
                  <Text style={styles.settingsItemText}>Help</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => {
                  signOut(auth)
                    .then(() => router.replace("/auth/login"))
                    .catch(console.error);
                  setSettingsModalVisible(false);
                }}
              >
                <View style={styles.settingsItemInner}>
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: SPACING.small }}
                  />
                  <Text style={styles.settingsItemText}>Sign Out</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Video Options Modal */}
      <Modal
        visible={videoOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setVideoOptionsModal(false)}
      >
        <Pressable
          style={styles.videoOptionsOverlay}
          onPress={() => setVideoOptionsModal(false)}
        >
          <View style={styles.videoOptionsContainer}>
            <TouchableOpacity
              onPress={toggleVideoHidden}
              style={[
                styles.videoOptionButton,
                { backgroundColor: COLORS.accent, marginBottom: SPACING.small },
              ]}
            >
              <Text style={styles.videoOptionText}>
                {hiddenVideos.includes(selectedVideoForOptions) ? "Unhide Video" : "Hide Video"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleVideoPinned}
              style={[styles.videoOptionButton, { backgroundColor: COLORS.accent }]}
            >
              <Text style={styles.videoOptionText}>
                {pinnedVideos.includes(selectedVideoForOptions) ? "Unpin Video" : "Pin Video"}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEditProfileModal(false)}
      >
        <Pressable
          style={styles.editProfileModalOverlay}
          onPress={() => setEditProfileModal(false)}
        >
          <View style={styles.editProfileModal}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalSubtitle}>
              You can only change name/username 2 times every 14 days.
            </Text>
            <TextInput
              style={styles.bioInput}
              value={tempFname}
              onChangeText={setTempFname}
              placeholder="First Name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.bioInput}
              value={tempLname}
              onChangeText={setTempLname}
              placeholder="Last Name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.bioInput}
              value={tempUsername}
              onChangeText={setTempUsername}
              placeholder="Username"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.bioInput, { height: 60 }]}
              value={newBio}
              onChangeText={setNewBio}
              placeholder="Short Bio..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: SPACING.medium,
              }}
            >
              <TouchableOpacity
                onPress={() => setEditProfileModal(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveProfileEdits}
                style={[styles.saveButton, { backgroundColor: COLORS.accent }]}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/******************************************************************************
 * FULL-SCREEN FEED OVERLAY (Using expo-av)
 *****************************************************************************/
function VideoFeedOverlay({
  videos,
  startIndex,
  onClose,
}: {
  videos: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number>(startIndex);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>("");

  const SCREEN_HEIGHT = Dimensions.get("window").height;
  const SCREEN_WIDTH = Dimensions.get("window").width;

  useEffect(() => {
    if (videos[activeIndex]) {
      setActiveVideoUrl(videos[activeIndex]);
    }
  }, [activeIndex, videos]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleSave = async () => {
    if (!activeVideoUrl) return;
    try {
      await MediaLibrary.saveToLibraryAsync(activeVideoUrl);
      Alert.alert("Saved!", "Video saved to your Photos.");
    } catch (error) {
      Alert.alert("Error", "Could not save the video.");
    }
  };

  const handleShare = async () => {
    if (!activeVideoUrl) return;
    try {
      await Share.share({ url: activeVideoUrl, message: "Check out this video!" });
    } catch (error) {
      console.error("Error sharing video:", error);
    }
  };

  const renderItem = ({ item, index }: { item: string; index: number }) => (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
      <VideoItem videoUrl={item} isActive={index === activeIndex} />
    </View>
  );

  return (
    <SafeAreaView style={feedStyles.safeAreaView}>
      <StatusBar translucent backgroundColor="transparent" style="light" />
      <View style={feedStyles.container}>
        <View style={feedStyles.topBar}>
          <TouchableOpacity onPress={onClose} style={feedStyles.iconButton}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={feedStyles.iconButton}>
            <Ionicons name="download-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={feedStyles.iconButton}>
            <Ionicons name="share-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={videos}
          keyExtractor={(_, idx) => String(idx)}
          renderItem={renderItem}
          pagingEnabled
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={SCREEN_HEIGHT}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfigRef}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * i,
            index: i,
          })}
        />
      </View>
    </SafeAreaView>
  );
}

/******************************************************************************
 * SINGLE VIDEO ITEM (Using expo-av)
 *****************************************************************************/
function VideoItem({ videoUrl, isActive }: { videoUrl: string; isActive: boolean }) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      videoRef.current.playAsync();
      setIsPlaying(true);
    } else {
      videoRef.current.pauseAsync();
      videoRef.current.setPositionAsync(0);
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    const status = await videoRef.current.getStatusAsync();
    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await videoRef.current.playAsync();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  return (
    <TouchableOpacity activeOpacity={1} onPress={togglePlay} style={feedStyles.videoContainer}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={feedStyles.video}
        resizeMode="cover"
        isLooping
      />
      {!isPlaying && (
        <View style={feedStyles.pausedOverlay}>
          <Ionicons name="pause-circle" size={60} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

/******************************************************************************
 * STYLES
 *****************************************************************************/
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  settingsIconContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  heroContainer: {
    paddingTop: Platform.OS === "ios" ? 40 : 30,
    paddingBottom: SPACING.medium,
  },
  heroContent: {
    alignItems: "center",
  },
  profileImageContainer: {
    marginBottom: SPACING.small,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginTop: SPACING.small,
  },
  handle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xsmall,
    textAlign: "center",
  },
  bio: {
    color: COLORS.textPrimary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: SPACING.small,
    paddingHorizontal: 30,
  },
  bioPlaceholder: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: SPACING.small,
    paddingHorizontal: 30,
  },
  editProfileButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: SPACING.large,
    paddingVertical: SPACING.small,
    marginBottom: SPACING.medium,
    marginTop: 6,
    elevation: 2,
  },
  editProfileText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "500",
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: SPACING.small,
  },
  metricItem: {
    alignItems: "center",
    marginHorizontal: SPACING.medium,
  },
  metricBadge: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.xsmall,
    marginBottom: SPACING.xsmall,
  },
  metricValue: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  metricLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
  },
  pinnedSection: {
    paddingTop: SPACING.medium,
    paddingHorizontal: 40,
  },
  pinnedTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: SPACING.small,
  },
  pinnedScroll: {
    alignItems: "center",
  },
  pinnedVideoContainer: {
    width: 120,
    height: 120,
    marginRight: SPACING.small,
    overflow: "hidden",
  },
  pinnedVideoInner: {
    flex: 1,
    position: "relative",
  },
  pinIconContainer: {
    position: "absolute",
    top: SPACING.xsmall,
    right: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    padding: SPACING.xsmall,
  },
  promptBanner: {
    alignItems: "center",
    marginVertical: SPACING.medium,
    paddingHorizontal: SPACING.medium,
  },
  promptHighlight: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.highlight,
    borderRadius: 2,
    marginBottom: SPACING.small,
  },
  promptTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: SPACING.xsmall,
    textAlign: "center",
  },
  promptSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  hideModeBar: {
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.large,
    paddingVertical: SPACING.small,
    marginTop: SPACING.small,
  },
  hideModeText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  hideModeDoneText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  noVideosCTAContainer: {
    alignItems: "center",
    marginVertical: SPACING.large,
  },
  noVideosCTAText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.small,
    textAlign: "center",
  },
  recordButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: SPACING.large,
    paddingVertical: SPACING.small,
    elevation: 2,
  },
  recordButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  normalVideosContainer: {
    paddingHorizontal: 40,
  },
  videoContainer: {
    width: "46%",
    aspectRatio: 1,
    overflow: "hidden",
    backgroundColor: "transparent",
    marginBottom: SPACING.small,
    margin: 8,
    marginLeft: 30,
  },
  videoThumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  videoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#333",
  },
  placeholderBase: {
    backgroundColor: "#333",
  },
  showMoreButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.large,
    borderRadius: 8,
  },
  showMoreText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  settingsModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  settingsModalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    padding: SPACING.large,
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.medium,
  },
  settingsTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  settingsList: {
    flexGrow: 0,
  },
  settingsSectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginTop: SPACING.medium,
    marginBottom: SPACING.small,
  },
  settingsItem: {
    backgroundColor: COLORS.cardItemBackground,
    borderRadius: 10,
    padding: SPACING.small,
    marginBottom: SPACING.small,
  },
  settingsItemInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingsItemText: {
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  editProfileModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: SPACING.large,
  },
  editProfileModal: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: SPACING.large,
    width: "100%",
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: SPACING.small,
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.medium,
  },
  bioInput: {
    backgroundColor: "#333",
    color: COLORS.textPrimary,
    borderRadius: 8,
    padding: SPACING.small,
    fontSize: 14,
    marginBottom: SPACING.small,
  },
  cancelButton: {
    padding: SPACING.small,
    borderRadius: 10,
    backgroundColor: "#333",
    width: 80,
    alignItems: "center",
  },
  cancelText: {
    color: COLORS.textPrimary,
  },
  saveButton: {
    padding: SPACING.small,
    borderRadius: 10,
    width: 80,
    alignItems: "center",
  },
  saveText: {
    color: "#FFF",
  },
  videoOptionsOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: SPACING.large,
  },
  videoOptionsContainer: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: SPACING.large,
    width: "100%",
    alignItems: "center",
  },
  videoOptionButton: {
    borderRadius: 8,
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.large,
  },
  videoOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});

/******************************************************************************
 * FEED STYLES
 *****************************************************************************/
const feedStyles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 40 : 20,
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  iconButton: {
    padding: 10,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  pausedOverlay: {
    position: "absolute",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
});
