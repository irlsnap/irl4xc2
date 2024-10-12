// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import AsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCyx7K-EfPZCnl5e_N4YhnwNpkZ0IrxPVs",
  authDomain: "irl-app-3e412.firebaseapp.com",
  projectId: "irl-app-3e412",
  storageBucket: "irl-app-3e412.appspot.com",
  messagingSenderId: "588872018949",
  appId: "1:588872018949:web:4011b17c83b23e6d9a806c",
  measurementId: "G-8M645Y4XNL"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const db = getFirestore(app);
const storage = getStorage(app);
export {auth, db, storage};
// const analytics = getAnalytics(app);