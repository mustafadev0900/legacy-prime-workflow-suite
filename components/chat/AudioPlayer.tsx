import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PanResponder,
  LayoutChangeEvent,
  ActivityIndicator,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react-native';
import { Audio } from 'expo-av';

interface Props {
  uri: string;
  duration: number; // seconds
  messageId: string;
  isOwn: boolean;
  /** Called when this player starts playing, so parent can stop others */
  onPlay?: (messageId: string) => void;
  /** Parent signals this player to stop */
  shouldStop?: boolean;
}

/** iOS cannot play WebM/Opus — these are web-only formats */
const isUnsupportedOnIOS = (url: string) =>
  Platform.OS !== 'web' && /\.webm($|\?)/i.test(url);

/**
 * Module-level flag — setAudioModeAsync configures the iOS AVAudioSession and
 * only needs to be called once per app session, not on every play tap.
 */
let audioModeConfigured = false;
async function ensureAudioMode() {
  if (audioModeConfigured || Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    audioModeConfigured = true;
  } catch {
    // non-fatal
  }
}

// Static waveform bar heights — deterministic per component instance
const BAR_COUNT = 30;
const WAVEFORM = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = i / BAR_COUNT;
  const v =
    0.4 +
    0.25 * Math.sin(t * Math.PI * 3.7) +
    0.15 * Math.sin(t * Math.PI * 8.3 + 1) +
    0.1 * Math.sin(t * Math.PI * 15 + 2) +
    0.1 * Math.abs(Math.sin(t * Math.PI * 6 + 0.5));
  return Math.max(0.15, Math.min(1, v));
});

export default function AudioPlayer({
  uri,
  duration,
  messageId,
  isOwn,
  onPlay,
  shouldStop,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [totalSec, setTotalSec] = useState(duration || 0);
  const [formatError, setFormatError] = useState(false);
  // 'loading' → pre-fetching on mount; 'ready' → buffered; 'error' → failed
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSeeking = useRef(false);
  const waveWidthRef = useRef(0);
  // Prevent status callbacks from a stale sound instance after unmount/reload
  const mountedRef = useRef(true);

  const progress = totalSec > 0 ? Math.min(positionSec / totalSec, 1) : 0;

  // ─── Pre-load audio on mount ──────────────────────────────────────────────
  // WhatsApp-style: buffer the file as soon as the bubble is rendered so the
  // first tap plays instantly. Voice messages are small (<1 MB), so loading
  // eagerly for visible messages is fine.
  useEffect(() => {
    mountedRef.current = true;

    if (Platform.OS === 'web' || isUnsupportedOnIOS(uri)) {
      if (isUnsupportedOnIOS(uri)) setFormatError(true);
      setLoadState('ready'); // web uses HTML5 Audio, no pre-loading needed
      return;
    }

    let cancelled = false;

    const preload = async () => {
      try {
        await ensureAudioMode();

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false, progressUpdateIntervalMillis: 250 },
          (status) => {
            if (cancelled || !mountedRef.current) return;
            if (!status.isLoaded) return;
            if (!isSeeking.current) {
              setPositionSec((status.positionMillis || 0) / 1000);
            }
            if (status.durationMillis) {
              setTotalSec(status.durationMillis / 1000);
            }
            if (status.didJustFinish) {
              // Keep the Sound loaded — seek to start so next tap is instant
              setIsPlaying(false);
              setPositionSec(0);
              sound.setPositionAsync(0).catch(() => {});
            }
          }
        );

        if (cancelled) {
          sound.unloadAsync().catch(() => {});
          return;
        }

        soundRef.current = sound;
        setLoadState('ready');
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[AudioPlayer] preload error:', e?.message || e);
        if (
          String(e?.message).includes('format') ||
          String(e?.message).includes('supported')
        ) {
          setFormatError(true);
        }
        setLoadState('error');
      }
    };

    preload();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup web audio on unmount
  useEffect(() => {
    return () => {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
    };
  }, []);

  // Stop when parent signals
  useEffect(() => {
    if (shouldStop && isPlaying) {
      handlePauseStop(false);
    }
  }, [shouldStop]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePauseStop = async (andReset: boolean) => {
    setIsPlaying(false);
    if (Platform.OS === 'web') {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        if (andReset) webAudioRef.current.currentTime = 0;
      }
    } else {
      const sound = soundRef.current;
      if (sound) {
        await sound.pauseAsync().catch(() => {});
        if (andReset) await sound.setPositionAsync(0).catch(() => {});
      }
    }
    if (andReset) setPositionSec(0);
  };

  const handlePlay = async () => {
    if (formatError) return;
    onPlay?.(messageId);

    if (Platform.OS === 'web') {
      // Web: create HTML5 Audio element on first play, reuse after
      if (!webAudioRef.current) {
        const audio = new window.Audio(uri);
        webAudioRef.current = audio;
        audio.ontimeupdate = () => {
          if (!isSeeking.current) setPositionSec(audio.currentTime);
          setTotalSec(audio.duration || duration || 0);
        };
        audio.onended = () => {
          setIsPlaying(false);
          setPositionSec(0);
        };
        audio.onerror = () => setIsPlaying(false);
      }
      await webAudioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
      return;
    }

    // Native — sound should already be pre-loaded from useEffect
    const sound = soundRef.current;
    if (!sound) {
      // Fallback: pre-load didn't finish yet — shouldn't happen since button
      // is disabled while loadState === 'loading', but guard defensively
      return;
    }

    try {
      const status = await sound.getStatusAsync().catch(() => ({ isLoaded: false }));
      if (!status.isLoaded) {
        // Sound got invalidated (e.g. app backgrounded) — reload it
        setLoadState('loading');
        await sound.unloadAsync().catch(() => {});
        soundRef.current = null;
        const { sound: freshSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, progressUpdateIntervalMillis: 250 },
          (s) => {
            if (!mountedRef.current) return;
            if (!s.isLoaded) return;
            if (!isSeeking.current) setPositionSec((s.positionMillis || 0) / 1000);
            if (s.durationMillis) setTotalSec(s.durationMillis / 1000);
            if (s.didJustFinish) {
              setIsPlaying(false);
              setPositionSec(0);
              freshSound.setPositionAsync(0).catch(() => {});
            }
          }
        );
        soundRef.current = freshSound;
        setLoadState('ready');
        setIsPlaying(true);
        return;
      }

      // Already loaded → instant play
      await sound.playAsync();
      setIsPlaying(true);
    } catch (e: any) {
      console.warn('[AudioPlayer] play error:', e?.message || e);
      if (
        e?.code === 'EXAV' ||
        String(e?.message).includes('format') ||
        String(e?.message).includes('supported')
      ) {
        setFormatError(true);
      }
      setIsPlaying(false);
    }
  };

  const togglePlayback = async () => {
    if (loadState === 'loading') return; // still buffering
    if (isPlaying) {
      await handlePauseStop(false);
    } else {
      await handlePlay();
    }
  };

  const seekToFraction = async (fraction: number) => {
    const total = totalSec > 0 ? totalSec : duration || 0;
    const target = Math.max(0, Math.min(1, fraction)) * total;
    setPositionSec(target);
    if (Platform.OS === 'web' && webAudioRef.current) {
      webAudioRef.current.currentTime = target;
    } else {
      const sound = soundRef.current;
      if (sound) {
        const status = await sound.getStatusAsync().catch(() => null);
        if (status?.isLoaded) {
          await sound.setPositionAsync(target * 1000).catch(() => {});
        }
      }
    }
  };

  // PanResponder: waveWidthRef (stable) avoids stale closure in callbacks
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => waveWidthRef.current > 0,
      onMoveShouldSetPanResponder: () => waveWidthRef.current > 0,
      onPanResponderGrant: (evt) => {
        isSeeking.current = true;
        seekToFraction(evt.nativeEvent.locationX / waveWidthRef.current);
      },
      onPanResponderMove: (evt) => {
        seekToFraction(evt.nativeEvent.locationX / waveWidthRef.current);
      },
      onPanResponderRelease: () => {
        isSeeking.current = false;
      },
    })
  ).current;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const iconColor = isOwn ? '#1F2937' : '#FFFFFF';
  const playedColor = isOwn ? '#1F2937' : '#FFFFFF';
  const unplayedColor = isOwn ? 'rgba(31,41,55,0.3)' : 'rgba(255,255,255,0.35)';
  const timeColor = isOwn ? 'rgba(31,41,55,0.7)' : 'rgba(255,255,255,0.8)';
  const spinnerColor = isOwn ? '#1F2937' : '#FFFFFF';

  const effectiveTotal = totalSec > 0 ? totalSec : duration || 1;

  if (formatError) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={14} color={isOwn ? '#6B7280' : 'rgba(255,255,255,0.7)'} />
        <Text style={[styles.errorText, { color: isOwn ? '#6B7280' : 'rgba(255,255,255,0.7)' }]}>
          Audio not supported on this device
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Play/Pause button — shows spinner while pre-loading */}
      <TouchableOpacity
        style={styles.playBtn}
        onPress={togglePlayback}
        activeOpacity={loadState === 'loading' ? 1 : 0.7}
        disabled={loadState === 'loading'}
      >
        {loadState === 'loading' ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : isPlaying ? (
          <Pause size={18} color={iconColor} fill={iconColor} />
        ) : (
          <Play size={18} color={iconColor} fill={iconColor} />
        )}
      </TouchableOpacity>

      {/* Waveform bars with progress fill */}
      <View
        style={styles.waveformContainer}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          waveWidthRef.current = w;
        }}
        {...panResponder.panHandlers}
      >
        {WAVEFORM.map((amp, i) => {
          const played = i / BAR_COUNT < progress;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: Math.max(3, amp * 28),
                  backgroundColor: played ? playedColor : unplayedColor,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Timestamp */}
      <Text style={[styles.time, { color: timeColor }]}>
        {isPlaying || positionSec > 0
          ? formatTime(positionSec)
          : formatTime(effectiveTotal)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingVertical: 4,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  time: {
    fontSize: 12,
    fontWeight: '500' as const,
    minWidth: 36,
    textAlign: 'right',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 180,
    paddingVertical: 4,
  },
  errorText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
