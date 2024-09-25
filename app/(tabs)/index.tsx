import { View, Dimensions, FlatList, StyleSheet, Pressable, Image, Text } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import Carousel from 'react-native-reanimated-carousel';
import ComingSoonPage from '../misc/comingsoon';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';

const Tab = createMaterialTopTabNavigator();

export default function MyTabs() {
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
      // Query Firestore to get the current user's details
      const userDoc = doc(db, 'users', currentUser.uid);
      const userSnapshot = await getDoc(userDoc);
      const userPost = userSnapshot.data()?.post || '';

      if (!userPost) {
        setUserHasPost(false); // If the user hasn't posted anything, set to false
        return;
      }

      setUserHasPost(true); // The current user has posted something

      const friends = userSnapshot.data()?.friends || {}; // Retrieve the friends map

      // Filter out friends and fetch their posts
      const friendUIDs = Object.keys(friends).filter((uid) => friends[uid] === true);

      if (friendUIDs.length > 0) {
        const friendData: { uid: string; post: string; name: string; pfp: string, reactions: string[] }[] = [];

        // Fetch posts (videos) from each friend along with name, pfp, and reactions
        for (const uid of friendUIDs) {
          const friendDoc = doc(db, 'users', uid);
          const friendSnapshot = await getDoc(friendDoc);

          const friendPosts = friendSnapshot.data()?.post || '';
          const friendName = friendSnapshot.data()?.fname + " " + friendSnapshot.data()?.lname || 'Unknown'; // Fallback to "Unknown" if name is not present
          const friendPfp = friendSnapshot.data()?.pfp || ''; // Fallback to empty string if no pfp is set
          const friendReactions = friendSnapshot.data()?.reactions || []; // Fetch reactions array

          if (friendPosts) {
            friendData.push({
              uid,
              post: friendPosts,
              name: friendName,
              pfp: friendPfp,
              reactions: [...friendReactions, "https://firebasestorage.googleapis.com/v0/b/irl-app-3e412.appspot.com/o/click.mp4?alt=media&token=aac533fa-8ca3-4881-bb44-b4786c648ea9"] // Append the required video to the reactions
            });
          }
        }

        setVideos(friendData); // Update state with friend data (video, name, pfp, reactions)
      }
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
        /> : <ComingSoonPage text='No Posts yet. Add more friends!' />
      }

    </View>
  );
}

const Item = ({ item, shouldPlay }: { shouldPlay: boolean; item: { post: string; name: string; pfp: string; reactions: string[] } }) => {
  const video = React.useRef<Video | null>(null);
  const width = Dimensions.get('window').width;
  const [status, setStatus] = useState<any>(null);
  const [currentViewableMojiIndex, setCurrentViewableMojiIndex] = useState(0);

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
            height={width / 2}
            scrollAnimationDuration={500}
            onSnapToItem={(index) => setCurrentViewableMojiIndex(index)}
            data={item.reactions}
            renderItem={({ item, index }) => (
              <RealMoji item={item} shouldPlay={index === currentViewableMojiIndex} />
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

const RealMoji = ({ item, shouldPlay }: { shouldPlay: boolean; item: string }) => {
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

  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        justifyContent: 'center',
        borderRadius: 5,
      }}
    >
      <Pressable onPress={() => emojisStatus.isPlaying ? emoji.current?.pauseAsync() : emoji.current?.playAsync()}>
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
    backgroundColor: 'transparent'
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
