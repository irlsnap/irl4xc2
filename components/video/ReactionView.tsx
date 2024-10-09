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
import { addDoc, arrayUnion, collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { router } from "expo-router";

interface VideoViewProps {
  video: string;
  setVideo: React.Dispatch<React.SetStateAction<string>>;
  friendUID: string | string[]
}

export default function ReactionViewComponent({ video, setVideo, friendUID }: VideoViewProps) {
  const reff = useRef<VideoView>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const player = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.muted = false;
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

  // Function to fetch friend's Expo push notification token
const getFriendToken = async (friendUID: string) => {
  const friendDoc = doc(db, 'users', friendUID);
  const friendSnapshot = await getDoc(friendDoc);
  return friendSnapshot.data()?.pushToken || null; // Assuming expoPushToken is stored in user data
};

// Function to send a notification when a reaction is posted
const sendReactionPostedNotification = async (friendUID: string) => {
  try {
    const friendToken = await getFriendToken(friendUID);

    if (friendToken) {
      const message = {
        to: friendToken,
        sound: 'default',
        title: 'New Reaction 👀',
        body: 'Someone posted a reaction to your video!',
        data: { someData: 'reaction_posted' },
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      console.log("Reaction notification sent to friend's device!");
    } else {
      console.log("Friend does not have a registered Expo push token.");
    }
  } catch (error) {
    console.error("Error sending reaction notification:", error);
  }
};

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

          if (typeof friendUID == "string")
          // Save the video URL to the 'videos' field as an array and the 'post' field as a string
          await updateDoc(doc(db, "users", friendUID), {
            reactions: arrayUnion(downloadURL), // Add to 'videos' field (array)
            reactionUids: arrayUnion(uid),               // Set 'post' field as a string
          });

          // Clear the video input state after the upload
          setVideo("");
          router.replace("/(tabs)/")

          console.log("Video URL saved to both 'reactions' and 'reactionUids' fields");

          if (typeof friendUID == "string")
          await sendReactionPostedNotification(friendUID);
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