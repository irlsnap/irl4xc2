import React, { useEffect, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import VideoViewComponent from "@/components/video/VideoView";

interface VideoThumbnailComponentProps {
  videoUri: string;
}

export default function VideoThumbnailComponent({ videoUri }: VideoThumbnailComponentProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false); // Toggle between thumbnail and video
  const [loading, setLoading] = useState(true); // Loading state for thumbnail generation

  useEffect(() => {
    // Generate the video thumbnail on component mount
    async function generateThumbnail() {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: 100, // Choose the time in ms for the frame
        });
        console.log(uri)
        setThumbnailUri(uri);
        setLoading(false); // Thumbnail generation complete
      } catch (e) {
        console.warn(e);
        setLoading(false); // Stop loading on error
      }
    }

    generateThumbnail();
  }, [videoUri]);

  return (
    <View style={styles.container}>
        {thumbnailUri ? (<Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />):(<View></View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '80%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',

  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
