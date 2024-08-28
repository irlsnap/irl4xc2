import { ThemedTextInput } from "@/components/ThemedTextInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Link, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Divider } from '@rneui/themed';
import { useRouter } from 'expo-router';
import {auth, db} from '@/app/firebaseConfig';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function Signup() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [email, onChangeEmail] = useState('');
  const [password, onChangePassword] = useState('');

  return (
    <ThemedView style={{flex:1, alignItems:'center', justifyContent:'center'}}>
      <Image
          source={require('@/assets/images/app_logo_dark.png')}
          style={styles.logo}
        />
      
      <ThemedTextInput text={email} onChangeText={onChangeEmail} placeholder="Email"></ThemedTextInput>
      <ThemedTextInput text={password} onChangeText={onChangePassword} placeholder="Password" type="password"></ThemedTextInput>

        <TouchableOpacity 
        onPress={() => {
            createUserWithEmailAndPassword(auth, email, password)
                .then(async (userCredential) => {
                    // Signed up 
                    const user = userCredential.user;
                    // console.log(user)
                    const data = {
                      uid: user.uid,
                      email: email,
                    };
                    await setDoc(doc(db, "users", user.uid), data);
                })
                .catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    // ..
                });
                router.navigate("/(tabs)/")
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
      

      <View style={{ flexDirection: 'row', alignItems: 'center', width:"90%", marginTop: "20%" }}>
        <Divider style={{ flex: 1 }} />
        <ThemedText style={{ marginHorizontal: 16, color: "#414141" }}>OR</ThemedText>
        <Divider style={{ flex: 1 }} />
      </View>

      <ThemedText type="grayed" style={{marginTop: "15%"}}>
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
