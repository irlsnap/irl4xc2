import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  Alert,
  Button,
  Image,
  SafeAreaView,
  StyleSheet,
  View,
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
import CameraButton from "@/components/camera/CameraButton";
import CameraTools from "@/components/camera/CameraTools";
import { router, useLocalSearchParams } from "expo-router";
import { useFirstTimeCamera } from "@/hooks/useFirstTimeCamera";
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import { useAppState } from "@react-native-community/hooks";
import { requestMediaLibraryPermissionsAsync } from "expo-image-picker";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";  // Firestore imports
import { auth, db } from '../firebaseConfig';
import ComingSoonPage from '../misc/comingsoon';
import { format, isToday, differenceInSeconds } from 'date-fns'; // Import for time comparison
import ReactionViewComponent from "@/components/video/ReactionView";

export default function Reaction() {
  const { isFirstTime, isLoading } = useFirstTimeCamera();
  const cameraRef = useRef<Camera>(null);
  const isFocused = useIsFocused();
  const appState = useAppState();
  const isActive = isFocused && appState === "active";
  const [cameraTorch, setCameraTorch] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">(
    "back"
  );
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [video, setVideo] = useState<string>("");
  const [timer, setTimer] = useState<number>(10); // Timer state set to 10 seconds

  const { friendUid } = useLocalSearchParams();

  const device = useCameraDevice(cameraFacing, 
    {
    physicalDevices: [
      'ultra-wide-angle-camera'
    ]}
  );

  useEffect(() => {
    async function checkPermissions() {
      const cameraPermission = Camera.getCameraPermissionStatus();
      if (cameraPermission == "denied") {
        await Camera.requestCameraPermission();
      }

      const microphonePermission = Camera.getMicrophonePermissionStatus();
      if (microphonePermission == "denied") {
        await Camera.requestMicrophonePermission();
      }
    }

    checkPermissions();
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      stopRecording();
    }

    return () => clearInterval(interval);
  }, [isRecording, timer]);

  const stopRecording = async () => {
    setTimer(10);
    await cameraRef.current?.stopRecording();
    setIsRecording(false);
  }

  const handleContinue = async () => {
    const allPermissionsGranted = await requestAllPermissions();
    if (allPermissionsGranted) {
      // Navigate to tabs
      router.replace("/(tabs)/post");
    } else {
      Alert.alert("To continue, please provide permissions in settings");
    }
  };

  async function requestAllPermissions() {
    const cameraStatus = await Camera.requestCameraPermission();
    if (cameraStatus == "denied") {
      Alert.alert("Error", "Camera permission is required.");
      return false;
    }

    const microphoneStatus = await Camera.requestMicrophonePermission();
    if (microphoneStatus == "denied") {
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

  if (isLoading) return <></>;

  if (isFirstTime)
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
            Congrats on starting your first post! {"\n"}To provide the best
            experience, this app requires permissions for the following:
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Camera Permissions</ThemedText>
          <ThemedText>🎥 For taking pictures and videos</ThemedText>
        </ThemedView>
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Microphone Permissions</ThemedText>
          <ThemedText>🎙️ For taking videos with audio</ThemedText>
        </ThemedView>
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Media Library Permissions</ThemedText>
          <ThemedText>📸 To save/view your amazing shots</ThemedText>
        </ThemedView>
        <Button title="Continue" onPress={handleContinue} />
      </ParallaxScrollView>
    );

  async function toggleRecord() {
    if (isRecording) {
      await cameraRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const video = cameraRef.current?.startRecording({
        onRecordingFinished: (video) => { setVideo(video.path); console.log(video.path); },
        onRecordingError: (error) => console.error(error),
      });
    }
  }

  if (device == null) return <></>;
  if (video) return <ReactionViewComponent video={video} setVideo={setVideo} friendUID={friendUid} />;
  
  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        ref={cameraRef}
        isActive={isActive}
        enableZoomGesture={true}
        torch={cameraTorch ? "on" : "off"}
        video={true}
        audio={true}
      />
      <View style={styles.timerContainer}>
        <ThemedText style={styles.timerText}>{timer}s</ThemedText>
      </View>
      <CameraTools
        cameraTorch={cameraTorch}
        setCameraFacing={setCameraFacing}
        setCameraTorch={setCameraTorch}
      />
      <CameraButton 
        isRecording={isRecording}
        handleTakePicture={toggleRecord}
        cameraMode={"video"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  timerContainer: {
    position: "absolute",
    top: 50,
    left: "50%",
    transform: [{ translateX: -25 }],
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 10,
  },
  timerText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
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
    marginLeft: '2%',
    marginTop: '3%',
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
    marginLeft: '2%',
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
