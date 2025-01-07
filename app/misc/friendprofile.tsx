import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Linking,
} from "react-native";
import { Video } from "expo-av"; // <-- using expo-av ("av-video")
import Ionicons from "@expo/vector-icons/Ionicons";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import VideoThumbnailComponent from "@/components/video/VideoThumbnailComponent";

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
      if (typeof friendUid === "string") {
        const userRef = await getDoc(doc(db, "users", friendUid));
        const data = userRef.data();
        if (data) {
          setUid(data.uid);
          setEmail(data.email);
          setName(data.fname + " " + data.lname);
          setHandle(data.username);
          setImageURL(data.pfp);
          // setVideos(data.videos); // Uncomment if needed to load actual videos
        }
      }
    }

    fetchData();
  }, [navigation]);

  // Render item for FlatList
  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      onPress={() => {
        setVideo(item);
        setModal(true);
      }}
      style={{ marginBottom: "5%" }}
    >
      <VideoThumbnailComponent videoUri={item} />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* Top Section */}
      <ThemedView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          marginTop: -250,
          marginBottom: -200,
        }}
      >
        {/* Modal for playing the selected video */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modal}
          onRequestClose={() => {
            setModal(!modal);
          }}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.modalBackground}
              onPress={() => setModal(false)}
            />
            <Video
              source={{ uri: video }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode="contain"
            />
          </View>
        </Modal>

        <Ionicons
          name="caret-back"
          size={30}
          color="white"
          onPress={() => router.back()}
          style={styles.back}
        />

        <ThemedView style={{ alignContent: "center", width: "60%", marginTop: "5%" }}>
          <ThemedText type="title">{name}</ThemedText>
        </ThemedView>

        <Image
          source={require("@/assets/images/app_logo_dark.png")}
          style={styles.logo}
        />
      </ThemedView>

      {/* Bottom Section */}
      <ThemedView style={{ flex: 1, alignItems: "center", top: 0 }}>
        {downloadURL ? (
          <View style={styles.imageContainer}>
            {downloadURL && <Image source={{ uri: downloadURL }} style={styles.image} />}
          </View>
        ) : null}

        <ThemedText style={styles.handle} type="subtitle">
          @{handle}
        </ThemedText>

        {/* Example text, pinned videos placeholder, etc. */}
        <ThemedText style={{ marginTop: "15%" }} type="title">
          No Pinned Videos Yet
        </ThemedText>

        {/* FlatList to display videos (uncomment if you want to show them)
          <FlatList
            data={videos}
            renderItem={renderItem}
            keyExtractor={(item, index) => String(index)}
            contentContainerStyle={styles.videoList}
            style={{ width: "100%", marginLeft: "21%", marginTop: "5%" }}
            ListEmptyComponent={
              <ActivityIndicator
                size="large"
                color="#fff"
                style={{ marginTop: "15%", marginRight: "21%" }}
              />
            }
            initialNumToRender={1}
          />
        */}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  back: {
    left: "5%",
    position: "absolute",
  },
  logo: {
    width: "20%",
    height: "20%",
    right: 0,
    position: "absolute",
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#D9D9D9",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  handle: {
    marginTop: "5%",
  },
  videoList: {
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  videoPlayer: {
    width: "100%",
    height: "50%",
  },
});
