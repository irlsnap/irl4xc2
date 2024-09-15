import { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, View, TouchableOpacity, FlatList } from "react-native";
import * as ImagePicker from 'expo-image-picker'; 
import { auth, db, storage } from "../firebaseConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import VideoViewComponent from "@/components/video/ProfileVideoView";
import { router, useNavigation } from "expo-router";
import VideoThumbnailComponent from "@/components/video/VideoThumbnailComponent";
import { ThemedButton } from "@/components/shared/ThemedButton";
import { signOut } from "firebase/auth";

export default function Profile() {
  const navigation = useNavigation();

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [downloadURL, setImageURL] = useState("");
  const [videos, setVideos] = useState<string[]>([]); // State to store video URLs
  const [video, setVideo] = useState<string>("");

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    async function fetchData() {
      if (auth.currentUser) {
        const userRef = await getDoc(doc(db, "users", auth.currentUser.uid));
        const data = userRef.data();
        if (data) {
          setUid(data.uid);
          setEmail(data.email);
          setName(data.fname + " " + data.lname);
          setHandle(data.username);
          setImageURL(data.pfp);
          setVideos(data.videos); // Fetch the videos array
        }
      }
    }

    fetchData();
  }, [navigation]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Supports images and videos
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setImageURL(result.assets[0].uri);
      await uploadMedia(result.assets[0].uri);
    }
  };

  const uploadMedia = async (img: string) => {
    const response = await fetch(img);
    const blob = await response.blob();

    const storageRef = ref(storage, uid);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
      await setDoc(doc(db, "users", uid), { pfp: downloadURL }, { merge: true });
    });

    Alert.alert('Photo Uploaded!');
  };

  // Render item for FlatList
  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity onPress={() => {setVideo(item)}} style={{marginBottom:'5%'}}>
      <VideoThumbnailComponent videoUri={item} />
    </TouchableOpacity>
  );

  if (video) return <VideoViewComponent video={video} setVideo={setVideo} />;
  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -250, marginBottom: -200 }}>
        <ThemedView style={{ alignContent: 'center', width: '60%', marginTop: "4%" }}>
          <ThemedText type="title">{name}</ThemedText>
        </ThemedView>

        <Image
          source={require('@/assets/images/app_logo_dark.png')}
          style={styles.logo}
        />
      </ThemedView>

      <ThemedView style={{ flex: 1, alignItems: 'center', top: 0 }}>
        <TouchableOpacity onPress={pickImage}>
          <View style={styles.imageContainer}>
            {downloadURL && <Image source={{ uri: downloadURL }} style={styles.image} />}
          </View>
        </TouchableOpacity>

        <ThemedText style={styles.handle} type="subtitle">@{handle}</ThemedText>

        {/* FlatList to display videos */}
        {videos ? <ThemedText style={{marginTop:"27%"}} type="title">Post to see your videos!</ThemedText> : <View></View>}
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.videoList}
          style={{width:'100%', marginLeft:"21%", marginTop:"5%"}}
        />
        
      </ThemedView>

      <TouchableOpacity 
        onPress={() => {
          signOut(auth).then(() => {
            router.replace('/auth/login');
          }).catch((error) => {
            console.log(error);
          });
        }}
        style={{
          backgroundColor: "#3797EF",
          padding: 10,
          width: "20%",
          borderRadius: 6,
          marginVertical: "5%",
          marginLeft: "40%"
        }}>
          <ThemedText style={{marginLeft:"8%"}}>Sign Out</ThemedText>
        </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    marginTop: '5%',
  },
  logo: {
    width: '20%',
    height: '20%',
    right: 0,
    position: 'absolute',
  },
  videoList: {
    marginTop: 20,
  },
  videoContainer: {
    marginBottom: 20,
    width: '90%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
