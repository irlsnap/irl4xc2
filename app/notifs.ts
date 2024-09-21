import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import Constants from 'expo-constants';

async function registerForPushNotificationsAsync() {
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return;
  }

  const projectId = "1b119f96-ae7e-4164-a358-33e5a87e7364"
  
  if (projectId){
    token = (await Notifications.getExpoPushTokenAsync({
      projectId
    })).data;
  }
  
  // Save token to Firestore under the user's document
  if (auth.currentUser) {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, { pushToken: token });
  }

  return token;
}

export default registerForPushNotificationsAsync;