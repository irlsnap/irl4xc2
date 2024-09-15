import { ThemedTextInput } from "@/components/shared/ThemedTextInput";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import { Link, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Divider } from '@rneui/themed';
import { useRouter } from 'expo-router';
import {auth} from '@/app/firebaseConfig';
import { signInWithEmailAndPassword } from "firebase/auth";

export default function Login() {
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

      <Link style={styles.forgotPassword} href={{ pathname: '/auth/signup', params: { name: 'Bacon' } }}>
        <ThemedText type="link">Forgot Password?</ThemedText>
      </Link>

      <TouchableOpacity 
        onPress={() => {
          if (email && password) {
            signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
              // Signed in 
              const user = userCredential.user;
              router.navigate("/(tabs)/")
            })
            .catch((error) => {
              const errorCode = error.code;
              const errorMessage = error.message;
              if (errorCode == "auth/invalid-email") Alert.alert("Invalid Email");
              if (errorCode == "auth/invalid-credential") Alert.alert("Incorrect Email or Password");
              if (errorCode == "auth/user-not-found") Alert.alert("User not found");
            });
          }
          else{
            Alert.alert("Cannot leave field empty");
          }
        }}
        style={{
          backgroundColor: "#3797EF",
          padding: 10,
          width: "90%",
          borderRadius: 6,
          marginTop: "5%",
        }}>
          <ThemedText style={{marginLeft:"43%"}}>Log in</ThemedText>
        </TouchableOpacity>
      

      <View style={{ flexDirection: 'row', alignItems: 'center', width:"90%", marginTop: "20%" }}>
        <Divider style={{ flex: 1 }} />
        <ThemedText style={{ marginHorizontal: 16, color: "#414141" }}>OR</ThemedText>
        <Divider style={{ flex: 1 }} />
      </View>

      <ThemedText type="grayed" style={{marginTop: "15%"}}>
        Don't have an account?   
        <Link style={styles.forgotPassword} href={{ pathname: '/auth/signup', params: { name: 'Bacon' } }}>
          <ThemedText type="link"> Sign up.</ThemedText>
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
