import { useRouter } from 'expo-router';

const THROTTLE_MS = 500;
// Module-level singleton — shared across ALL components so the cooldown is global
let lastNavTime = 0;

/**
 * Drop-in replacement for useRouter() that throttles all navigation calls to
 * prevent duplicate screen pushes from rapid double-taps.
 */
export function useSafeRouter() {
  const router = useRouter();

  return {
    ...router,
    push: (...args: Parameters<typeof router.push>): void => {
      const now = Date.now();
      if (now - lastNavTime < THROTTLE_MS) return;
      lastNavTime = now;
      router.push(...args);
    },
    replace: (...args: Parameters<typeof router.replace>): void => {
      const now = Date.now();
      if (now - lastNavTime < THROTTLE_MS) return;
      lastNavTime = now;
      router.replace(...args);
    },
    back: (): void => {
      const now = Date.now();
      if (now - lastNavTime < THROTTLE_MS) return;
      lastNavTime = now;
      router.back();
    },
    navigate: (...args: Parameters<typeof router.navigate>): void => {
      const now = Date.now();
      if (now - lastNavTime < THROTTLE_MS) return;
      lastNavTime = now;
      router.navigate(...args);
    },
    dismiss: (...args: Parameters<typeof router.dismiss>): void => {
      const now = Date.now();
      if (now - lastNavTime < THROTTLE_MS) return;
      lastNavTime = now;
      router.dismiss(...args);
    },
  };
}
