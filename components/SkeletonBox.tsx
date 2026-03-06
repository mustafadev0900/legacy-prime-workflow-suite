import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface SkeletonBoxProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

export default function SkeletonBox({ width: w, height: h, borderRadius = 8, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: false }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: w ?? '100%',
          height: h,
          borderRadius,
          backgroundColor: '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
}
