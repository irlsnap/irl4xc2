import { useEffect, useRef, useState } from "react";
import { useVideoPlayer, VideoView } from "expo-video";
import { Alert, Button, View, StyleSheet } from "react-native";
import IconButton from "../camera/IconButton";
import { saveToLibraryAsync } from "expo-media-library";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from 'expo-file-system';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { auth, db, storage } from "../../app/firebaseConfig";
import { ProgressBar } from "react-native-paper";
import { requestMediaLibraryPermissionsAsync } from "expo-image-picker";

interface VideoViewProps {
  video: string;
  setModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function VideoViewComponent({ video, setModal }: VideoViewProps) {
  const reff = useRef<VideoView>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const player = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.muted = false;
    player.play();
  });
  const [uid, setUid] = useState("");
  const [progress, setProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    const subscription = player.addListener("playingChange", (isPlaying) => {
      setIsPlaying(isPlaying);
    });

    if (auth.currentUser) setUid(auth.currentUser.uid)

    return () => {
      subscription.remove();
    };
  }, [player]);

  const downloadFile = async () => {
    try {
      setIsDownloading(true);
      const downloadResumable = FileSystem.createDownloadResumable(
        video,
        FileSystem.documentDirectory + 'video.mov',
        {},
        (downloadProgress) => {
          const progressPercent = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setProgress(progressPercent); // Updates the progress
        }
      );

      // Start the download
      const result = await downloadResumable.downloadAsync();

      // Ensure result is defined before accessing uri
      if (result && result.uri) {
        // Save the file to the media library
        const mediaLibraryStatus = await requestMediaLibraryPermissionsAsync();
        if (!mediaLibraryStatus.granted) {
          Alert.alert("Error", "Media Library permission is required.");
          return false;
        }
        const asset = await MediaLibrary.createAssetAsync(result.uri);
        Alert.alert("✅ Video saved!");
      } else {
        Alert.alert("❌ Download failed. No file was downloaded.");
      }

      // Reset progress
      setProgress(0);
      setIsDownloading(false);
    } catch (error) {
      console.error(error);
      Alert.alert("❌ Download failed");
      setIsDownloading(false);
    }
  };

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
          onPress={() => setModal(false)}
          iosName={"xmark"}
          androidName="close"
        />
        <IconButton
          onPress={downloadFile}
          // onPress={async () => {
          //   const response = await FileSystem.downloadAsync(video, FileSystem.documentDirectory + 'image.mov');
          //   console.log(response)
          //   // Save to media library
          //   const asset = await MediaLibrary.createAssetAsync(response.uri);
          //   // saveToLibraryAsync(video);
          //   Alert.alert("✅ video saved!");
          // }}
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
        nativeControls={false}
      />
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
