import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Alert,
  Animated,
  Easing,
  PanResponder,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useAppState } from "@react-native-community/hooks";
import { requestMediaLibraryPermissionsAsync } from "expo-image-picker";
import Svg, { Circle } from "react-native-svg";

import ReactionViewComponent from "@/components/video/ReactionView";

/** Draggable text bubble, just like in post.tsx */
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ReactionVideo() {
  const router = useRouter();
  const { friendUid, isReply, reactingTo } = useLocalSearchParams<{
    friendUid?: string;
    isReply?: string;
    reactingTo?: string;
  }>();

  /** Camera references (Vision Camera) */
  const cameraRef = useRef<Camera>(null);
  const [cameraTorch, setCameraTorch] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("back");

  // Figure out which device to use
  const device = useCameraDevice(cameraFacing);
  const isFocused = useIsFocused();
  const appState = useAppState();
  const isActive = isFocused && appState === "active";

  /** Pink ring with 15s limit */
  const RECORD_LIMIT = 15;
  const [timeLeft, setTimeLeft] = useState(RECORD_LIMIT);
  const [isRecording, setIsRecording] = useState(false);
  const [videoPath, setVideoPath] = useState("");

  const animatedValue = useRef(new Animated.Value(0)).current;
  const size = 100;
  const strokeWidth = 6;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  const ringRotation = `rotate(-90 ${center} ${center})`;

  /** Draggable Text Overlays */
  const [textOverlays, setTextOverlays] = useState<
    { id: string; text: string; pan: Animated.ValueXY }[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [tempText, setTempText] = useState("");

  // Double-tap => flip camera
  const lastTapRef = useRef<number>(0);
  const handleTap = () => {
    const now = Date.now();
    // If the time between taps is <300ms, assume double tap => flip camera
    if (now - lastTapRef.current < 300) {
      setCameraFacing((prev) => (prev === "back" ? "front" : "back"));
    }
    lastTapRef.current = now;
  };

  // Ask for camera & mic permissions once
  useEffect(() => {
    (async () => {
      const camStatus = await Camera.requestCameraPermission();
      if (camStatus === "denied") {
        Alert.alert("Error", "Camera permission is required.");
      }
      const micStatus = await Camera.requestMicrophonePermission();
      if (micStatus === "denied") {
        Alert.alert("Error", "Microphone permission is required.");
      }
    })();
  }, []);

  // Additional media library permission if needed
  async function requestAllPermissions() {
    // We'll request the media library as well
    const mediaLibStatus = await requestMediaLibraryPermissionsAsync();
    if (!mediaLibStatus.granted) {
      Alert.alert("Error", "Media Library permission is required.");
      return false;
    }
    await AsyncStorage.setItem("hasOpened", "true");
    return true;
  }

  /** Start or stop the recording */
  const toggleRecord = async () => {
    if (isRecording) {
      // stop immediately
      stopRecording();
    } else {
      // start
      const granted = await requestAllPermissions();
      if (!granted) return;
      setIsRecording(true);
      startRingAnimation();

      cameraRef.current?.startRecording({
        // If needed, specify: maxDuration: 15, etc.
        onRecordingFinished: (video) => {
          setVideoPath(video.path);
          console.log("Recorded path:", video.path);
        },
        onRecordingError: (err) => {
          console.error(err);
          Alert.alert("Recording Error", err?.message || String(err));
        },
      });
    }
  };

  /** Pink ring animation */
  const startRingAnimation = () => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: RECORD_LIMIT * 1000, // 15s
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      // if user hasn't stopped manually, stop once ring hits 15s
      if (finished) stopRecording();
    });
  };

  /** Countdown from 15 */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return RECORD_LIMIT;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeLeft(RECORD_LIMIT);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  /** Actually stop the recording */
  const stopRecording = async () => {
    setIsRecording(false);
    animatedValue.stopAnimation(); // stop the ring animation
    animatedValue.setValue(0); // reset ring
    setTimeLeft(RECORD_LIMIT);
    await cameraRef.current?.stopRecording();
  };

  /** If we have a recorded video => preview it in ReactionViewComponent */
  if (videoPath) {
    return (
      <ReactionViewComponent
        video={videoPath}
        setVideo={setVideoPath}
        friendUID={friendUid}
        isReply={!!isReply}
        reactingTo={reactingTo}
      />
    );
  }

  /** Draggable text logic */
  const handleAddText = () => {
    const newId = Math.random().toString(36).slice(2);
    setTextOverlays((prev) => [
      ...prev,
      {
        id: newId,
        text: "",
        pan: new Animated.ValueXY({ x: 100, y: 200 }),
      },
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

  /** If camera device is not ready => don't render anything yet */
  if (!device) return null;

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.container}>
        {/* 1) The camera feed behind everything */}
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          video
          audio
          torch={cameraTorch ? "on" : "off"}
          enableZoomGesture
        />

        {/* 2) Back button (top-left) */}
        <View style={styles.topLeftButton}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={32} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* 3) Icons (flash, flip camera, add text) in top-right */}
        <View style={styles.topRightIcons}>
          {/* Torch icon */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setCameraTorch((prev) => !prev)}
          >
            <Ionicons
              name={cameraTorch ? "flash" : "flash-off"}
              size={32}
              color="#fff"
            />
          </TouchableOpacity>

          {/* Switch camera icon */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              setCameraFacing((prev) => (prev === "back" ? "front" : "back"))
            }
          >
            <Ionicons name="camera-reverse-outline" size={34} color="#fff" />
          </TouchableOpacity>

          {/* T icon => add text bubble (raised up a bit) */}
          <TouchableOpacity
            style={[styles.iconButton, { marginTop: 10 }]}
            onPress={handleAddText}
          >
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "bold" }}>
              T
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4) Draggable text overlays */}
        {textOverlays.map((overlay) => (
          <DraggableTextItem
            key={overlay.id}
            id={overlay.id}
            text={overlay.text}
            pan={overlay.pan}
            onTextLongPress={handleLongPressText}
          />
        ))}

        {/* 5) If user is editing text => input */}
        {showInput && (
          <View style={overlayStyles.inputContainer}>
            <TextInput
              placeholder="Type something..."
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

        {/* 6) Pink ring + record button at bottom center */}
        <View style={styles.recordRingContainer}>
          <View style={styles.svgWrapper}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* background ring */}
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

            {/* The record button (white circle) in the center */}
            <TouchableOpacity
              onPress={toggleRecord}
              style={[
                styles.innerButton,
                isRecording && styles.innerButtonActive,
              ]}
            />
          </View>

          {/* Show the countdown below */}
          <View style={styles.timerOverlay}>
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Use a dark background just in case the camera doesn't fill
    backgroundColor: "#000",
  },
  // Back arrow in top-left
  topLeftButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 999,
  },
  // Right-side icons (torch, flip, text)
  topRightIcons: {
    position: "absolute",
    top: 60,
    right: 20,
    alignItems: "center",
    zIndex: 20,
  },
  iconButton: {
    paddingVertical: 10,
  },
  // Pink ring container at bottom
  recordRingContainer: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    zIndex: 50,
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
  timerOverlay: {
    marginTop: 8,
    alignSelf: "center",
  },
  timerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

/** Additional overlay styles for text input & bubble */
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
    zIndex: 999,
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
    zIndex: 998,
  },
  textBubbleText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});