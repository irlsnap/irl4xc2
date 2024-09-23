import { useEffect, useRef, useState } from "react";
import { useVideoPlayer, VideoView } from "expo-video";
import { Alert, Button, View, StyleSheet } from "react-native";
import IconButton from "../camera/IconButton";
import { saveToLibraryAsync } from "expo-media-library";
import * as MediaLibrary from 'expo-media-library';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { uploadBytesResumable, getDownloadURL, ref } from "firebase/storage";
import { auth, db, storage } from "../../app/firebaseConfig";
import { ProgressBar } from "react-native-paper";
import { addDoc, arrayUnion, collection, doc, setDoc, updateDoc } from "firebase/firestore";

interface VideoViewProps {
  video: string;
  setVideo: React.Dispatch<React.SetStateAction<string>>;
}

export default function VideoViewComponent({ video, setVideo }: VideoViewProps) {
  const reff = useRef<VideoView>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const player = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });
  const [progress, setProgress] = useState(0);
  const [uid, setUid] = useState("");

  useEffect(() => {
    const subscription = player.addListener("playingChange", (isPlaying) => {
      setIsPlaying(isPlaying);
    });

    if (auth.currentUser) setUid(auth.currentUser.uid)

    return () => {
      subscription.remove();
    };
  }, [player]);

  async function uploadImage(uri: string, fileType: string) {
    console.log(uri)
    const response = await fetch(uri);
    console.log(response)
    const blob = await response.blob();
    console.log(blob)
    const docRef = await addDoc(collection(db, "videos"), {});
    const storageRef = ref(storage, "videos/"+docRef.id);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    // Listen for upload events
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log("Upload is " + progress + "% done");
        setProgress(progress); // Update the progress in state
      },
      (error) => {
        // Handle any error that occurs during upload
        console.error("Upload failed", error);
      },
      async () => {
        // On successful upload
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("File available at", downloadURL);

          // Save the video URL to the 'videos' field as an array and the 'post' field as a string
          await updateDoc(doc(db, "users", uid), {
            videos: arrayUnion(downloadURL), // Add to 'videos' field (array)
            post: downloadURL,               // Set 'post' field as a string
          });

          // Clear the video input state after the upload
          setVideo("");

          console.log("Video URL saved to both 'videos' and 'post' fields");
        } catch (error) {
          console.error("Error saving video URL to Firestore:", error);
        }
      }
    );
  }

  if (progress > 0) return <ProgressBar style={{marginTop:"50%"}} progress={progress/100.0} color="blue"/>
  return (
    <Animated.View
      layout={LinearTransition}
      entering={FadeIn}
      exiting={FadeOut}
      style={styles.container}
    >
      <View
        style={{
          position: "absolute",
          right: 6,
          zIndex: 1,
          paddingTop: 100,
          gap: 16,
        }}
      >
        <IconButton
          onPress={() => setVideo("")}
          iosName={"xmark"}
          androidName="close"
        />
        <IconButton
          onPress={async () => {
            saveToLibraryAsync(video);
            Alert.alert("✅ video saved!");
          }}
          iosName={"arrow.down"}
          androidName="close"
        />
        <IconButton
          iosName={isPlaying ? "pause" : "play"}
          androidName={isPlaying ? "pause" : "play"}
          onPress={() => {
            if (isPlaying) {
              player.pause();
            } else {
              player.play();
            }
            setIsPlaying(!isPlaying);
          }}
        />
      </View>
      <VideoView
        ref={reff}
        style={{
          width: "100%",
          height: "100%",
        }}
        player={player}
        allowsFullscreen
        nativeControls={true}
      />
      
      {/* Absolute Submit Button */}
      <View style={styles.submitButtonContainer}>
        <Button
          title="Submit"
          onPress={() => {
            // Handle submit action here
            uploadImage(video, "video");
            // Alert.alert("Submitting video...");
          }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  submitButtonContainer: {
    position: "absolute",
    bottom: 20,
    left: "40%",
    right: "40%",
    zIndex: 10,
    backgroundColor: "black",
    borderRadius: 10
  },
});