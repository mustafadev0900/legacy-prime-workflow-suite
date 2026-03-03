/**
 * DocumentScannerModal
 *
 * Document-scanner UX using the system camera (ImagePicker) to avoid
 * AVCaptureSession initialization crashes present in expo-camera's CameraView
 * when FigCaptureSourceRemote fails with -17281 on certain devices/OS states.
 *
 * Flow:
 *   Ready screen (decorative frame guide + shutter)
 *   → launchCameraAsync (system camera — stable, no AVFoundation race)
 *   → Review screen ("Retake" or "Use Scan")
 *   → Post-process via expo-image-manipulator (resize 2048px, JPEG 0.92, base64)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { X, RotateCcw, Check, ScanLine } from 'lucide-react-native';

export interface DocumentScanResult {
  /** local file:// URI of the processed scan */
  uri: string;
  /** raw base64 string (no data: prefix) — ready for OCR / AI analysis */
  base64: string;
}

interface Props {
  visible: boolean;
  onCapture: (result: DocumentScanResult) => void;
  onClose: () => void;
  title?: string;
}

type Phase = 'ready' | 'preview' | 'processing';

const { width: SW, height: SH } = Dimensions.get('window');
const FRAME_W = SW * 0.82;
const FRAME_H = FRAME_W * 1.35; // Portrait receipt ratio
const FRAME_TOP = (SH - FRAME_H) / 2 - 40;
const CORNER = 22;
const CORNER_THICK = 3;

export default function DocumentScannerModal({
  visible,
  onCapture,
  onClose,
  title = 'Scan Receipt',
}: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  // Reset state every time the modal opens
  useEffect(() => {
    if (visible) {
      setPhase('ready');
      setCapturedUri(null);
    }
  }, [visible]);

  const handleCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required to scan receipts. Please allow it in Settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedUri(result.assets[0].uri);
        setPhase('preview');
      }
    } catch (e) {
      console.error('[DocScanner] Camera error:', e);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleUse = async () => {
    if (!capturedUri) return;
    setPhase('processing');
    try {
      // Resize to 2048px wide — manageable size with good OCR accuracy
      const processed = await ImageManipulator.manipulateAsync(
        capturedUri,
        [{ resize: { width: 2048 } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      onCapture({ uri: processed.uri, base64: processed.base64 ?? '' });
    } catch (e) {
      console.error('[DocScanner] Processing error:', e);
      // Fall back to original URI; let caller handle conversion
      onCapture({ uri: capturedUri, base64: '' });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.container}>

        {/* ── Preview phase ──────────────────────────────── */}
        {phase === 'preview' && capturedUri ? (
          <>
            <View style={styles.previewHeader}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { setCapturedUri(null); setPhase('ready'); }}>
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Review Scan</Text>
              <View style={styles.iconBtn} />
            </View>
            <Image
              source={{ uri: capturedUri }}
              style={styles.previewImage}
              contentFit="contain"
            />
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => { setCapturedUri(null); setPhase('ready'); }}
              >
                <RotateCcw size={18} color="#1F2937" />
                <Text style={styles.retakeTxt}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.useBtn} onPress={handleUse}>
                <Check size={18} color="#FFFFFF" />
                <Text style={styles.useTxt}>Use Scan</Text>
              </TouchableOpacity>
            </View>
          </>

        ) : phase === 'processing' ? (
          /* ── Processing ───────────────────────────────── */
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.processingTxt}>Processing scan…</Text>
          </View>

        ) : (
          /* ── Ready / viewfinder ────────────────────────── */
          <>
            {/* Header */}
            <View style={styles.scannerHeader}>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{title}</Text>
              {/* Spacer to keep title centred */}
              <View style={styles.iconBtn} />
            </View>

            {/* Decorative viewfinder — visual guide for receipt alignment */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Top band */}
              <View style={[styles.overlayBand, { height: FRAME_TOP }]} />

              {/* Middle row: side | frame | side */}
              <View style={styles.overlayMiddle}>
                <View style={[styles.overlayBand, { width: (SW - FRAME_W) / 2, height: FRAME_H }]} />

                {/* Transparent document frame with corner brackets */}
                <View style={[styles.docFrame, { width: FRAME_W, height: FRAME_H }]}>
                  <View style={[styles.corner, styles.cTL]} />
                  <View style={[styles.corner, styles.cTR]} />
                  <View style={[styles.corner, styles.cBL]} />
                  <View style={[styles.corner, styles.cBR]} />
                </View>

                <View style={[styles.overlayBand, { width: (SW - FRAME_W) / 2, height: FRAME_H }]} />
              </View>

              {/* Bottom band + instructions */}
              <View style={[styles.overlayBand, styles.bottomBand]}>
                <ScanLine size={20} color="rgba(255,255,255,0.7)" />
                <Text style={styles.hint}>Tap the button to open camera</Text>
                <Text style={styles.hintSub}>Align receipt within the frame when prompted</Text>
              </View>
            </View>

            {/* Shutter button */}
            <View style={styles.shutterBar}>
              <TouchableOpacity
                style={styles.shutterOuter}
                onPress={handleCapture}
                activeOpacity={0.75}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    gap: 16,
    paddingHorizontal: 32,
  },

  // ── Scanner header ──────────────────────────────────
  scannerHeader: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  // ── Overlay bands ──────────────────────────────────
  overlayBand: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayMiddle: {
    flexDirection: 'row' as const,
  },
  bottomBand: {
    flex: 1,
    alignItems: 'center' as const,
    paddingTop: 16,
    gap: 6,
  },
  hint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500' as const,
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: 4,
  },
  hintSub: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.65,
    textAlign: 'center' as const,
    paddingHorizontal: 24,
  },

  // ── Document frame ─────────────────────────────────
  docFrame: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  corner: {
    position: 'absolute' as const,
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  cTL: { top: -1, left: -1, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK },
  cTR: { top: -1, right: -1, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK },
  cBL: { bottom: -1, left: -1, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK },
  cBR: { bottom: -1, right: -1, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK },

  // ── Shutter ────────────────────────────────────────
  shutterBar: {
    position: 'absolute' as const,
    bottom: Platform.OS === 'ios' ? 52 : 36,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
  },

  // ── Preview ────────────────────────────────────────
  previewHeader: {
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14,
    paddingHorizontal: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  previewImage: {
    flex: 1,
    backgroundColor: '#111',
  },
  previewActions: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    backgroundColor: '#000',
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
  },
  retakeTxt: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  useBtn: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
  },
  useTxt: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

  // ── Processing ─────────────────────────────────────
  processingTxt: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 4,
  },
});
