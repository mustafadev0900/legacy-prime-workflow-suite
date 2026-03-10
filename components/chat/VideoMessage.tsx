import { View, StyleSheet, TouchableOpacity, Platform, Text } from 'react-native';
import { useState } from 'react';
import { Play } from 'lucide-react-native';

interface Props {
  uri: string;
  isOwn: boolean;
  duration?: number; // seconds
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

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VideoPlayerContent({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p: any) => {
    p.loop = false;
    p.play();
  });

  const handleTap = () => {
    try {
      if (player.playing) player.pause();
      else player.play();
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

function NativeVideoPlayer({ uri, duration }: { uri: string; duration?: number }) {
  const [tapped, setTapped] = useState(false);

  if (!VideoView || !useVideoPlayer) {
    return (
      <View style={styles.videoContainer}>
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
        {duration != null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      {tapped ? (
        <VideoPlayerContent uri={uri} />
      ) : (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setTapped(true)}
          activeOpacity={1}
        >
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>
          {duration != null && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function WebVideoPlayer({ uri, duration }: { uri: string; duration?: number }) {
  const [tapped, setTapped] = useState(false);

  if (!tapped) {
    return (
      <View style={styles.videoContainer}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setTapped(true)}
          activeOpacity={1}
        >
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>
          {duration != null && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.webContainer}>
      {/* @ts-ignore — web-only element */}
      <video
        src={uri}
        controls
        autoPlay
        preload="metadata"
        style={{ width: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'contain' }}
      />
    </View>
  );
}

export default function VideoMessage({ uri, duration }: Props) {
  if (Platform.OS === 'web') {
    return <WebVideoPlayer uri={uri} duration={duration} />;
  }
  return <NativeVideoPlayer uri={uri} duration={duration} />;
}

const styles = StyleSheet.create({
  videoContainer: {
    width: 240,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  webContainer: {
    width: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
});
