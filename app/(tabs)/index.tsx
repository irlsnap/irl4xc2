import { View, Dimensions, FlatList, StyleSheet, Pressable, Image, Text } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import Carousel from 'react-native-reanimated-carousel';
import ComingSoonPage from '../misc/comingsoon';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';

const Tab = createMaterialTopTabNavigator();

export default function MyTabs() {
  let [fontsLoaded] = useFonts({
    'Zoi-Regular': require('@/assets/fonts/Zoi-Regular.otf'),
  });

  if (fontsLoaded)
  return (
    <Tab.Navigator
      initialRouteName='friends'
      screenOptions={{
        tabBarActiveTintColor: '#fff',
        tabBarIndicatorStyle: { backgroundColor: '#fff' },
        tabBarIndicatorContainerStyle: { width: '70%', left: '5%' },
        tabBarLabelStyle: { fontSize: 16, lineHeight: 24, fontFamily: 'Zoi-Regular' },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          position: 'absolute',
          top: '11%',
          height: '5%',
          width: '100%'
        },
      }}>
      <Tab.Screen name="leaderboard" component={ComingSoonPage} />
      <Tab.Screen name="friends" component={FeedScreen} />
      <Tab.Screen name="spotlight" component={ComingSoonPage} />
    </Tab.Navigator>
  );
}

function FeedScreen() {
  const [userHasPost, setUserHasPost] = useState<boolean>(true); // Track if the current user has a post

  useFocusEffect(
    React.useCallback(() => {
      const fetchUser = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
          const userDoc = doc(db, 'users', currentUser.uid);
          const userSnapshot = await getDoc(userDoc);
          const userPost = userSnapshot.data()?.post || '';

          if (!userPost) {
            setUserHasPost(false); // If the user hasn't posted anything, set to false
            return;
          }

          setUserHasPost(true); // The current user has posted something

        } catch (error) {
          console.error("Error fetching latest post:", error);
        }
      };
  
      fetchUser();
  
      return () => {
        // isActive = false;
      };
    }, [userHasPost])
  );

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    fetchFriendVideos(); // Fetch the videos of friends when component mounts
  }, []);

  const fetchFriendVideos = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
  
    try {
      const userDoc = doc(db, 'users', currentUser.uid);
  
      // Real-time listener for user changes
      const unsubscribe = onSnapshot(userDoc, (userSnapshot) => {
        const userPost = userSnapshot.data()?.post || '';
  
        if (!userPost) {
          setUserHasPost(false);
          return;
        }
  
        setUserHasPost(true);
  
        const friends = userSnapshot.data()?.friends || {};
  
        // Filter friends who are accepted
        const friendUIDs = Object.keys(friends).filter((uid) => friends[uid] === true);
  
        const allVideos: { uid: string; post: string; name: string; pfp: string, reactions: string[] }[] = [];
  
        // Add the current user's video to the feed first
        allVideos.push({
          uid: currentUser.uid,
          post: userPost,
          name: userSnapshot.data()?.fname + " " + userSnapshot.data()?.lname || 'Me',
          pfp: userSnapshot.data()?.pfp || '',
          reactions: userSnapshot.data()?.reactions || []
        });
  
        // Fetch posts (videos) from friends
        if (friendUIDs.length > 0) {
          friendUIDs.forEach(async (uid) => {
            const friendDoc = doc(db, 'users', uid);
  
            onSnapshot(friendDoc, (friendSnapshot) => {
              const friendPosts = friendSnapshot.data()?.post || '';
              const friendName = friendSnapshot.data()?.fname + " " + friendSnapshot.data()?.lname || 'Unknown';
              const friendPfp = friendSnapshot.data()?.pfp || '';
              const friendReactions = friendSnapshot.data()?.reactions || [];
              const filteredReactions = friendReactions.filter((reaction: string) => reaction !== '');
  
              if (friendPosts) {
                const updatedFriendData = {
                  uid,
                  post: friendPosts,
                  name: friendName,
                  pfp: friendPfp,
                  reactions: [...filteredReactions, "https://firebasestorage.googleapis.com/v0/b/irl-app-3e412.appspot.com/o/click.mp4?alt=media&token=aac533fa-8ca3-4881-bb44-b4786c648ea9"] // Add the hardcoded video for friends
                };
  
                allVideos.push(updatedFriendData);
                setVideos([...allVideos]); // Set the videos state
              }
            });
          });
        } else {
          setVideos([...allVideos]); // Set only the user's video if no friends
        }
      });
  
      return () => unsubscribe();
  
    } catch (error) {
      console.error('Error fetching friend videos:', error);
    }
  };  

  const [videos, setVideos] = useState<{ uid: string; post: string; name: string; pfp: string; reactions: string[] }[]>([]);

  const [currentViewableItemIndex, setCurrentViewableItemIndex] = useState(0);
  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 }
  const onViewableItemsChanged = ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentViewableItemIndex(viewableItems[0].index ?? 0);
    }
  }
  const viewabilityConfigCallbackPairs = useRef([{ viewabilityConfig, onViewableItemsChanged }])

  // If user hasn't posted anything, show the ComingSoonPage
  if (!userHasPost) {
    return <ComingSoonPage text="You haven't posted yet. Go Post!" />;
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/app_logo_transparent.png')}
        style={styles.logo}
      />

      {videos.length > 0 ?
        <FlatList
          data={videos}
          renderItem={({ item, index }) => (
            <Item item={item} shouldPlay={index === currentViewableItemIndex} />
          )}
          keyExtractor={item => item.uid}
          pagingEnabled
          horizontal={false}
          showsVerticalScrollIndicator={false}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
          initialNumToRender={1}
        /> : <ComingSoonPage text='No Posts yet. Add more friends!' />
      }

    </View>
  );
}

const Item = ({ item, shouldPlay }: { shouldPlay: boolean; item: { uid: string, post: string; name: string; pfp: string; reactions: string[] } }) => {
  const video = React.useRef<Video | null>(null);
  const width = Dimensions.get('window').width;
  const [status, setStatus] = useState<any>(null);
  const [currentViewableMojiIndex, setCurrentViewableMojiIndex] = useState(0);

  const i = item;

  useEffect(() => {
    if (!video.current) return;

    if (shouldPlay) {
      video.current.playAsync()
    } else {
      video.current.pauseAsync()
      video.current.setPositionAsync(0)
    }
  }, [shouldPlay])

  return (
    <View>
      <Pressable onPress={() => status.isPlaying ? video.current?.pauseAsync() : video.current?.playAsync()}>

        <View style={{ flex: 1, position: 'absolute', zIndex: 4, bottom: 0, marginLeft: "5%", marginBottom: "3%" }}>
          <Carousel
            snapEnabled
            loop
            width={width / 4}
            height={width / 2.5}
            scrollAnimationDuration={500}
            onSnapToItem={(index) => setCurrentViewableMojiIndex(index)}
            data={item.reactions}
            renderItem={({ item, index }) => (
              <RealMoji item={item} shouldPlay={index === currentViewableMojiIndex} friendUid={i.uid} />
            )}
          />
        </View>

        <View style={styles.videoContainer}>
          <Video
            ref={video}
            source={{ uri: item.post }}
            style={styles.video}
            isLooping
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            onPlaybackStatusUpdate={status => setStatus(() => status)}
          />

          {/* Profile Picture and Name */}
          <View style={styles.profileContainer}>
            {item.pfp ? (
              <Image source={{ uri: item.pfp }} style={styles.profileImage} />
            ) : (
              <View style={styles.defaultProfileIcon}>
                <Text style={styles.defaultProfileText}>👤</Text>
              </View>
            )}
            <Text style={styles.profileName}>{item.name}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const RealMoji = ({ item, shouldPlay, friendUid }: { shouldPlay: boolean; item: string, friendUid: string }) => {
  const emoji = React.useRef<Video | null>(null);

  const [emojisStatus, setEmojisStatus] = useState<any>(null);

  useEffect(() => {
    if (!emoji.current) return;

    if (shouldPlay) {
      emoji.current.setPositionAsync(0)
      emoji.current.pauseAsync()
    } else {
      emoji.current.pauseAsync()
      emoji.current.setPositionAsync(0)
    }
  }, [shouldPlay])

  const handlePress = async () => {
    const currentUserUid = auth.currentUser?.uid; // Get the current user's UID
    if (!currentUserUid) {
      alert("You must be logged in to react.");
      return;
    }
  
    // Check if the item matches the specific video URL
    if (item === 'https://firebasestorage.googleapis.com/v0/b/irl-app-3e412.appspot.com/o/click.mp4?alt=media&token=aac533fa-8ca3-4881-bb44-b4786c648ea9') {
      // Fetch friend's data from Firestore
      try {
        const friendDoc = doc(db, 'users', friendUid); // Replace friendUid with the actual friend's UID you passed
        const friendSnapshot = await getDoc(friendDoc);
  
        if (friendSnapshot.exists()) {
          const friendData = friendSnapshot.data();
          const alreadyReacted = friendData?.reactionUids?.includes(currentUserUid); // Check if the current user UID is in the reactionUids
  
          if (alreadyReacted) {
            alert("Already reacted to this video");
            return; // Exit the function if the user has already reacted
          }
        } else {
          console.error("Friend not found");
        }
      } catch (error) {
        console.error("Error fetching friend's data:", error);
      }
  
      // If not reacted, navigate to the camera view
      console.log('Trigger camera view');
      router.push({
        pathname: '/misc/reactionvideo',
        params: { friendUid: friendUid }, // Pass the friend's UID here
      });
    } else {
      emojisStatus.isPlaying ? emoji.current?.pauseAsync() : emoji.current?.playAsync();
    }
  };  

  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        justifyContent: 'center',
        borderRadius: 5,
      }}
    >
      <Pressable onPress={handlePress}>
        <Video
          ref={emoji}
          source={{ uri: item }}
          style={styles.video}
          isLooping
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          onPlaybackStatusUpdate={emojisStatus => setEmojisStatus(() => emojisStatus)}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  logo: {
    width: '15%',
    height: '15%',
    right: "5%",
    position: 'absolute',
    zIndex: 2,
    backgroundColor: 'transparent',
    top: "2%"
  },
  container: {
    flex: 1,
  },
  videoContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 75,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  profileContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 30,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  defaultProfileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  defaultProfileText: {
    color: '#fff',
    fontSize: 18,
  },
  profileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
