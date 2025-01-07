import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { auth } from '../firebaseConfig';
import { sendEmailVerification } from 'firebase/auth';

export default function EmailVerificationPage() {
  const [user, setUser] = useState({});

  useFocusEffect(
    useCallback(() => {
      const fetchUser = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setUser(currentUser)
      }
      fetchUser();
      if (user.emailVerified) router.replace("/(tabs)/");
      }, [])
  )

  const handleVerifyEmail = () => {
    sendEmailVerification(user)
    Alert.alert('Verification Sent', 'A verification link has been sent to ' + user.email + "!");
  };

  return (
    <View style={styles.container}>

      {/* Text Content */}
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>
        Please verify your email to complete the setup and access all features.
      </Text>

      {/* Verify Email Button */}
      <TouchableOpacity style={styles.button} onPress={handleVerifyEmail}>
        <Text style={styles.buttonText}>Verify Your Email</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Black background to match the theme
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 20,
  },
  title: {
    color: '#fff', // White text
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    color: '#ccc', // Muted text for the subtitle
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#ff5c8d', // Pink color for the button to match the theme
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff', // White text for the button
    fontSize: 16,
    fontWeight: 'bold',
  },
});