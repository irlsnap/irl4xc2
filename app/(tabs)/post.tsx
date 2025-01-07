import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import {
  Alert,
  Button,
  Image,
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ParallaxScrollView from "@/components/camera/ParallaxScrollView";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import { SymbolView } from "expo-symbols";
import { Colors } from "@/constants/Colors";
import { HelloWave } from "@/components/shared/HelloWave";
import VideoViewComponent from "@/components/video/VideoView";
import CameraTools from "@/components/camera/CameraTools";
import { router } from "expo-router";
import { useFirstTimeCamera } from "@/hooks/useFirstTimeCamera";
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import { useAppState } from "@react-native-community/hooks";
import { requestMediaLibraryPermissionsAsync } from "expo-image-picker";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import ComingSoonPage from "../misc/comingsoon";
import { format, isToday, differenceInSeconds } from "date-fns";
import Svg, { Circle } from "react-native-svg";

/** For the pink ring around the record button (30s limit). */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Single text bubble item, draggable */
function DraggableTextItem({
  id,
  text,
  onTextLongPress,
  pan,
}: {
  id: string;
  text: string;
  onTextLongPress: (id: string) => void;
  pan: Animated.ValueXY;
}) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        // “lift up” the new position so next drag starts from there
        pan.extractOffset();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        overlayStyles.textBubble,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
    >
      <Text
        style={overlayStyles.textBubbleText}
        onLongPress={() => onTextLongPress(id)}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

export default function Post() {
  /** 1) “First-time camera” logic **/
  const { isFirstTime, isLoading } = useFirstTimeCamera();

  /** 2) Camera references **/
  const cameraRef = useRef<Camera>(null);

  // For checking if we’re on screen & app is active
  const isFocused = useIsFocused();
  const appState = useAppState();
  const isActive = isFocused && appState === "active";

  /** 3) 2-Minute “BeReal” style local countdown **/
  const [timeLeftForNotification, setTimeLeftForNotification] = useState(120);
  useEffect(() => {
    let notifyInterval: NodeJS.Timeout | null = null;
    notifyInterval = setInterval(() => {
      setTimeLeftForNotification((prev) => {
        if (prev <= 1) {
          clearInterval(notifyInterval!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (notifyInterval) clearInterval(notifyInterval);
    };
  }, []);

  /** 4) A 30s ring for actual recording **/
  const RECORD_LIMIT = 30;
  const [timeLeftForRecording, setTimeLeftForRecording] = useState(RECORD_LIMIT);
  const [isRecording, setIsRecording] = useState(false);
  const [video, setVideo] = useState("");

  // For the pink ring animation
  const animatedValue = useRef(new Animated.Value(0)).current;
  const size = 100;
  const strokeWidth = 6;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  // We'll animate from circumference -> 0
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  const ringRotation = `rotate(-90 ${center} ${center})`;

  // Start/stop ring for 30s
  const startRingAnimation = () => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: RECORD_LIMIT * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) stopRecording();
    });
  };

  // Count down from 30
  useEffect(() => {
    let ringInterval: NodeJS.Timeout | null = null;
    if (isRecording) {
      ringInterval = setInterval(() => {
        setTimeLeftForRecording((prev) => {
          if (prev <= 1) {
            stopRecording();
            return RECORD_LIMIT;
          }
          return prev - 1;
        }, 1000);
      }, 1000);
    } else {
      setTimeLeftForRecording(RECORD_LIMIT);
    }
    return () => {
      if (ringInterval) clearInterval(ringInterval);
    };
  }, [isRecording]);

  const stopRecording = async () => {
    setIsRecording(false);
    animatedValue.stopAnimation();
    animatedValue.setValue(0);
    setTimeLeftForRecording(RECORD_LIMIT);

    // Actually stop the camera recording
    await cameraRef.current?.stopRecording();
  };

  const toggleRecord = async () => {
    if (timeLeftForNotification <= 0) {
      Alert.alert(
        "Time's up!",
        "You can’t record now; your 2 min window expired."
      );
      return;
    }

    if (isRecording) {
      await cameraRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      startRingAnimation();

      cameraRef.current?.startRecording({
        onRecordingFinished: (vid) => {
          setVideo(vid.path);
          console.log("Recorded path:", vid.path);
        },
        onRecordingError: (err) => console.error(err),
      });
    }
  };

  /** 5) Torch & camera facing (flip on double-tap) **/
  const [cameraTorch, setCameraTorch] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("back");
  const lastTapRef = useRef<number>(0);
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap => flip
      setCameraFacing((p) => (p === "back" ? "front" : "back"));
    }
    lastTapRef.current = now;
  };

  /** 6) Draggable text overlays **/
  const [textOverlays, setTextOverlays] = useState<
    { id: string; text: string; pan: Animated.ValueXY }[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [tempText, setTempText] = useState("");

  const handleAddText = () => {
    if (timeLeftForNotification <= 0) {
      Alert.alert("Time's up!", "You can’t add new text now!");
      return;
    }
    const newId = Math.random().toString(36).slice(2);
    setTextOverlays((prev) => [
      ...prev,
      { id: newId, text: "", pan: new Animated.ValueXY({ x: 100, y: 200 }) },
    ]);
    setEditingId(newId);
    setTempText("");
    setShowInput(true);
  };
  const handleLongPressText = (id: string) => {
    const bubble = textOverlays.find((b) => b.id === id);
    if (bubble) {
      setEditingId(id);
      setTempText(bubble.text);
      setShowInput(true);
    }
  };
  const handleDoneEditing = () => {
    if (editingId) {
      setTextOverlays((prev) =>
        prev.map((item) =>
          item.id === editingId ? { ...item, text: tempText } : item
        )
      );
    }
    setShowInput(false);
    setEditingId(null);
    setTempText("");
  };

  /** 7) Firestore logic—BUT no daily limit check, so multiple posts allowed **/
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [timeLeftDb, setTimeLeftDb] = useState<number | null>(null);
  const [postingStatus, setPostingStatus] = useState("");

  // Helper to parse Firestore date/time
  function convertToDate(dateString: string) {
    const [month, day, year] = dateString.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
  function parseTime(timeString: string) {
    const [time, modifier] = timeString.split(" "); // or a different space
    let [hours, minutes, seconds] = time.split(":").map(Number);
    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return { hours, minutes, seconds };
  }

  useFocusEffect(
    useCallback(() => {
      const checkIfPostedToday = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        try {
          const userDoc = doc(db, "users", currentUser.uid);
          const userSnapshot = await getDoc(userDoc);
          const post = userSnapshot.data()?.post || "";
          // If the user has posted, track it but do NOT block additional posts
          if (post) setHasPostedToday(true);
          else setHasPostedToday(false);
        } catch (error) {
          console.error("Error fetching user post data:", error);
        }
      };

      const fetchTimeDoc = async () => {
        try {
          const qTime = query(
            collection(db, "time"),
            orderBy("date", "desc"),
            limit(1)
          );
          const querySnapshot = await getDocs(qTime);
          if (!querySnapshot.empty) {
            const latestDoc = querySnapshot.docs[0].data();
            const postDate = latestDoc.date;
            const postTime = latestDoc.time;

            const { hours, minutes, seconds } = parseTime(postTime);
            const postDateTime = convertToDate(postDate);
            postDateTime.setHours(hours, minutes, seconds, 0);

            const now = new Date();
            const timeDifference = -differenceInSeconds(postDateTime, now);

            if (isToday(postDateTime)) {
              if (timeDifference > 0 && timeDifference <= 120) {
                setTimeLeftDb(-timeDifference + 120);
                setPostingStatus("");
              } else {
                setPostingStatus("Posting Late");
              }
            } else {
              setPostingStatus("Posting Late");
            }
          }
        } catch (error) {
          console.error("Error fetching latest post:", error);
        }
      };

      checkIfPostedToday();
      fetchTimeDoc();
    }, [])
  );

  // Countdown for Firestore-based “timeLeftDb”
  useEffect(() => {
    if (timeLeftDb === null) return;
    if (timeLeftDb <= 0) {
      setPostingStatus("Time's Up!");
      return;
    }
    const timer = setInterval(() => {
      setTimeLeftDb((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeftDb]);

  const formatTimeLeft = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSec = seconds % 60;
    return `${minutes}:${remainingSec < 10 ? `0${remainingSec}` : remainingSec}`;
  };

  /** 8) Permissions */
  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.getCameraPermissionStatus();
      if (cameraPermission === "denied") {
        await Camera.requestCameraPermission();
      }
      const micPermission = await Camera.getMicrophonePermissionStatus();
      if (micPermission === "denied") {
        await Camera.requestMicrophonePermission();
      }
    })();
  }, []);

  async function requestAllPermissions() {
    const cameraStatus = await Camera.requestCameraPermission();
    if (cameraStatus === "denied") {
      Alert.alert("Error", "Camera permission is required.");
      return false;
    }
    const micStatus = await Camera.requestMicrophonePermission();
    if (micStatus === "denied") {
      Alert.alert("Error", "Microphone permission is required.");
      return false;
    }
    const mediaLibraryStatus = await requestMediaLibraryPermissionsAsync();
    if (!mediaLibraryStatus.granted) {
      Alert.alert("Error", "Media Library permission is required.");
      return false;
    }
    await AsyncStorage.setItem("hasOpened", "true");
    return true;
  }

  const handleContinue = async () => {
    const granted = await requestAllPermissions();
    if (granted) {
      router.replace("/(tabs)/post");
    } else {
      Alert.alert("Please grant permissions in Settings");
    }
  };

  /** 9) If device is not ready yet, or if hooking up “firstTimeCamera” logic */
  const device = useCameraDevice(cameraFacing);
  if (isLoading) return null;
  if (!device) return null;

  // Show first-time camera UI
  if (isFirstTime) {
    return (
      <ParallaxScrollView
        headerBackgroundColor={{
          light: Colors.light.tint + 10,
          dark: Colors.light.tint + 10,
        }}
        headerImage={
          <SymbolView
            name="camera.circle"
            size={250}
            type="hierarchical"
            animationSpec={{
              effect: {
                type: "bounce",
              },
            }}
            tintColor={Colors.light.tint}
            fallback={
              <Image
                source={require("@/assets/images/app_logo_transparent.png")}
                style={styles.reactLogo}
              />
            }
          />
        }
      >
        <Image
          source={require("@/assets/images/app_logo_transparent.png")}
          style={styles.logo}
        />
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">IRL Camera!</ThemedText>
          <HelloWave />
        </ThemedView>
        <ThemedView style={styles.stepContainer}>
          <ThemedText>
            Welcome! We need camera/mic permissions for the best experience:
          </ThemedText>
        </ThemedView>
        <Button title="Continue" onPress={handleContinue} />
      </ParallaxScrollView>
    );
  }

  // If user has recorded a video => show preview
  if (video) {
    return <VideoViewComponent video={video} setVideo={setVideo} />;
  }

  /** 10) Render the main camera UI, no single-post limit **/
  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={{ flex: 1 }}>
        {/* Firestore “timeLeftDb” countdown or status */}
        <SafeAreaView
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            zIndex: 4,
          }}
        >
          {timeLeftDb !== null ? (
            <ThemedText type="subtitle">
              Time Left: {formatTimeLeft(timeLeftDb)}
            </ThemedText>
          ) : (
            <ThemedText type="subtitle">{postingStatus}</ThemedText>
          )}
          {/* Local 2-min countdown for fun */}
          <ThemedText type="subtitle">{timeLeftForNotification}s</ThemedText>
          {hasPostedToday && (
            <Text style={{ color: "#fff", marginTop: 4 }}>
              You’ve already posted once today – but you can post again!
            </Text>
          )}
        </SafeAreaView>

        {/* Actual camera preview */}
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          ref={cameraRef}
          isActive={isActive}
          enableZoomGesture
          torch={cameraTorch ? "on" : "off"}
          video
          audio
        />

        {/* Pink ring for 30s record limit */}
        <View style={styles.recordRingContainer}>
          <View style={styles.svgWrapper}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Dim circle behind */}
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="#ccc"
                strokeOpacity={0.2}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke="#ff3399"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={ringRotation}
              />
            </Svg>
            {/* Record button in center */}
            <TouchableOpacity
              onPress={toggleRecord}
              style={[
                styles.innerButton,
                isRecording && styles.innerButtonActive,
              ]}
            />
          </View>
        </View>

        {/* Show ring countdown if desired */}
        <View style={styles.ringTimerText}>
          <ThemedText style={styles.timerText}>
            {timeLeftForRecording}s
          </ThemedText>
        </View>

        {/* Draggable text overlays */}
        {textOverlays.map((item) => (
          <DraggableTextItem
            key={item.id}
            id={item.id}
            text={item.text}
            onTextLongPress={handleLongPressText}
            pan={item.pan}
          />
        ))}

        {/* If user is editing text */}
        {showInput && (
          <View style={overlayStyles.inputContainer}>
            <TextInput
              placeholder="Share something?"
              placeholderTextColor="#bbb"
              style={overlayStyles.textInput}
              value={tempText}
              onChangeText={setTempText}
              onSubmitEditing={handleDoneEditing}
              autoFocus
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={handleDoneEditing}
              style={overlayStyles.doneButton}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Torch toggle & camera flip (in CameraTools). The “T” icon for text. */}
        <CameraTools
          cameraTorch={cameraTorch}
          setCameraFacing={setCameraFacing}
          setCameraTorch={setCameraTorch}
        />
        <TouchableOpacity
          style={[styles.textButton, { top: 190 }]}
          onPress={handleAddText}
        >
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "bold" }}>
            T
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

/** Main styles + ring styling */
const styles = StyleSheet.create({
  recordRingContainer: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    zIndex: 12,
  },
  svgWrapper: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  innerButton: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
  },
  innerButtonActive: {
    backgroundColor: "#ffd1e6",
  },
  ringTimerText: {
    position: "absolute",
    top: "10%",
    left: "50%",
    transform: [{ translateX: -25 }],
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 5,
    borderRadius: 8,
  },
  timerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  textButton: {
    position: "absolute",
    right: 20,
    zIndex: 999,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },
  logo: {
    width: "20%",
    height: "20%",
    right: "5%",
    position: "absolute",
    zIndex: 2,
    backgroundColor: "transparent",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "2%",
    marginTop: "3%",
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
    marginLeft: "2%",
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});

/** Overlays (input & bubble) */
const overlayStyles = StyleSheet.create({
  inputContainer: {
    position: "absolute",
    top: 140,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 30,
  },
  textInput: {
    minWidth: 160,
    color: "#fff",
    padding: 4,
    marginRight: 8,
  },
  doneButton: {
    backgroundColor: "#ff3399",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 5,
  },
  textBubble: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ff3399",
    shadowColor: "#ff60d7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    zIndex: 25,
  },
  textBubbleText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
