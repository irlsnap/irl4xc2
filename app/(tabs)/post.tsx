import React, { useCallback, useEffect } from "react";
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
import { router } from "expo-router";
import { useFirstTimeCamera } from "@/hooks/useFirstTimeCamera";
import { useIsFocused } from "@react-navigation/native";
import { useAppState } from "@react-native-community/hooks";

export default function Post() {
  const { isFirstTime, isLoading } = useFirstTimeCamera();
  const cameraRef = React.useRef<Camera>(null);
  const isFocused = useIsFocused();
  const appState = useAppState();
  const isActive = isFocused && appState === "active";
  const [cameraTorch, setCameraTorch] = React.useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = React.useState<"front" | "back">(
    "back"
  );
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [video, setVideo] = React.useState<string>("");


  const device = useCameraDevice(cameraFacing, 
    {
    physicalDevices: [
      'ultra-wide-angle-camera'
    ]}
  );
  
  const onFlipCameraPressed = useCallback(() => {
    setCameraFacing((p) => (p === 'back' ? 'front' : 'back'))
  }, [])

  React.useEffect(() => {
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
        onRecordingFinished: (video) => {setVideo(video.path); console.log(video.path)},
        onRecordingError: (error) => console.error(error),
      });
    }
  }

  if (device == null) return <></>;
  if (video) return <VideoViewComponent video={video} setVideo={setVideo} />;
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
      <CameraTools
        cameraTorch={cameraTorch}
        setCameraFacing={setCameraFacing}
        setCameraTorch={setCameraTorch}
      />
      <CameraButton 
        isRecording={isRecording}
        handleTakePicture={
          toggleRecord
        }
        cameraMode={"video"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
