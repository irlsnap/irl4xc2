import { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, Modal, Linking } from "react-native";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import VideoViewComponent from "@/components/video/ProfileVideoView";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import VideoThumbnailComponent from "@/components/video/VideoThumbnailComponent";
import Ionicons from '@expo/vector-icons/Ionicons';

export default function FriendProfile() {
  const navigation = useNavigation();

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [downloadURL, setImageURL] = useState("");
  const [videos, setVideos] = useState<string[]>([]); // State to store video URLs
  const [video, setVideo] = useState<string>("");
  const [modal, setModal] = useState(false);

  const { friendUid } = useLocalSearchParams();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    async function fetchData() {
      if (typeof friendUid == "string") {
        const userRef = await getDoc(doc(db, "users", friendUid));
        const data = userRef.data();
        if (data) {
          setUid(data.uid);
          setEmail(data.email);
          setName(data.fname + " " + data.lname);
          setHandle(data.username);
          setImageURL(data.pfp);
          // setVideos(data.videos); // Fetch the videos array
        }
      }
    }

    fetchData();
  }, [navigation]);

  // Render item for FlatList
  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity onPress={() => {setVideo(item); setModal(true)}} style={{marginBottom:'5%'}}>
      <VideoThumbnailComponent videoUri={item} />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -250, marginBottom: -200 }}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modal}
        onRequestClose={() => {
          setModal(!modal);
        }}>
          <VideoViewComponent video={video} setModal={setModal} />
      </Modal>
        <Ionicons name="caret-back" size={30} color="white" onPress={() => router.back()} style={styles.back} />
        <ThemedView style={{ alignContent: 'center', width: '60%', marginTop: "5%" }}>
          <ThemedText type="title">{name}</ThemedText>
        </ThemedView>

        <Image
          source={require('@/assets/images/app_logo_dark.png')}
          style={styles.logo}
        />
      </ThemedView>

      <ThemedView style={{ flex: 1, alignItems: 'center', top: 0 }}>
        {downloadURL ? 
            <View style={styles.imageContainer}>
              {downloadURL && <Image source={{ uri: downloadURL }} style={styles.image} />}
            </View> : null
        }

        <ThemedText style={styles.handle} type="subtitle">@{handle}</ThemedText>

        {/* <ThemedText style={{marginTop:"15%", color: '#3797EF'}} type="title" onPress={() => Linking.openURL('http://google.com')}>Check out your past videos here!</ThemedText> */}
        <ThemedText style={{marginTop:"15%"}} type="title">No Pinned Videos Yet</ThemedText>
        {/* FlatList to display videos */}
        {/* <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(index) => index.toString()}
          contentContainerStyle={styles.videoList}
          style={{width:'100%', marginLeft:"21%", marginTop:"5%"}}
          ListEmptyComponent={<ActivityIndicator size="large" color="#fff" style={{marginTop: "15%", marginRight:"21%"}} />}
          initialNumToRender={1}
        /> */}
        
      </ThemedView>
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
  back: {
    left: "5%",
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
