import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildMapHtml, type LocationPoint, type MapRegion } from './mapHtml';

interface Props {
  initialRegion: MapRegion;
  points: LocationPoint[];
}

export default function NativeMapView({ initialRegion, points }: Props) {
  const html = useMemo(
    () => buildMapHtml(points, points[0], initialRegion),
    [points, initialRegion],
  );

  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No location data</Text>
      </View>
    );
  }

  return (
    <WebView
      style={StyleSheet.absoluteFill}
      source={{ html }}
      originWhitelist={['*']}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
