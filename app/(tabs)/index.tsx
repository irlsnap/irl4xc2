import { View, Dimensions, FlatList, StyleSheet, Pressable, Image, ListRenderItemInfo, ListRenderItem } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { Link } from 'expo-router';
import Carousel from 'react-native-reanimated-carousel';

const videos = [
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
];

const emojis = [
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
];

export default function FeedScreen() {
  const [leaderboardSelected, setLeaderboard] = useState(false);
  const [followingSelected, setFollowing] = useState(true);
  const [spotlightSelected, setSpotlight] = useState(false);

  const [currentViewableItemIndex, setCurrentViewableItemIndex] = useState(0);
  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 }
  const onViewableItemsChanged = ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentViewableItemIndex(viewableItems[0].index ?? 0);
    }
  }
  const viewabilityConfigCallbackPairs = useRef([{ viewabilityConfig, onViewableItemsChanged }])
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/app_logo_transparent.png')}
        style={styles.logo}
      />

      <Link 
        onPress={() => {
          setLeaderboard(true);
          setFollowing(false);
          setSpotlight(false);
        }}
        href={"/(tabs)/"} 
        style={{
          position: 'absolute',
          top: "13%",
          left: "10%",
          zIndex: 2,
          textDecorationLine: leaderboardSelected ? "underline" : "none"
      }}>
        <ThemedText type="defaultSemiBold">leaderboard</ThemedText>
      </Link>

      <Link 
        onPress={() => {
          setLeaderboard(false);
          setFollowing(true);
          setSpotlight(false);
        }}
        href={"/(tabs)/"} 
        style={{
          position: 'absolute',
          top: "13%",
          left: "42%",
          zIndex: 2,
          textDecorationLine: followingSelected ? "underline" : "none"
      }}>
        <ThemedText type="defaultSemiBold">following</ThemedText>
      </Link>

      <Link 
        onPress={() => {
          setLeaderboard(false);
          setFollowing(false);
          setSpotlight(true);
        }}
        href={"/(tabs)/"} 
        style={{
          position: 'absolute',
          top: "13%",
          left: "70%",
          zIndex: 2,
          textDecorationLine: spotlightSelected ? "underline" : "none"
      }}>
        <ThemedText type="defaultSemiBold">spotlight</ThemedText>
      </Link>
      
      <FlatList
        data={videos}
        renderItem={({ item, index }) => (
          <Item item={item} shouldPlay={index === currentViewableItemIndex} />
        )}
        keyExtractor={item => item}
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
      />
      </View>
    );
  }

const Item = ({ item, shouldPlay }: {shouldPlay: boolean; item: string}) => {
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

      <View style={{ flex: 1, position: 'absolute', zIndex: 4, bottom: 0 }}>
            <Carousel
                snapEnabled
                // loop
                width={width/4}
                height={width/2}
                // autoPlay={true}
                // data={[...new Array(6).keys()]}
                data={emojis}
                scrollAnimationDuration={500}
                onSnapToItem={(index) => setCurrentViewableMojiIndex(index)}
                renderItem={({ item, index }) => (
                  <RealMoji item={item} shouldPlay={index === currentViewableMojiIndex} />
                )}
            />
        </View>
        
        <View style={styles.videoContainer}>
          <Video 
            ref={video}
            source={{ uri: item }}
            style={styles.video}
            isLooping
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            onPlaybackStatusUpdate={status => setStatus(() => status)}
          />
        </View>
      </Pressable>
    </View>
  );
}

const RealMoji = ({ item, shouldPlay }: {shouldPlay: boolean; item: string}) => {
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
      }}
    >
      <Pressable onPress={() => emojisStatus.isPlaying ? emoji.current?.pauseAsync() : emoji.current?.playAsync()}>
      {/* <Pressable onPress={() => {}}> */}
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
    height: Dimensions.get('window').height-75,

  },
  video: {
    width: '100%',
    height: '100%',
  },
});