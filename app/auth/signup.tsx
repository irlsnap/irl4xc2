import { ThemedTextInput } from "@/components/shared/ThemedTextInput";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import { Link, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Divider } from '@rneui/themed';
import { useRouter } from 'expo-router';
import {auth, db} from '@/app/firebaseConfig';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import registerForPushNotificationsAsync from "../notifs";

export default function Signup() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [username, onUsernameChange] = useState('');
  const [fname, onFnameChange] = useState('');
  const [lname, onLnameChange] = useState('');
  const [email, onChangeEmail] = useState('');
  const [password, onChangePassword] = useState('');
  const [ambassador, onChangeAmbassador] = useState('');

  const checkUsernameExists = async (username: string) => {
    const q = query(collection(db, "users"), where("username", "==", username));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  return (
    
      <ThemedView style={{flex:1, alignItems:'center', justifyContent:'center'}}>
      <Image
          source={require('@/assets/images/app_logo_dark.png')}
          style={styles.logo}
        />
      
      <ThemedTextInput text={username} onChangeText={onUsernameChange} placeholder="Username"></ThemedTextInput>
      <ThemedTextInput text={fname} onChangeText={onFnameChange} placeholder="First Name"></ThemedTextInput>
      <ThemedTextInput text={lname} onChangeText={onLnameChange} placeholder="Last Name"></ThemedTextInput>
      <ThemedTextInput text={email} onChangeText={onChangeEmail} placeholder="Email"></ThemedTextInput>
      <ThemedTextInput text={password} onChangeText={onChangePassword} placeholder="Password" type="password"></ThemedTextInput>
      <ThemedTextInput text={ambassador} onChangeText={onChangeAmbassador} placeholder="Name of Student Ambassador (if advertised by)"></ThemedTextInput>

      <TouchableOpacity 
        onPress={async () => {
          // Check if username already exists
          if (fname && lname && username && email && password) {
            const usernameExists = await checkUsernameExists(username);
            if (usernameExists) {
              Alert.alert("Username already taken.");
              return;
            }
            createUserWithEmailAndPassword(auth, email, password)
                .then(async (userCredential) => {
                    // Signed up 
                    const user = userCredential.user;
                    // console.log(user)
                    const data = {
                      uid: user.uid,
                      email: email,
                      username: username,
                      pfp: "",
                      videos: [], 
                      fname: fname,
                      lname: lname,
                      ambassador: ambassador,
                      friends: {},
                      post: '',
                      reactions: [],
                      reactionUids: []
                    };
                    await setDoc(doc(db, "users", user.uid), data);
                    await registerForPushNotificationsAsync()
                    router.navigate("/(tabs)/");
                })
                .catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    if (error.code == "auth/email-already-exists") Alert.alert("Email already exists");
                    if (error.code == "auth/email-already-in-use") Alert.alert("Email already in use");
                    if (error.code == "auth/invalid-email") Alert.alert("Invalid Email");
                    if (error.code == "auth/invalid-password") Alert.alert("Invalid Password (Must be at least 6 characters)");
                    if (error.code == "auth/weak-password") Alert.alert("Password must be at least 6 characters");
                    // ..
                });
              } else {
                Alert.alert("Required field left empty")
              }
        }}
        style={{
          backgroundColor: "#3797EF",
          padding: 10,
          width: "90%",
          borderRadius: 6,
          marginTop: "5%",
        }}>
          <ThemedText style={{marginLeft:"43%"}}>Sign up</ThemedText>
        </TouchableOpacity>
      

      <View style={{ flexDirection: 'row', alignItems: 'center', width:"90%", marginTop: "10%" }}>
        <Divider style={{ flex: 1 }} />
        <ThemedText style={{ marginHorizontal: 16, color: "#414141" }}>OR</ThemedText>
        <Divider style={{ flex: 1 }} />
      </View>

      <ThemedText type="grayed" style={{marginTop: "8%"}}>
        Have an account?   
        <Link style={styles.forgotPassword} href={{ pathname: '/auth/login', params: { name: 'Bacon' } }}>
          <ThemedText type="link"> Log in.</ThemedText>
        </Link>
      </ThemedText>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: '60%',
    height: '40%',
    resizeMode: 'center',
    marginVertical: -80
  },
  forgotPassword: {
    marginLeft: "60%",
    marginTop: "2%",
  }
});
