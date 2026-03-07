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

function NativeVideoPlayer({ uri }: { uri: string }) {
  const [tapped, setTapped] = useState(false);

  // Always initialize with null source — only load the asset when the user taps play.
  // Passing the URI at render time causes AVAsset to load synchronously ("isPlayable"
  // accessed before load) and triggers FigApplicationStateMonitor errors on iOS.
  const player = useVideoPlayer
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useVideoPlayer(tapped ? uri : null, (p: any) => {
        if (tapped) {
          p.loop = false;
        }
      })
    : null;

  if (!VideoView || !player) {
    return (
      <View style={styles.fallback}>
        <VideoIcon size={32} color="#9CA3AF" />
        <Text style={styles.fallbackText}>Video</Text>
      </View>
    );
  }

  const handleTap = () => {
    if (!tapped) {
      setTapped(true);
      // player.play() will be called after source is loaded in the setup callback
      // Give expo-video one tick to attach the source before playing
      setTimeout(() => {
        try { player.play(); } catch { /* ignore if not ready */ }
      }, 100);
    } else {
      // Toggle play/pause if already started
      try {
        if (player.playing) {
          player.pause();
        } else {
          player.play();
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
      />
      {/* Show play overlay until user taps */}
      {!tapped && (
        <TouchableOpacity style={styles.playOverlay} onPress={handleTap} activeOpacity={0.8}>
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
