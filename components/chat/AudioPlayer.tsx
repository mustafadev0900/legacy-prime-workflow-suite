import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';

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

export default function AudioPlayer({ uri, duration, messageId, isOwn, onPlay, shouldStop }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [totalSec, setTotalSec] = useState(duration || 0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSeeking = useRef(false);

  // Stop when parent signals
  useEffect(() => {
    if (shouldStop && isPlaying) {
      handlePauseStop(false);
    }
  }, [shouldStop]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
    };
  }, []);

  const handlePauseStop = async (andReset: boolean) => {
    setIsPlaying(false);
    if (Platform.OS === 'web') {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        if (andReset) webAudioRef.current.currentTime = 0;
      }
    } else {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync().catch(() => null);
        if (status?.isLoaded) {
          await soundRef.current.pauseAsync().catch(() => {});
          if (andReset) await soundRef.current.setPositionAsync(0).catch(() => {});
        }
      }
    }
    if (andReset) setPositionSec(0);
  };

  const handlePlay = async () => {
    onPlay?.(messageId);

    if (Platform.OS === 'web') {
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
      await webAudioRef.current.play();
      setIsPlaying(true);
    } else {
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true, progressUpdateIntervalMillis: 200 },
            (status) => {
              if (!status.isLoaded) return;
              if (!isSeeking.current) setPositionSec((status.positionMillis || 0) / 1000);
              if (status.durationMillis) setTotalSec(status.durationMillis / 1000);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionSec(0);
                sound.unloadAsync().catch(() => {});
                soundRef.current = null;
              }
            }
          );
          soundRef.current = sound;
        } else {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await soundRef.current.playAsync();
          } else {
            soundRef.current = null;
            return handlePlay();
          }
        }
        setIsPlaying(true);
      } catch (e) {
        console.error('[AudioPlayer] play error:', e);
        setIsPlaying(false);
      }
    }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      await handlePauseStop(false);
    } else {
      await handlePlay();
    }
  };

  const handleSeek = async (value: number) => {
    isSeeking.current = false;
    setPositionSec(value);
    if (Platform.OS === 'web' && webAudioRef.current) {
      webAudioRef.current.currentTime = value;
    } else if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync().catch(() => null);
      if (status?.isLoaded) {
        await soundRef.current.setPositionAsync(value * 1000).catch(() => {});
      }
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const iconColor = isOwn ? '#1F2937' : '#FFFFFF';
  const sliderThumb = isOwn ? '#1F2937' : '#FFFFFF';
  const sliderMin = isOwn ? '#1F2937' : '#FFFFFF';
  const sliderMax = isOwn ? 'rgba(31,41,55,0.3)' : 'rgba(255,255,255,0.4)';
  const timeColor = isOwn ? 'rgba(31,41,55,0.7)' : 'rgba(255,255,255,0.8)';

  const effectiveTotal = totalSec > 0 ? totalSec : duration || 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playBtn} onPress={togglePlayback} activeOpacity={0.7}>
        {isPlaying
          ? <Pause size={18} color={iconColor} fill={iconColor} />
          : <Play size={18} color={iconColor} fill={iconColor} />
        }
      </TouchableOpacity>

      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={effectiveTotal}
          value={positionSec}
          onSlidingStart={() => { isSeeking.current = true; }}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor={sliderMin}
          maximumTrackTintColor={sliderMax}
          thumbTintColor={sliderThumb}
        />
      </View>

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
  sliderContainer: {
    flex: 1,
  },
  slider: {
    height: 30,
  },
  time: {
    fontSize: 12,
    fontWeight: '500' as const,
    minWidth: 36,
    textAlign: 'right',
  },
});
