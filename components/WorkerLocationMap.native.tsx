import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildWorkerMapHtml } from './workerMapHtml';
import type { WorkerPin, WorkerLocationMapProps } from './WorkerLocationMap';

export default function WorkerLocationMap({ workers, height = 280 }: WorkerLocationMapProps) {
  const html = useMemo(() => buildWorkerMapHtml(workers), [workers]);

  if (workers.length === 0) return null;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        style={StyleSheet.absoluteFill}
        source={{ html }}
        originWhitelist={['*']}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
});
