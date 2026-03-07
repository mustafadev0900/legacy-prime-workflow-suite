import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Mic, X, Send, Square } from 'lucide-react-native';
import { Audio } from 'expo-av';

type RecorderState = 'idle' | 'recording' | 'preview';

interface RecordingResult {
  uri: string | null;
  blob?: Blob;
  durationSec: number;
  mimeType: string;
}

interface Props {
  onSend: (result: RecordingResult) => void;
  onCancel: () => void;
  /** If true, skip the idle mic button and start recording immediately on mount */
  autoStart?: boolean;
}

export default function AudioRecorder({ onSend, onCancel, autoStart }: Props) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(20).fill(6));
  const [previewResult, setPreviewResult] = useState<RecordingResult | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotOpacity = useRef(new Animated.Value(1)).current;

  // Auto-start recording on mount if requested
  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Blinking dot animation while recording
  useEffect(() => {
    if (state === 'recording') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [state]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        audioChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;

        // Animate amplitude from stream
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            analyser.getByteFrequencyData(data);
            const avg = data.slice(0, 20).map((v) => Math.max(4, (v / 255) * 28));
            setAmplitudes([...avg]);
            requestAnimationFrame(tick);
          }
        };
        tick();
      } else {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') return;

        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

        const { recording } = await Audio.Recording.createAsync(
          {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
            android: { ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android },
            ios: {
              ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
              extension: '.m4a',
            },
            isMeteringEnabled: true,
          },
          (status) => {
            if (status.isRecording && status.metering !== undefined) {
              // metering is dBFS [-160..0]; map to bar heights 4..28
              const normalized = Math.max(0, (status.metering + 60) / 60);
              setAmplitudes((prev) => {
                const next = [...prev.slice(1), Math.max(4, normalized * 28)];
                return next;
              });
            }
          },
          200
        );
        recordingRef.current = recording;
      }

      setState('recording');
      startTimer();
    } catch (e) {
      console.error('[AudioRecorder] startRecording error:', e);
    }
  };

  const stopRecording = async (): Promise<RecordingResult | null> => {
    stopTimer();
    const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000);

    if (Platform.OS === 'web' && mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      return new Promise((resolve) => {
        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          mediaRecorderRef.current = null;
          resolve({ uri: null, blob, durationSec, mimeType: 'audio/webm' });
        };
        mr.stop();
      });
    } else if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      return { uri: uri ?? null, durationSec, mimeType: 'audio/m4a' };
    }

    return null;
  };

  const handleStop = async () => {
    const result = await stopRecording();
    if (result) {
      setPreviewResult(result);
      setState('preview');
      setElapsedSec(result.durationSec);
    }
  };

  const handleCancel = async () => {
    if (state === 'recording') {
      await stopRecording();
    }
    setState('idle');
    setPreviewResult(null);
    setElapsedSec(0);
    onCancel();
  };

  const handleSend = () => {
    if (previewResult) {
      onSend(previewResult);
      setState('idle');
      setPreviewResult(null);
      setElapsedSec(0);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (state === 'idle') {
    return (
      <TouchableOpacity style={styles.micButton} onPress={startRecording} activeOpacity={0.7}>
        <Mic size={20} color="#2563EB" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.recorderBar}>
      {/* Cancel */}
      <TouchableOpacity style={styles.actionBtn} onPress={handleCancel} activeOpacity={0.7}>
        <X size={22} color="#EF4444" />
      </TouchableOpacity>

      {/* Waveform / Status */}
      <View style={styles.centerArea}>
        {state === 'recording' && (
          <>
            <Animated.View style={[styles.recordingDot, { opacity: dotOpacity }]} />
            <View style={styles.waveformRow}>
              {amplitudes.map((h, i) => (
                <View key={i} style={[styles.bar, { height: h }]} />
              ))}
            </View>
          </>
        )}
        {state === 'preview' && (
          <View style={styles.waveformRow}>
            {amplitudes.map((h, i) => (
              <View key={i} style={[styles.bar, styles.barPreview, { height: h }]} />
            ))}
          </View>
        )}
        <Text style={styles.timer}>{formatTime(elapsedSec)}</Text>
      </View>

      {/* Stop (recording) or Send (preview) */}
      {state === 'recording' ? (
        <TouchableOpacity style={[styles.actionBtn, styles.stopBtn]} onPress={handleStop} activeOpacity={0.7}>
          <Square size={18} color="#FFFFFF" fill="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.actionBtn, styles.sendBtn]} onPress={handleSend} activeOpacity={0.7}>
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  micButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recorderBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 8,
    gap: 8,
    minHeight: 48,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    backgroundColor: '#EF4444',
  },
  sendBtn: {
    backgroundColor: '#2563EB',
  },
  centerArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  waveformRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
  },
  bar: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 2,
    minHeight: 4,
  },
  barPreview: {
    backgroundColor: '#9CA3AF',
  },
  timer: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
    minWidth: 36,
  },
});
