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
import { router } from "expo-router";
import { useFirstTimeCamera } from "@/hooks/useFirstTimeCamera";
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import { useAppState } from "@react-native-community/hooks";
import { requestMediaLibraryPermissionsAsync } from "expo-image-picker";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";  // Firestore imports
import { auth, db } from '../firebaseConfig';
import ComingSoonPage from '../misc/comingsoon';
import { format, isToday, differenceInSeconds } from 'date-fns'; // Import for time comparison

export default function Post() {
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
  const [hasPostedToday, setHasPostedToday] = useState<boolean>(false); // Track if user has posted today
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Timer countdown
  const [postingStatus, setPostingStatus] = useState<string>(""); // Posting Late or timer

  const device = useCameraDevice(cameraFacing, 
    {
    physicalDevices: [
      'ultra-wide-angle-camera'
    ]}
  );

  // Fetch the user's post status
  const checkIfPostedToday = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userDoc = doc(db, 'users', currentUser.uid);
      const userSnapshot = await getDoc(userDoc);
      const post = userSnapshot.data()?.post || '';

      // If the 'post' field is not an empty string, it means the user has already posted today
      if (post) {
        setHasPostedToday(true);
      } else {
        setHasPostedToday(false);
      }
    } catch (error) {
      console.error("Error fetching user post data:", error);
    }
  }, []);

  function convertToDate(dateString: string) {
    const [month, day, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day); 
  }

  const parseTime = (timeString: string) => {
    const [time, modifier] = timeString.split(' '); // Split time and AM/PM
    let [hours, minutes, seconds] = time.split(":").map(Number); // Split hours, minutes, seconds
  
    if (modifier === "PM" && hours < 12) {
      hours += 12; // Convert PM hours to 24-hour format
    } else if (modifier === "AM" && hours === 12) {
      hours = 0; // Handle midnight (12 AM)
    }
  
    return { hours, minutes, seconds };
  };

  const fetchLatestPost = useCallback(async () => {
    try {
      const q = query(collection(db, "time"), orderBy("date", "desc"), limit(1)); // Fetch the latest document
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const latestDoc = querySnapshot.docs[0].data();
        
        // Assume your document has fields 'date' and 'time'
        const postDate = latestDoc.date; // Firestore Timestamp to JS Date
        const postTime = latestDoc.time; // Time stored in string like 'HH:mm'
        
        // Parse the time with AM/PM
        const { hours, minutes, seconds } = parseTime(postTime);
        const postDateTime = convertToDate(postDate);

        postDateTime.setHours(hours, minutes, seconds, 0); // Set parsed time to the postDate
        
        const now = new Date();

        console.log(hours, minutes, seconds)
        console.log(now)
        
        // Check if the post is today
        if (isToday(postDateTime)) {
          const timeDifference = -differenceInSeconds(postDateTime, now);
          console.log(timeDifference)
          
          // If the current time is within 2 minutes of the post time
          if (timeDifference > 0 && timeDifference <= 120) {
            setTimeLeft(-timeDifference + 120); // Set timer to postTime + 2 minutes
            setPostingStatus(""); // Reset posting status
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
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const fetchUser = async () => {
        try {
          const q = query(collection(db, "time"), orderBy("date", "desc"), limit(1)); // Fetch the latest document
          const querySnapshot = await getDocs(q);
    
          if (!querySnapshot.empty) {
            const latestDoc = querySnapshot.docs[0].data();
            
            // Assume your document has fields 'date' and 'time'
            const postDate = latestDoc.date; // Firestore Timestamp to JS Date
            const postTime = latestDoc.time; // Time stored in string like 'HH:mm'
            
            // Parse the time with AM/PM
            const { hours, minutes, seconds } = parseTime(postTime);
            const postDateTime = convertToDate(postDate);
    
            postDateTime.setHours(hours, minutes, seconds, 0); // Set parsed time to the postDate
            
            const now = new Date();
    
            console.log(hours, minutes, seconds)
            console.log(now)
            
            // Check if the post is today
            if (isToday(postDateTime)) {
              const timeDifference = -differenceInSeconds(postDateTime, now);
              console.log(timeDifference)
              
              // If the current time is within 2 minutes of the post time
              if (timeDifference > 0 && timeDifference <= 120) {
                setTimeLeft(-timeDifference + 120); // Set timer to postTime + 2 minutes
                setPostingStatus(""); // Reset posting status
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
  
      fetchUser();
  
      return () => {
        // isActive = false;
      };
    }, [timeLeft, postingStatus])
  );

  useEffect(() => {
    checkIfPostedToday();
  }, [checkIfPostedToday, fetchLatestPost]);

  const onFlipCameraPressed = useCallback(() => {
    setCameraFacing((p) => (p === 'back' ? 'front' : 'back'));
  }, []);

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

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      setPostingStatus("Time's Up!");
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => (prevTime === null ? null : prevTime - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimeLeft = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds}`;
  };

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

  // Show ComingSoonPage if the user has posted today
  if (hasPostedToday) {
    return <ComingSoonPage text="You've already posted today. Come back tmrw to post again!" />;
  }

  if (device == null) return <></>;
  if (video) return <VideoViewComponent video={video} setVideo={setVideo} />;
  
  return (
    <View style={{ flex: 1 }}>
      {timeLeft !== null ? (
        <SafeAreaView style={{position: "absolute",
          alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            zIndex: 4,
         }}>
          <ThemedText type="subtitle">Time Left: {formatTimeLeft(timeLeft)}</ThemedText>
        </SafeAreaView>
        ) : (
          <SafeAreaView style={{position: "absolute",
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            zIndex: 4,
           }}>
            <ThemedText type="subtitle">{postingStatus}</ThemedText>
          </SafeAreaView>
        )}
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
        handleTakePicture={toggleRecord}
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
