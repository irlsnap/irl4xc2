import React, { useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform
} from "react-native";
import { useNavigation } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "@/app/firebaseConfig";
import { useRouter } from "expo-router";

import { Divider } from "@rneui/themed";
import registerForPushNotificationsAsync from "../notifs";

import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedTextInput } from "@/components/shared/ThemedTextInput";
import { ThemedView } from "@/components/shared/ThemedView";

const PINK = "#FF69B4";

// For username checks, if you want only letters/numbers/._ (Instagram-like):
const USERNAME_REGEX = /^[a-zA-Z0-9._]+$/;

/** 
 * Checks Firestore if a doc in "users" has that username.
 * Return true if it exists.
 */
const checkUsernameExists = async (username: string): Promise<boolean> => {
  const qUser = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
  const snapshot = await getDocs(qUser);
  return !snapshot.empty;
};

/** 
 * Checks Firestore if a doc in "users" has that email.
 * Return true if it exists.
 */
const checkEmailExists = async (email: string): Promise<boolean> => {
  const qEmail = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
  const snapshot = await getDocs(qEmail);
  return !snapshot.empty;
};

export default function Signup() {
  const navigation = useNavigation();
  const router = useRouter();

  React.useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [step, setStep] = useState<number>(1);

  const [username, setUsername] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [imageUri, setImageUri] = useState<string | null>(null);

  // Go to next step
  const nextStep = () => setStep((prev) => prev + 1);
  // Go back
  const prevStep = () => setStep((prev) => (prev > 1 ? prev - 1 : 1));

  // Pick profile image if you'd like
  const pickProfileImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Upload profile pic to Firebase Storage
  const uploadProfilePic = async (uid: string, uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `pfp_${uid}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          () => {},
          reject,
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      return downloadUrl;
    } catch (err) {
      console.error("Error uploading image: ", err);
      return null;
    }
  };

  /*******************************************
   *            VALIDATION HELPERS
   *******************************************/
  const validateStep1 = async () => {
    if (!username) {
      Alert.alert("Missing username", "Please enter a username.");
      return false;
    }
    if (!USERNAME_REGEX.test(username)) {
      Alert.alert(
        "Invalid username",
        "Only letters, numbers, underscores, or periods are allowed."
      );
      return false;
    }
    // Check in Firestore
    const isTaken = await checkUsernameExists(username);
    if (isTaken) {
      Alert.alert("Username taken", "Please choose another username.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!fname || !lname) {
      Alert.alert("Missing name", "Please fill out first and last name.");
      return false;
    }
    return true;
  };

  const validateStep3 = async () => {
    if (!email || !password) {
      Alert.alert("Required", "Email and password are required.");
      return false;
    }
    if (!email.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email.");
      return false;
    }
    // Optional early Firestore check
    const emailTaken = await checkEmailExists(email);
    if (emailTaken) {
      Alert.alert("Email in use", "That email is already registered.");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return false;
    }
    return true;
  };

  /*******************************************
   *            HANDLE SIGNUP
   *******************************************/
  const handleSignup = async () => {
    try {
      // Just a final check before createUserWithEmailAndPassword
      if (!username || !fname || !lname || !email || !password) {
        Alert.alert("Error", "Missing required fields.");
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // If we have a profile pic, upload
      let pfpUrl = "";
      if (imageUri) {
        const uploadedUrl = await uploadProfilePic(user.uid, imageUri);
        if (uploadedUrl) pfpUrl = uploadedUrl;
      }

      // Create user doc
      const userDoc = {
        uid: user.uid,
        email: email.toLowerCase(),
        username: username.toLowerCase(), // store as lower
        fname,
        lname,
        pfp: pfpUrl,
        videos: [],
        friends: {},
        reactions: [],
        reactionUids: [],
      };
      await setDoc(doc(db, "users", user.uid), userDoc);

      // Optional: register push notifs
      await registerForPushNotificationsAsync();

      // Navigate to verification
      router.replace("/auth/verification");
    } catch (err: any) {
      // If email is used, or other error
      if (err.code === "auth/email-already-in-use") {
        Alert.alert("Email already in use", "Please use a different email.");
      } else if (err.code === "auth/invalid-email") {
        Alert.alert("Invalid email", "Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        Alert.alert("Weak password", "Password must be at least 6 characters.");
      } else {
        Alert.alert("Error", err.message);
      }
    }
  };

  /*******************************************
   *            RENDER
   *******************************************/
  return (
    <ThemedView style={styles.container}>

      {/* If step>1, show a back button */}
      {step > 1 && (
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <Text style={{ color: "#fff" }}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Smaller Logo */}
      <Image
        source={require("@/assets/images/app_logo_transparent.png")}
        style={styles.logo}
      />

      {step === 1 && (
        <>
          <ThemedTextInput
            placeholder="Username"
            placeholderTextColor="#999"
            style={{ color: "#fff", marginBottom: 20 }}
            text={username}
            onChangeText={(txt) => setUsername(txt.trim())}
          />
          <TouchableOpacity
            style={styles.btnNext}
            onPress={async () => {
              const ok = await validateStep1();
              if (ok) nextStep();
            }}
          >
            <ThemedText style={styles.btnText}>Next</ThemedText>
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <ThemedTextInput
            placeholder="First Name"
            placeholderTextColor="#999"
            style={{ color: "#fff", marginBottom: 10 }}
            text={fname}
            onChangeText={(txt) => setFname(txt.trim())}
          />
          <ThemedTextInput
            placeholder="Last Name"
            placeholderTextColor="#999"
            style={{ color: "#fff", marginBottom: 10 }}
            text={lname}
            onChangeText={(txt) => setLname(txt.trim())}
          />

          <TouchableOpacity
            style={styles.btnNext}
            onPress={() => {
              if (validateStep2()) {
                nextStep();
              }
            }}
          >
            <ThemedText style={styles.btnText}>Next</ThemedText>
          </TouchableOpacity>
        </>
      )}

      {step === 3 && (
        <>
          <ThemedTextInput
            placeholder="Email"
            placeholderTextColor="#999"
            style={{ color: "#fff", marginBottom: 10 }}
            text={email}
            onChangeText={(txt) => setEmail(txt.trim())}
          />
          <ThemedTextInput
            placeholder="Password"
            placeholderTextColor="#999"
            style={{ color: "#fff", marginBottom: 10 }}
            text={password}
            onChangeText={setPassword}
            type="password"
          />
          <TouchableOpacity
            style={styles.btnNext}
            onPress={async () => {
              const ok = await validateStep3();
              if (ok) nextStep();
            }}
          >
            <ThemedText style={styles.btnText}>Next</ThemedText>
          </TouchableOpacity>
        </>
      )}

      {step === 4 && (
        <>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <TouchableOpacity style={styles.profilePicContainer} onPress={pickProfileImage}>
              <ThemedText style={{ color: "#aaa" }}>Tap to pick a profile pic</ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btnPick} onPress={pickProfileImage}>
            <ThemedText style={styles.btnText}>Pick/Change Picture</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSignUp} onPress={handleSignup}>
            <ThemedText style={styles.btnSignUpText}>Sign up</ThemedText>
          </TouchableOpacity>
        </>
      )}

      {/* Show "OR" + "Log in" link if we haven't finished sign-up yet */}
      {step < 4 && (
        <View style={styles.bottomArea}>
          <View style={styles.dividerRow}>
            <Divider style={{ flex: 1 }} />
            <ThemedText style={{ marginHorizontal: 16, color: "#414141" }}>OR</ThemedText>
            <Divider style={{ flex: 1 }} />
          </View>
          <ThemedText style={{ color: "#ccc" }}>
            Have an account?
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <ThemedText style={{ color: PINK }}> Log in.</ThemedText>
            </TouchableOpacity>
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 6,
  },
  logo: {
    width: 150,
    height: 150,
    marginTop: Platform.OS === "ios" ? 40 : 20,
    resizeMode: "contain",
    marginBottom: 10,
  },
  btnNext: {
    backgroundColor: PINK,
    width: "90%",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  btnText: {
    textAlign: "center",
    color: "#fff",
  },
  profilePicContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#666",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginVertical: 12,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginVertical: 12,
    resizeMode: "cover",
  },
  btnPick: {
    backgroundColor: "#444",
    width: "60%",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  btnSignUp: {
    backgroundColor: PINK,
    width: "90%",
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  btnSignUpText: {
    textAlign: "center",
    color: "#fff",
  },
  bottomArea: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "80%",
    marginVertical: 20,
  },
});