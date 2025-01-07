import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Button } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function UploadResponse({ navigation }) {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedVideo(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (selectedVideo) {
      // Handle uploading the video to your server or Firebase
      console.log("Uploading video:", selectedVideo);
      navigation.goBack();
    } else {
      alert("Please select a video first.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Reply with a Video</Text>
      <TouchableOpacity style={styles.pickButton} onPress={pickVideo}>
        <Text style={styles.pickButtonText}>
          {selectedVideo ? "Change Video" : "Pick a Video"}
        </Text>
      </TouchableOpacity>
      {selectedVideo && <Text style={styles.videoText}>Video Selected!</Text>}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Submit Reply</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 20,
    fontWeight: '600',
  },
  pickButton: {
    backgroundColor: '#444',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  videoText: {
    color: '#0f0',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#ff3333',
    padding: 15,
    borderRadius: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});