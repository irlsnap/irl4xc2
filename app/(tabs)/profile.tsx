import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Link, useNavigation } from "expo-router";
import { SetStateAction, useEffect, useState } from "react";
import { Alert, Image, StyleSheet, View, TouchableOpacity, FlatList } from "react-native";
import * as ImagePicker from 'expo-image-picker'; 
import { auth, db, storage } from "../firebaseConfig";
import {ref, uploadBytesResumable, getDownloadURL} from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Profile() {
  const navigation = useNavigation();

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [downloadURL, setImageURL] = useState("");

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    async function fetchData() {
      if (auth.currentUser) {
        const userRef = await getDoc(doc(db, "users", auth.currentUser.uid));
        console.log(userRef.data())
        const data = userRef.data();
        if (data) {
          setUid(data.uid)
          setEmail(data.email)
          setName(data.email)
          setHandle(data.email)
          setImageURL(data.pfp ? data.pfp : "")
        }
      }
    }

    fetchData();
  }, [navigation]);

  const pickImage = async () =>{
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, //all:img, videos
      aspect: [4,3],
      quality: 1,
    });
    if (!result.canceled){
      setImageURL(result.assets[0].uri);
      await uploadMedia(result.assets[0].uri);
    }
  };

  //upload media files
  const uploadMedia = async (img: string | URL | Request) => {
    const response = await fetch(img);
    const blob = await response.blob();

    const storageRef = ref(storage, uid);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    getDownloadURL(uploadTask.snapshot.ref).then(async(downloadURL: SetStateAction<string>) => {
      console.log(downloadURL);
      setImageURL(downloadURL);
      await setDoc(doc(db, "users", uid), {pfp: downloadURL}, {merge: true});
    })

    Alert.alert('Photo Uploaded!');
  };

  return (
    <ThemedView style={{flex:1}}>
  
      <ThemedView style={{flex:1, alignItems: 'center', justifyContent:'center', marginTop: -200, marginBottom: -200}}>
        <ThemedView style={{alignContent:'center', width: '60%', marginTop: "4%"}}>
          <ThemedText type="title">{name}</ThemedText>
        </ThemedView>

        <Image
          source={require('@/assets/images/app_logo_dark.png')}
          style={styles.logo}
        />
      </ThemedView>

      <ThemedView style={{flex:1, alignItems:'center', justifyContent:'center'}}>
        <TouchableOpacity onPress={() => {pickImage()}}>
          <View style={styles.imageContainer}>
            {downloadURL && <Image source={{ uri: downloadURL}} style={styles.image}/>}
          </View>
        </TouchableOpacity>

        <ThemedText style={styles.handle} type="subtitle">@{handle}</ThemedText>
        
        {/* <FlatList>

        </FlatList> */}
        
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
  imageContainer:{
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    marginTop: '5%'
  },
  logo: {
    width: '20%',
    height: '20%',
    right: 0,
    position: 'absolute'
  },
});