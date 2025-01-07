// FILE: app/(tabs)/Chat.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Dimensions,
  SafeAreaView,
} from "react-native";
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import Ionicons from "@expo/vector-icons/Ionicons";
import { auth, db, storage } from "../firebaseConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { sendPushNotification } from "../notifs";
import { useRouter } from "expo-router"; // <--- navigation

/******************************************************************************
 * UTILS
 *****************************************************************************/
function formatLastSeen(timestamp: number) {
  const now = new Date();
  const lastSeen = new Date(timestamp);
  const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);

  if (diffMinutes < 1) return "Online";
  if (diffMinutes < 60) return `Online ${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  return `Online ${hours}h${hours > 1 ? "s" : ""} ago`;
}

function getFriendUidFromChatId(chatId: string) {
  const [uid1, uid2] = chatId.split("_");
  const myUid = auth.currentUser?.uid;
  return uid1 === myUid ? uid2 : uid1;
}

/******************************************************************************
 * TYPES
 *****************************************************************************/
type FriendData = {
  uid: string;
  fname: string;
  lname: string;
  username?: string;
  pfp?: string;
  lastSeen?: number;
  usageCount?: number;
};

// + Add `status` to MessageData
type MessageData = {
  id?: string;
  senderUid: string;
  videoUrl: string;
  timestamp: number;
  status?: "sent" | "delivered" | "watched";
};

/******************************************************************************
 * MAIN COMPONENT
 *****************************************************************************/
export default function Chat() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [viewingChat, setViewingChat] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentFriend, setCurrentFriend] = useState<FriendData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [uploading, setUploading] = useState(false);

  /******************************************************************************
   * 1) FETCH FRIEND LIST & READ usageCounts
   *****************************************************************************/
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, "users", currentUser.uid);

    const unsubscribe = onSnapshot(userDocRef, async (userSnapshot) => {
      if (!userSnapshot.exists()) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const userData = userSnapshot.data() || {};
      const usageCounts = userData.chatUsageCounts || {};

      const friendUIDs = Object.keys(userData.friends || {}).filter(
        (uid) => userData.friends[uid] === true
      );

      if (friendUIDs.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const friendPromises: Promise<FriendData>[] = friendUIDs.map((fuid) => {
        return new Promise((resolve) => {
          const friendRef = doc(db, "users", fuid);
          onSnapshot(friendRef, (fSnap) => {
            if (fSnap.exists()) {
              const fData = fSnap.data();
              resolve({
                uid: fuid,
                fname: fData?.fname || "",
                lname: fData?.lname || "",
                username: fData?.username || "",
                pfp: fData?.pfp || "",
                lastSeen: fData?.lastSeen || Date.now(),
                usageCount: usageCounts[fuid] || 0,
              });
            } else {
              resolve({
                uid: fuid,
                fname: "Unknown",
                lname: "",
                usageCount: usageCounts[fuid] || 0,
              });
            }
          });
        });
      });

      const friendList = await Promise.all(friendPromises);

      // Sort by usageCount (descending)
      friendList.sort((a, b) => {
        const countA = a.usageCount || 0;
        const countB = b.usageCount || 0;
        return countB - countA;
      });

      setFriends(friendList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /******************************************************************************
   * 2) ENTER A SPECIFIC VIDEO CHAT => increment usageCount
   *****************************************************************************/
  const enterVideoChat = useCallback(async (friend: FriendData) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const myUid = currentUser.uid;
    const participants = [myUid, friend.uid].sort();
    const chatId = participants.join("_");

    // Check if doc exists, else create it
    const chatDocRef = doc(db, "videoChats", chatId);
    const chatSnap = await getDoc(chatDocRef);
    if (!chatSnap.exists()) {
      await setDoc(chatDocRef, {
        participants,
        createdAt: Date.now(),
      });
    }

    // Increment usage count in Firestore
    const userDocRef = doc(db, "users", myUid);
    await updateDoc(userDocRef, {
      [`chatUsageCounts.${friend.uid}`]: increment(1),
    });

    setViewingChat(true);
    setCurrentChatId(chatId);
    setCurrentFriend(friend);
  }, []);

  /******************************************************************************
   * 3) LISTEN TO MESSAGES + update "delivered"
   *****************************************************************************/
  useEffect(() => {
    if (!viewingChat || !currentChatId) return;

    const messagesRef = collection(db, "videoChats", currentChatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "desc"));

    const unsub = onSnapshot(q, async (snapshot) => {
      const allMessages: MessageData[] = [];
      const myUid = auth.currentUser?.uid;

      for (const docSnap of snapshot.docs) {
        const msgData = docSnap.data() as MessageData;
        const msgId = docSnap.id;

        // If this message is from the other user, and status === "sent",
        // it means "I've now delivered it," so mark "delivered".
        if (msgData.senderUid !== myUid && msgData.status === "sent") {
          await updateDoc(docSnap.ref, { status: "delivered" });
        }

        allMessages.push({ id: msgId, ...msgData });
      }

      setMessages(allMessages);
    });

    return () => unsub();
  }, [viewingChat, currentChatId]);

  /******************************************************************************
   * 4) NAVIGATE => ReactionVideo for Chat
   *****************************************************************************/
  const recordVideoForChat = () => {
    if (!currentChatId || !currentFriend) return;

    router.push({
      pathname: "/misc/reactionvideo",
      params: {
        chatId: currentChatId,
        friendUid: currentFriend.uid,
        isChat: "true",
      },
    });
  };

  /******************************************************************************
   * 5) STATUS HELPER => For My Latest Message
   *****************************************************************************/
  function getMyLatestMessageStatus():
    | "sent"
    | "delivered"
    | "watched"
    | null {
    const myUid = auth.currentUser?.uid;
    // newest messages are at index 0
    const myMessages = messages.filter((m) => m.senderUid === myUid);
    if (!myMessages.length) return null;
    return myMessages[0].status || null;
  }

  // Small UI component to show "Sent", "Delivered", or "Watched" below the button
  function MyMessageStatus() {
    const status = getMyLatestMessageStatus();
    if (!status) return null;

    let statusText = "";
    if (status === "sent") statusText = "Sent";
    if (status === "delivered") statusText = "Delivered";
    if (status === "watched") statusText = "Watched";

    return (
      <Text style={{ color: "#999", marginTop: 4, fontSize: 13 }}>
        Your last video: {statusText}
      </Text>
    );
  }

  /******************************************************************************
   * DYNAMIC RENDERING OF BUTTON
   *****************************************************************************/
  function renderRespondButton() {
    if (!messages.length) {
      // No messages => user can send first
      return (
        <View style={{ alignItems: "center" }}>
          <TouchableOpacity
            style={styles.respondBox}
            onPress={recordVideoForChat}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name="add"
                  size={24}
                  color="#FFF"
                  style={{ marginBottom: 6 }}
                />
                <Text style={styles.respondText}>RESPOND</Text>
              </>
            )}
          </TouchableOpacity>
          <MyMessageStatus />
        </View>
      );
    }

    const myUid = auth.currentUser?.uid;
    const newestMessage = messages[0];
    const latestSender = newestMessage.senderUid;

    if (latestSender === myUid) {
      // I sent the latest => show "waiting" + my status
      return (
        <View style={{ alignItems: "center" }}>
          <View style={styles.waitingBox}>
            <Text style={styles.waitingText}>
              Waiting for {currentFriend?.fname || "friend"}...
            </Text>
          </View>
          <MyMessageStatus />
        </View>
      );
    } else {
      // friend is the latest => I can respond
      return (
        <View style={{ alignItems: "center" }}>
          <TouchableOpacity
            style={styles.respondBox}
            onPress={recordVideoForChat}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name="add"
                  size={24}
                  color="#FFF"
                  style={{ marginBottom: 6 }}
                />
                <Text style={styles.respondText}>RESPOND</Text>
              </>
            )}
          </TouchableOpacity>
          <MyMessageStatus />
        </View>
      );
    }
  }

  /******************************************************************************
   * IF LOADING
   *****************************************************************************/
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF69B4" />
        <Text style={{ color: "#FF69B4", marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  /******************************************************************************
   * FRIEND LIST
   *****************************************************************************/
  if (!viewingChat) {
    return (
      <SafeAreaView style={styles.friendListContainer}>
        <Text style={styles.headerText}>VIDEO MESSAGES</Text>

        {friends.length === 0 ? (
          <View style={styles.noFriendsContainer}>
            <Ionicons
              name="sad-outline"
              size={64}
              color="#FF69B4"
              style={{ marginBottom: 10 }}
            />
            <Text style={styles.noFriendsText}>
              No friends yet. Add some to get started!
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContentContainer}
            renderItem={({ item }) => {
              const lastSeenText = formatLastSeen(item.lastSeen || Date.now());
              const isOnline = lastSeenText === "Online";

              return (
                <TouchableOpacity
                  style={styles.friendItem}
                  onPress={() => enterVideoChat(item)}
                >
                  <View style={styles.friendInfo}>
                    <View style={styles.profilePicWrapper}>
                      {item.pfp ? (
                        <Image
                          source={{ uri: item.pfp }}
                          style={styles.friendProfilePic}
                        />
                      ) : (
                        <Ionicons
                          name="person-circle-outline"
                          size={56}
                          color="#FFF"
                        />
                      )}
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isOnline ? "#4CD964" : "#555" },
                        ]}
                      />
                    </View>

                    <View>
                      <Text style={styles.friendName}>
                        {item.fname} {item.lname}
                      </Text>
                      <Text style={styles.friendStatus}>{lastSeenText}</Text>
                    </View>
                  </View>

                  <Ionicons
                    name="videocam"
                    size={22}
                    color="#FF69B4"
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  /******************************************************************************
   * CHAT ROOM
   *****************************************************************************/
  const friendFullName =
    (currentFriend?.fname ?? "") + " " + (currentFriend?.lname ?? "");

  return (
    <SafeAreaView style={styles.chatContainer}>
      {/* 1) SMALL TOP BAR => just the back arrow */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            setViewingChat(false);
            setCurrentChatId(null);
            setMessages([]);
            setCurrentFriend(null);
          }}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 2) FRIEND’S NAME + VIDEO + [Respond or "Waiting"] */}
      <View style={styles.mainRow}>
        {/* Left => pfp + name + video */}
        <View style={styles.leftColumn}>
          {/* Friend’s pic & name */}
          <View style={styles.pfpAndName}>
            <View style={styles.friendHeaderPicWrap}>
              {currentFriend?.pfp ? (
                <Image
                  source={{ uri: currentFriend.pfp }}
                  style={styles.friendHeaderPic}
                />
              ) : (
                <Ionicons name="person-circle" size={60} color="#FFF" />
              )}
            </View>
            <Text style={styles.friendHeaderName}>{friendFullName.trim()}</Text>
          </View>

          {/* Friend’s Video => placeholder with pink border */}
          <View style={styles.friendVideoContainer}>
            <Ionicons name="camera-outline" size={40} color="#777" />
            <TouchableOpacity style={styles.refreshIcon}>
              <Ionicons name="refresh-circle" size={32} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Right => respond or waiting + status text */}
        <View style={styles.rightColumn}>{renderRespondButton()}</View>
      </View>
    </SafeAreaView>
  );
}

/******************************************************************************
 * STYLES
 *****************************************************************************/
const SCREEN_WIDTH = Dimensions.get("window").width;

const styles = StyleSheet.create({
  // LOADING
  loaderContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },

  // FRIEND LIST
  friendListContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  headerText: {
    fontSize: 22,
    color: "#FF69B4",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 15,
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  noFriendsContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noFriendsText: {
    color: "#AAA",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginHorizontal: 40,
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  friendItem: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  friendInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  profilePicWrapper: {
    position: "relative",
    marginRight: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  friendProfilePic: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  statusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2,
    borderColor: "#000",
  },
  friendName: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  friendStatus: {
    color: "#BBB",
    fontSize: 12,
  },

  // CHAT ROOM
  chatContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#000",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    flex: 1,
    paddingTop: 20,
  },
  leftColumn: {
    alignItems: "center",
    justifyContent: "center",
  },
  rightColumn: {
    alignItems: "center",
    justifyContent: "center",
  },
  pfpAndName: {
    alignItems: "center",
    marginBottom: 24,
  },
  friendHeaderPicWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  friendHeaderPic: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  friendHeaderName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  friendVideoContainer: {
    width: SCREEN_WIDTH * 0.42,
    aspectRatio: 3 / 5,
    backgroundColor: "#333",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FF69B4",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  refreshIcon: {
    position: "absolute",
    bottom: 8,
    left: "50%",
    marginLeft: -16,
  },
  respondBox: {
    width: SCREEN_WIDTH * 0.28,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "#FF69B4",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  respondText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  waitingBox: {
    width: SCREEN_WIDTH * 0.28,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "#555",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  waitingText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 8,
  },
});