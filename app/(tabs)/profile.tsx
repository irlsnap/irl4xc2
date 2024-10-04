import { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import * as ImagePicker from 'expo-image-picker'; 
import { auth, db, storage } from "../firebaseConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import VideoViewComponent from "@/components/video/ProfileVideoView";
import { router, useNavigation } from "expo-router";
import VideoThumbnailComponent from "@/components/video/VideoThumbnailComponent";
import { ThemedButton } from "@/components/shared/ThemedButton";
import { signOut } from "firebase/auth";
import * as Notifications from 'expo-notifications';

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
        }
      }
    }

    fetchData();
  }, [navigation]);

  useEffect(() => {
    async function fetchData() {
      if (auth.currentUser) {
        const userRef = await getDoc(doc(db, "users", auth.currentUser.uid));
        const data = userRef.data();
        if (data) {
          setImageURL(data.pfp);
          setVideos(data.videos); // Fetch the videos array
        }
      }
    }

    fetchData();
  }, []);

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

  // Function to get all push tokens from Firestore
  const getAllUserTokens = async (): Promise<string[]> => {
    try {
      const allUserTokens: string[] = [];
      
      // Reference to the 'users' collection
      const usersRef = collection(db, 'users');
      
      // Get all documents in the 'users' collection
      const userSnapshot = await getDocs(usersRef);
      
      // Loop through each document and extract the push token
      userSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.pushToken) {
          allUserTokens.push(userData.pushToken);
        }
      });

      return allUserTokens; // Return an array of push tokens
    } catch (error) {
      console.error("Error fetching user tokens: ", error);
      return [];
    }
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
        {downloadURL ? 
          <TouchableOpacity onPress={pickImage}>
            <View style={styles.imageContainer}>
              {downloadURL && <Image source={{ uri: downloadURL }} style={styles.image} />}
            </View>
          </TouchableOpacity> :
          <ActivityIndicator size="large" color="#fff" style={{marginTop: "40%"}} />
        }
        

        <ThemedText style={styles.handle} type="subtitle">@{handle}</ThemedText>

        {/* FlatList to display videos */}
        {videos ? <ThemedText style={{marginTop:"15%"}} type="title">Post to see your videos!</ThemedText> : <ActivityIndicator size="large" color="#fff" style={{marginTop: "40%"}} />}
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
        {email == 'n@ucsc.edu' ?
      <TouchableOpacity 
      onPress={async () => {
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleDateString(); // Format the current date
    
        try {
          // Step 2: Check if a notification has already been sent today
          const timeRef = collection(db, 'time');
          const querySnapshot = await getDocs(query(timeRef, where('date', '==', formattedDate)));
    
          if (!querySnapshot.empty) {
            // If a notification for today exists, show an alert
            alert('A notification has already been sent for today.');
            return; // Exit the function, preventing further actions
          }

          // Step 1: Empty the "post" field for all users
          const usersRef = collection(db, 'users');
          const usersSnapshot = await getDocs(usersRef);
    
          const batch = writeBatch(db); // Use Firestore batch to perform multiple writes efficiently
    
          usersSnapshot.forEach((doc) => {
            batch.update(doc.ref, { post: '', reactions: [], reactionUids: [] }); // Set the "post" field to an empty string
          });
    
          await batch.commit(); // Commit the batch operation
          console.log('All users\' "post" fields have been cleared.');
    
          // Step 3: Fetch all user tokens
          const allUserTokens = await getAllUserTokens();
          console.log(allUserTokens);
    
          // Step 4: Send a notification to all users
          const message = {
            to: allUserTokens,
            sound: 'default',
            title: '⚠️ Time to IRL ⚠️',
            body: 'You have two minutes to capture a video and share with your friends!',
            data: { someData: 'Time to IRL' },
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

          // await Notifications.scheduleNotificationAsync({
          //   content: {
          //     title: "⚠️ Time to IRL ⚠️",
          //     body: 'You have two minutes to capture a video and share with your friends!',
          //     data: { data: 'goes here', test: { test1: 'more data' } },
          //   },
          //   trigger: { seconds: 1 },
          // });
    
          // Step 5: Add a document to Firestore in the 'time' collection with the date and time
          await addDoc(collection(db, 'time'), {
            date: formattedDate, // Store today's date
            time: currentDate.toLocaleTimeString(), // Store current time
          });
    
          console.log('Notification sent and Firestore updated!');
        } catch (error) {
          console.error('Error sending notification or updating Firestore:', error);
        }
      }}                    
      style={{
        backgroundColor: "#3797EF",
        padding: 10,
        width: "40%",
        borderRadius: 6,
        marginVertical: "5%",
        marginLeft: "30%"
      }}>
      <ThemedText style={{marginLeft:"13%"}}>Send Notification</ThemedText>
    </TouchableOpacity> : null}
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
