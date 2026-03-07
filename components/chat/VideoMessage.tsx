import { View, StyleSheet, TouchableOpacity, Platform, Text } from 'react-native';
import { useState } from 'react';
import { Play, Video as VideoIcon } from 'lucide-react-native';

interface Props {
  uri: string;
  isOwn: boolean;
}

// Import expo-video lazily to avoid module-level side effects
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  const expoVideo = require('expo-video');
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch {
  // expo-video not installed
}

/**
 * Inner component — only mounts after the user taps play.
 * Keeping useVideoPlayer + VideoView inside a child that mounts on-demand
 * prevents AVAsset from loading synchronously at render time, which was the
 * cause of FigApplicationStateMonitor err=-19431 and the "isPlayable accessed
 * synchronously before being loaded" warning on iOS.
 */
function VideoPlayerContent({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p: any) => {
    p.loop = false;
    // Start playing as soon as the player is configured
    p.play();
  });

  const handleTap = () => {
    try {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch { /* ignore */ }
  };

  return (
    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleTap} activeOpacity={1}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
      />
    </TouchableOpacity>
  );
}

function NativeVideoPlayer({ uri }: { uri: string }) {
  const [tapped, setTapped] = useState(false);

  if (!VideoView || !useVideoPlayer) {
    return (
      <View style={styles.fallback}>
        <VideoIcon size={32} color="#9CA3AF" />
        <Text style={styles.fallbackText}>Video</Text>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      {tapped ? (
        <VideoPlayerContent uri={uri} />
      ) : (
        <TouchableOpacity style={styles.playOverlay} onPress={() => setTapped(true)} activeOpacity={0.8}>
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
    <View style={styles.webContainer}>
      {/* @ts-ignore — web-only element */}
      <video
        src={uri}
        controls
        preload="metadata"
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
  webContainer: {
    width: 240,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    gap: 8,
  },
  fallbackText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
