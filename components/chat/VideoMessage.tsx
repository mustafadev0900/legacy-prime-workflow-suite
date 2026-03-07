import { View, StyleSheet, TouchableOpacity, Platform, Text } from 'react-native';
import { useState } from 'react';
import { Play } from 'lucide-react-native';

interface Props {
  uri: string;
  isOwn: boolean;
}

// expo-video VideoView — only import on native; web uses <video> element
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  const expoVideo = require('expo-video');
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch {
  // expo-video not installed or not available on this platform
}

function NativeVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer ? useVideoPlayer(uri) : null;
  const [started, setStarted] = useState(false);

  if (!VideoView || !player) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Video</Text>
      </View>
    );
  }

  const handlePlay = () => {
    player.play();
    setStarted(true);
  };

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
      />
      {!started && (
        <TouchableOpacity style={styles.playOverlay} onPress={handlePlay} activeOpacity={0.8}>
          <View style={styles.playButton}>
            <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

function WebVideoPlayer({ uri }: { uri: string }) {
  return (
    <View style={styles.videoContainer}>
      {/* @ts-ignore — web-only element */}
      <video
        src={uri}
        controls
        style={{ width: '100%', maxHeight: 240, borderRadius: 8, objectFit: 'contain' }}
      />
    </View>
  );
}

export default function VideoMessage({ uri, isOwn }: Props) {
  if (Platform.OS === 'web') {
    return <WebVideoPlayer uri={uri} />;
  }
  return <NativeVideoPlayer uri={uri} />;
}

const styles = StyleSheet.create({
  videoContainer: {
    width: 240,
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    width: 240,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
