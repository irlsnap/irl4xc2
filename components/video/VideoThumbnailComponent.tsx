import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";

interface VideoThumbnailComponentProps {
  videoUri: string;
}

export default function VideoThumbnailComponent({ videoUri }: VideoThumbnailComponentProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    // Generate the video thumbnail on component mount
    async function generateThumbnail() {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: 100, // Choose the time in ms for the frame
        });
        console.log(uri)
        setThumbnailUri(uri);
      } catch (e) {
        console.warn(e);
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
