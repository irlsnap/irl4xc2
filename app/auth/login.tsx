import React, { useRef, useEffect, useState } from "react";
import {
  StyleSheet,
  Animated,
  Easing,
  View,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions
} from "react-native";
import { useRouter } from "expo-router";
import { Link, useNavigation } from "expo-router";
import { Divider } from "@rneui/themed";
import { Video, ResizeMode } from "expo-av";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedTextInput } from "@/components/shared/ThemedTextInput";
import { ThemedView } from "@/components/shared/ThemedView";
import { auth } from "@/app/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import registerForPushNotificationsAsync from "../notifs";
import { StatusBar } from "expo-status-bar";
// Cuter arrow icons (Ionicons):
import { Ionicons } from "@expo/vector-icons";

/*
 ====================================================================================
  "Tongue Tied" by Grouplove (Approx. Sync)
  Tempo: 108 BPM (beats per minute)
  Time Sig: 4/4
  Each beat = ~555.56 ms
  Each measure (4 beats) = ~2222 ms
  Sections below are approximate start/end times in the audio:
     Intro        0:00 - 0:12
     Verse 1      0:13 - 0:38
     Pre-Chorus   0:39 - 0:54
     Chorus       0:55 - 1:16
     Post-Chorus  1:17 - 1:31
     Verse 2      1:32 - 1:57
     Bridge       1:58 - 2:25
     Chorus       2:26 - 2:47
     Outro        2:48 - end (~3:15 or 3:20… depends on the recording)
 ====================================================================================
*/

// BPM constants for pulse animations
const BEAT_MS = 60000 / 108; // ~555.56 ms per beat
const MEASURE_MS = BEAT_MS * 4; // ~2222.22 ms per 4-beat measure

/**
 * Runs a single “pulse” animation on the neon logo (scene #6).
 */
function runPulseAnimation(neonScale, neonOpacity, peakScale = 1.2, peakOpacity = 0.85) {
  Animated.sequence([
    Animated.parallel([
      Animated.timing(neonScale, {
        toValue: peakScale,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: true
      }),
      Animated.timing(neonOpacity, {
        toValue: peakOpacity,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: true
      })
    ]),
    Animated.parallel([
      Animated.timing(neonScale, {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true
      }),
      Animated.timing(neonOpacity, {
        toValue: 0.5,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true
      })
    ])
  ]).start();
}

/**
 * Based on a “song section,” calculates times to trigger pulses for the neon effect.
 */
function getPulseTimesForSection(section) {
  const { start, end, pattern } = section;
  const sectionLengthSec = end - start;
  const startMs = start * 1000;
  const endMs = end * 1000;

  const pulses = [];
  const schedulePulse = (offsetSec, scale, opacity) => {
    const t = startMs + offsetSec * 1000;
    if (t <= endMs) {
      pulses.push({ time: t, scale, opacity });
    }
  };

  switch (pattern) {
    case "intro": {
      // ...
      const numMeasures = Math.floor(sectionLengthSec / (MEASURE_MS / 1000));
      for (let i = 0; i <= numMeasures; i++) {
        const offsetSec = i * (MEASURE_MS / 1000);
        const dynamicScale = 1.2 + i * 0.05;
        const dynamicOpacity = 0.5 + i * 0.07;
        schedulePulse(offsetSec, dynamicScale, dynamicOpacity);
      }
      break;
    }
    case "verse1": {
      // ...
      const totalBeats = Math.floor(sectionLengthSec * (108 / 60));
      for (let b = 0; b <= totalBeats; b++) {
        const offsetSec = b * (BEAT_MS / 1000);
        const beatInMeasure = b % 4;
        if (beatInMeasure === 0 || beatInMeasure === 2) {
          schedulePulse(offsetSec, 1.25, 0.9);
        } else {
          schedulePulse(offsetSec, 1.1, 0.7);
        }
      }
      break;
    }
    // ... (other cases omitted for brevity; same approach)
    default:
      break;
  }
  return pulses;
}

// Definition of the approximate “sections” for the entire track:
const SECTIONS = [
  { name: "Intro", start: 0, end: 12, pattern: "intro" },
  { name: "Verse 1", start: 13, end: 38, pattern: "verse1" },
  { name: "Pre-Chorus", start: 39, end: 54, pattern: "prechorus" },
  { name: "Chorus", start: 55, end: 76, pattern: "chorus" },
  { name: "Post-Chorus", start: 77, end: 91, pattern: "postchorus" },
  { name: "Verse 2", start: 92, end: 117, pattern: "verse2" },
  { name: "Bridge", start: 118, end: 145, pattern: "bridge" },
  { name: "Chorus 2", start: 146, end: 167, pattern: "chorus" },
  { name: "Outro", start: 168, end: 195, pattern: "outro" }
];

export default function Login() {
  const router = useRouter();
  const navigation = useNavigation();

  /*
    We now have 7 total scenes (index 0..6), described below:
      Scene #0 => scene1.png
      Scene #1 => scene2.mp4
      Scene #2 => scene3part1.png
      Scene #3 => scene3part2.png
      Scene #4 => newscene4.png
      Scene #5 => scene5.mp4 (video continues into Scene #6)
      Scene #6 => IRL Neon + login
  */
  const [sceneIndex, setSceneIndex] = useState(0);

  // Toggling between IRL screen vs. actual login form (on Scene #6)
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, onChangeEmail] = useState("");
  const [password, onChangePassword] = useState("");

  // Window width used for horizontally sliding between scenes
  const windowWidth = Dimensions.get("window").width;
  // This animated value tracks how far we've slid horizontally
  const translateX = useRef(new Animated.Value(0)).current;

  // For IRL neon pulses (Scene #6)
  const neonScale = useRef(new Animated.Value(1)).current;
  const neonOpacity = useRef(new Animated.Value(0.5)).current;
  const timeoutsRef = useRef([]);

  // Hide the navigation header on React Navigation
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  /**
   * Called when user taps the dot or arrow for a particular scene.
   * We animate the container to move horizontally to that scene’s offset.
   */
  const goToScene = (newIndex) => {
    // Safeguard: clamp 0..6
    if (newIndex < 0) newIndex = 0;
    if (newIndex > 6) newIndex = 6;

    setSceneIndex(newIndex);
    Animated.timing(translateX, {
      toValue: -windowWidth * newIndex,
      duration: 400,
      useNativeDriver: true
    }).start();
  };

  /**
   * Schedules the neon pulses for the entire track at mount.
   */
  useEffect(() => {
    const allPulses = [];
    SECTIONS.forEach((section) => {
      const pulses = getPulseTimesForSection(section);
      allPulses.push(...pulses);
    });
    // Sort pulses by time ascending
    allPulses.sort((a, b) => a.time - b.time);

    // Schedule each pulse via setTimeout
    allPulses.forEach(({ time, scale, opacity }) => {
      const tid = setTimeout(() => {
        runPulseAnimation(neonScale, neonOpacity, scale ?? 1.2, opacity ?? 0.85);
      }, time);
      timeoutsRef.current.push(tid);
    });

    // Cleanup: Clear any pending timeouts on unmount
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [neonScale, neonOpacity]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Force the status bar area to match the black background */}
      <StatusBar backgroundColor="#000" style="light" translucent={false} />

      {/*
        We have a horizontally scrollable container (via animation),
        but we are NOT using panHandlers or swipes; only the dots or arrow buttons.
      */}
      <Animated.View
        style={[
          styles.rowContainer,
          {
            width: windowWidth * 7, // Enough width for 7 scenes in a row
            transform: [{ translateX }]
          }
        ]}
      >
        {/* ============= SCENE #0 ============= */}
        <View style={[styles.sceneContainer, { width: windowWidth }]}>
          <Image
            source={require("../../assets/images/scene1.png")}
            style={styles.sceneImage}
          />
        </View>

        {/* ============= SCENE #1 (Video) ============= */}
        <View style={[styles.sceneContainer, { width: windowWidth }]}>
          <Video
            pointerEvents="none"
            style={styles.video}
            source={require("../../assets/videos/scene2.mp4")}
            resizeMode={ResizeMode.CONTAIN}
            // Only play if user is on sceneIndex===1
            shouldPlay={sceneIndex === 1}
            isLooping={sceneIndex === 1}
          />
        </View>

        {/* ============= SCENE #2 => scene3part1.png ============= */}
        <View style={[styles.sceneContainer, { width: windowWidth }]}>
          <Image
            source={require("../../assets/images/scene3part1.png")}
            style={styles.sceneImage}
          />
        </View>

        {/* ============= SCENE #3 => scene3part2.png ============= */}
        <View style={[styles.sceneContainer, { width: windowWidth }]}>
          <Image
            source={require("../../assets/images/scene3part2.png")}
            style={styles.sceneImage}
          />
        </View>

        {/* ============= SCENE #4 => newscene4.png ============= */}
        <View style={[styles.sceneContainer, { width: windowWidth }]}>
          <Image
            source={require("../../assets/images/newscene4.png")}
            style={styles.sceneImage}
          />
        </View>

        {/*
          ============= SCENE #5 => scene5.mp4 =============
          IMPORTANT: This video continues to play in background
          when user goes to Scene #6, but only if the user hasn't
          opened the login form. Once showLoginForm is true,
          we stop playing it by adjusting `shouldPlay`.
        */}
        <View style={[styles.sceneContainer, { width: windowWidth }]}>
          <Video
            pointerEvents="none"
            style={styles.video}
            source={require("../../assets/videos/scene5.mp4")}
            resizeMode={ResizeMode.CONTAIN}
            // Only play if sceneIndex===5 OR (sceneIndex===6 && !showLoginForm)
            shouldPlay={sceneIndex === 5 || (sceneIndex === 6 && !showLoginForm)}
            isLooping={sceneIndex === 5 || (sceneIndex === 6 && !showLoginForm)}
          />
        </View>

        {/* ============= SCENE #6 => IRL Neon + login form ============= */}
        <View style={[styles.sceneContainer, { width: windowWidth }]}>
          {/* If we haven't toggled the login form, show the IRL "welcome" screen */}
          {!showLoginForm ? (
            <ThemedView style={styles.container}>
              {/* IRL Neon Logo with pulses */}
              <View style={styles.logoContainer}>
                <Animated.Image
                  source={require("../../assets/images/neon_logo.png")}
                  style={[
                    styles.neonLogo,
                    {
                      opacity: neonOpacity,
                      transform: [{ scale: neonScale }]
                    }
                  ]}
                />
                <Image
                  source={require("../../assets/images/app_logo_transparent.png")}
                  style={styles.mainLogo}
                />
              </View>

              {/* Buttons: Log In / Sign Up */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.filledPinkButton}
                  onPress={() => setShowLoginForm(true)}
                >
                  <ThemedText style={styles.filledPinkText}>Log In</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.outlinePinkButton}
                  onPress={() => router.push("/auth/signup")}
                >
                  <ThemedText style={styles.outlinePinkText}>Sign Up</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          ) : (
            // Otherwise, show the actual login form
            <ThemedView style={[styles.container, styles.loginFixesContainer]}>
              {/* Normal IRL logo on top */}
              <Image
                source={require("../../assets/images/app_logo_transparent.png")}
                style={styles.formLogo}
              />

              {/* Text Inputs: Email & Password */}
              <ThemedTextInput
                style={[styles.inputText, styles.inputFieldFix, { width: "100%" }]}
                text={email}
                onChangeText={onChangeEmail}
                placeholder="Email"
                placeholderTextColor="#999"
              />
              <ThemedTextInput
                style={[styles.inputText, styles.inputFieldFix, { width: "100%" }]}
                text={password}
                onChangeText={onChangePassword}
                placeholder="Password"
                type="password"
                placeholderTextColor="#999"
              />

              {/* Forgot Password Link */}
              <View style={styles.forgotPasswordContainer}>
                <Link
                  style={styles.forgotPassword}
                  href={{ pathname: "/auth/forgotpassword", params: { name: "Bacon" } }}
                >
                  <ThemedText
                    type="link"
                    style={[styles.professionalLink, styles.blueLink]}
                  >
                    Forgot Password?
                  </ThemedText>
                </Link>
              </View>

              {/* "Log In" button -> narrower to match input fields */}
              <TouchableOpacity
                onPress={() => {
                  if (email && password) {
                    signInWithEmailAndPassword(auth, email, password)
                      .then(async (userCredential) => {
                        await registerForPushNotificationsAsync();
                        const user = userCredential.user;
                        if (user.emailVerified) {
                          router.replace("/(tabs)/");
                        } else {
                          router.push("/auth/verification");
                        }
                      })
                      .catch((error) => {
                        const errorCode = error.code;
                        if (errorCode === "auth/invalid-email") {
                          Alert.alert("Invalid Email");
                        } else if (errorCode === "auth/invalid-credential") {
                          Alert.alert("Incorrect Email or Password");
                        } else if (errorCode === "auth/user-not-found") {
                          Alert.alert("User not found");
                        }
                      });
                  } else {
                    Alert.alert("Cannot leave field empty");
                  }
                }}
                style={[
                  styles.loginButtonFix,
                  { width: "100%", borderRadius: 8, alignSelf: "center" }
                ]}
              >
                <ThemedText style={{ textAlign: "center", color: "#FFF" }}>
                  Log in
                </ThemedText>
              </TouchableOpacity>

              {/* OR divider */}
              <View style={styles.dividerContainer}>
                <Divider style={{ flex: 1 }} />
                <ThemedText style={styles.dividerText}>OR</ThemedText>
                <Divider style={{ flex: 1 }} />
              </View>

              {/* Already have an account? */}
              <ThemedText
                type="grayed"
                style={[
                  styles.signupContainer,
                  styles.professionalLink,
                  { color: "#CCC" }
                ]}
              >
                Don&apos;t have an account?{" "}
                <Link
                  style={styles.link}
                  href={{ pathname: "/auth/signup", params: { name: "Bacon" } }}
                >
                  {/* Same blue as "Forgot Password?" */}
                  <ThemedText
                    type="link"
                    style={[styles.professionalLink, styles.blueLink]}
                  >
                    Sign up.
                  </ThemedText>
                </Link>
              </ThemedText>
            </ThemedView>
          )}
        </View>
      </Animated.View>

      {/* Dots at the bottom (scenes 0..6) */}
      <View style={styles.dotsContainer}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const isActive = i === sceneIndex;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]}
              onPress={() => goToScene(i)}
            />
          );
        })}
      </View>

      {/* 
        Cuter Arrow Buttons (Ionicons) in the middle left/right of the screen 
      */}
      <View style={styles.arrowsContainer}>
        {sceneIndex > 0 && (
          <TouchableOpacity
            style={[styles.arrowButton, { left: 10 }]}
            onPress={() => goToScene(sceneIndex - 1)}
          >
            {/* “arrow-back-circle” with pink color for a cuter vibe */}
            <Ionicons name="arrow-back-circle" size={38} color="#FF7EB3" />
          </TouchableOpacity>
        )}
        {sceneIndex < 6 && (
          <TouchableOpacity
            style={[styles.arrowButton, { right: 10 }]}
            onPress={() => goToScene(sceneIndex + 1)}
          >
            <Ionicons name="arrow-forward-circle" size={38} color="#FF7EB3" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// =================== STYLES ===================
const styles = StyleSheet.create({
  // Row container that holds all scenes horizontally
  rowContainer: {
    flexDirection: "row",
    height: "100%"
  },
  // Each scene is full screen
  sceneContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center"
  },
  // For images that fill each scene
  sceneImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain"
  },
  // For videos that fill each scene
  video: {
    width: "100%",
    height: "100%"
  },

  // IRL / Login styles (Scene #6)
  container: {
    flex: 1,
    backgroundColor: "#000", // Keep it pure black
    alignItems: "center",
    justifyContent: "center"
  },
  loginFixesContainer: {
    backgroundColor: "#000",
    borderRadius: 12,
    padding: 20,
    width: "80%",
    alignItems: "center"
  },

  // Neon logo + main IRL logo layering
  logoContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 60
  },
  neonLogo: {
    position: "absolute",
    width: 300,
    height: 300,
    resizeMode: "contain",
    zIndex: 1
  },
  mainLogo: {
    width: 300,
    height: 300,
    resizeMode: "contain",
    zIndex: 2
  },

  // Scene #6 -> IRL “welcome” screen’s bottom buttons
  buttonContainer: {
    position: "absolute",
    bottom: 100,
    width: "100%",
    alignItems: "center"
  },
  filledPinkButton: {
    backgroundColor: "#FF7EB3",
    paddingVertical: 12,
    // narrower horizontally:
    paddingHorizontal: 24,
    borderRadius: 30,
    marginBottom: 16,
    width: "90%",
    alignItems: "center"
  },
  filledPinkText: {
    color: "#FFFFFF",
    fontWeight: "bold"
  },
  outlinePinkButton: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "90%",
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#FF7EB3",
    alignItems: "center"
  },
  outlinePinkText: {
    color: "#FF7EB3",
    fontWeight: "bold"
  },

  // Actual login form styles (Scene #6, “showLoginForm”)
  formLogo: {
    width: "50%",
    height: "25%",
    marginVertical: -10,
    resizeMode: "contain"
  },
  inputText: {
    color: "#FFF"
  },
  inputFieldFix: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 10,
    marginVertical: 8
  },
  forgotPasswordContainer: {
    width: "100%",
    alignItems: "flex-end",
    marginTop: 2
  },
  forgotPassword: {
    marginRight: 4
  },
  loginButtonFix: {
    backgroundColor: "#FF7EB3",
    padding: 12,
    marginTop: 16
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 24
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#FFF"
  },
  signupContainer: {
    marginTop: 24
  },
  link: {
    marginLeft: 5
  },
  professionalLink: {
    fontFamily: "Helvetica"
  },
  blueLink: {
    color: "#007AFF"
  },

  // Dots for scene navigation
  dotsContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center"
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginHorizontal: 8
  },
  dotInactive: {
    backgroundColor: "#FFFFFF",
    opacity: 0.6
  },
  dotActive: {
    backgroundColor: "#FF7EB3"
  },

  // Cuter arrow buttons in the middle left/right
  arrowsContainer: {
    position: "absolute",
    top: "50%",
    width: "100%",
    zIndex: 999,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  arrowButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  }
});