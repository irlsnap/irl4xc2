import React, { useEffect, useState, useRef } from "react";
import {
  Alert,
  Button,
  Image,
  StyleSheet,
  View,
  ActivityIndicator,
  ProgressBarAndroid,
  Platform,
  Text,
} from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { useLocalSearchParams, router } from "expo-router";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import CameraButton from "@/components/camera/CameraButton";

export default function Reaction() {
  const cameraRef = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [video, setVideo] = useState<string>("");
  const [timer, setTimer] = useState<number>(10);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const { friendUid } = useLocalSearchParams();

  const device = useCameraDevice("front");

  useEffect(() => {
    async function checkPermissions() {
      const cameraPermission = await Camera.getCameraPermissionStatus();
      const microphonePermission = await Camera.getMicrophonePermissionStatus();

      if (cameraPermission === "denied") {
        await Camera.requestCameraPermission();
      }

      if (microphonePermission === "denied") {
        await Camera.requestMicrophonePermission();
      }
    }

    checkPermissions();
  }, []);

  const stopRecording = async () => {
    setTimer(10);
    await cameraRef.current?.stopRecording();
    setIsRecording(false);
  };

  const uploadVideo = async (videoPath: string): Promise<string> => {
    console.log("Starting video upload...");
    setIsUploading(true);
    try {
      const storage = getStorage();
      const videoRef = ref(storage, `reactions/${Date.now()}.mov`);

      const response = await fetch(videoPath);
      const blob = await response.blob();

      const uploadTask = uploadBytesResumable(videoRef, blob);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            console.log(`Upload progress: ${progress}%`);
          },
          (error) => {
            console.error("Error during upload:", error);
            setIsUploading(false);
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(videoRef);
            console.log("Upload successful! Download URL:", downloadURL);
            setIsUploading(false);
            resolve(downloadURL);
          }
        );
      });
    } catch (error) {
      console.error("Video upload failed:", error);
      setIsUploading(false);
      throw error;
    }
  };

  const addReactionToUser = async (videoURL: string) => {
    console.log("Adding reaction to user with ID:", friendUid);

    try {
      const userRef = doc(db, "users", friendUid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error("User does not exist:", friendUid);
        Alert.alert("Error", "The user you're reacting to does not exist.");
        return;
      }

      await updateDoc(userRef, {
        reactions: arrayUnion(videoURL),
        reactionUids: arrayUnion(auth.currentUser?.uid),
      });

      console.log("Reaction added successfully!");
      Alert.alert("Success", "Your reaction has been added.");
      router.replace("/(tabs)/");
    } catch (error) {
      console.error("Failed to add reaction:", error);
      Alert.alert("Error", "Failed to add your reaction. Please try again.");
    }
  };

  const toggleRecord = async () => {
    if (isRecording) {
      console.log("Stopping recording...");
      await cameraRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      console.log("Starting recording...");
      setIsRecording(true);
      cameraRef.current?.startRecording({
        onRecordingFinished: async (video) => {
          console.log("Recording finished. Video path:", video.path);
          setVideo(video.path);

          try {
            const videoURL = await uploadVideo(video.path);
            await addReactionToUser(videoURL);
          } catch (error) {
            console.error("Error during recording flow:", error);
          }
        },
        onRecordingError: (error) => console.error("Recording error:", error),
      });
    }
  };

  if (device == null) return <></>;

  if (isUploading) {
    return (
      <View style={styles.uploadContainer}>
        {Platform.OS === "android" ? (
          <ProgressBarAndroid styleAttr="Horizontal" progress={uploadProgress / 100} />
        ) : (
          <ActivityIndicator size="large" color="#0000ff" />
        )}
        <Text style={{ marginTop: 20 }}>Uploading... {uploadProgress.toFixed(0)}%</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        ref={cameraRef}
        isActive={true}
        enableZoomGesture={true}
        video={true}
        audio={true}
      />
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{timer}s</Text>
      </View>
      <CameraButton isRecording={isRecording} handleTakePicture={toggleRecord} cameraMode={"video"} />
    </View>
  );
}

const styles = StyleSheet.create({
  timerContainer: {
    position: "absolute",
    top: "7%",
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
  uploadContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
