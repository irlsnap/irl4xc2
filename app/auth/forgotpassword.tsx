import { ThemedTextInput } from "@/components/shared/ThemedTextInput";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import { Link, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Divider } from '@rneui/themed';
import { useRouter } from 'expo-router';
import {auth} from '@/app/firebaseConfig';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import registerForPushNotificationsAsync from "../notifs";

export default function Login() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [email, onChangeEmail] = useState('');

  return (
    <ThemedView style={{flex:1, alignItems:'center', justifyContent:'center'}}>
      <Image
          source={require('@/assets/images/app_logo_transparent.png')}
          style={styles.logo}
        />
      
      <ThemedTextInput text={email} onChangeText={onChangeEmail} placeholder="Email"></ThemedTextInput>

      <TouchableOpacity 
        onPress={() => {
          if (email) {
            sendPasswordResetEmail(auth, email)
            .then(() => {
                Alert.alert("Password Reset Link sent to email!", "", [
                    {
                      text: 'OK',
                      onPress: () => router.back(),
                    }
                  ])
                })
            .catch((error) => {
              const errorCode = error.code;
              const errorMessage = error.message;
              if (errorCode == "auth/invalid-email") Alert.alert("Invalid Email");
              if (errorCode == "auth/missing-email") Alert.alert("Missing email");
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
          <ThemedText style={{marginLeft:"35%"}}>Send Reset Email</ThemedText>
        </TouchableOpacity>
      

      <View style={{ flexDirection: 'row', alignItems: 'center', width:"90%", marginTop: "20%" }}>
        <Divider style={{ flex: 1 }} />
        <ThemedText style={{ marginHorizontal: 16, color: "#414141" }}>OR</ThemedText>
        <Divider style={{ flex: 1 }} />
      </View>

      <ThemedText type="grayed" style={{marginTop: "15%"}}>
        Remember your account info?   
        <Link style={styles.forgotPassword} href={{ pathname: '/auth/login', params: {} }}>
          <ThemedText type="link"> Go back to Log In.</ThemedText>
        </Link>
      </ThemedText>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: '50%',
    height: '50%',
    marginVertical: -80
  },
  forgotPassword: {
    marginLeft: "60%",
    marginTop: "2%",
  }
});