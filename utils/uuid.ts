import { randomUUID as expoRandomUUID } from 'expo-crypto';

/**
 * Cross-platform UUID v4 generator.
 * Uses expo-crypto which works on iOS, Android, and Web via Hermes.
 * Replaces bare `crypto.randomUUID()` which throws on React Native
 * because the global `crypto` object is not available in the Hermes runtime.
 */
export function generateUUID(): string {
  return expoRandomUUID();
}
