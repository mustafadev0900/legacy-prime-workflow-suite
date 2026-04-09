import React, { useRef } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import { ZoomLevel } from '@/types';

interface TimelineHeaderProps {
  dates: Date[];
  cellWidth: number;
  height: number;
  zoomLevel: ZoomLevel;
  fontSize: number;
  onColumnResizeStart?: () => void;
  onColumnResizeDelta?: (delta: number) => void;
  onColumnResizeEnd?: () => void;
}

/**
 * Timeline header showing date labels
 */
export default function TimelineHeader({
  dates,
  cellWidth,
  height,
  zoomLevel,
  fontSize,
  onColumnResizeStart,
  onColumnResizeDelta,
  onColumnResizeEnd,
}: TimelineHeaderProps) {
  const dragRef = useRef<{ startX: number } | null>(null);

  const handleResizeTouchStart = (e: GestureResponderEvent) => {
    dragRef.current = { startX: e.nativeEvent.pageX };
    onColumnResizeStart?.();
  };

  const handleResizeTouchMove = (e: GestureResponderEvent) => {
    if (!dragRef.current || !onColumnResizeDelta) return;
    const delta = e.nativeEvent.pageX - dragRef.current.startX;
    dragRef.current.startX = e.nativeEvent.pageX;
    onColumnResizeDelta(delta);
  };

  const handleResizeTouchEnd = () => {
    dragRef.current = null;
    onColumnResizeEnd?.();
  };

  const formatDate = (date: Date, level: ZoomLevel): string => {
    switch (level) {
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.getDate()}`;
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      {dates.map((date, index) => (
        <View
          key={index}
          style={[styles.cell, { width: cellWidth }]}
        >
          <Text style={[styles.dateText, { fontSize }]} numberOfLines={1}>
            {formatDate(date, zoomLevel)}
          </Text>
          {onColumnResizeDelta && (
            <View
              style={styles.columnResizeHandle}
              onTouchStart={handleResizeTouchStart}
              onTouchMove={handleResizeTouchMove}
              onTouchEnd={handleResizeTouchEnd}
            >
              <View style={styles.columnResizeIndicator} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  dateText: {
    fontWeight: '600',
    color: '#374151',
  },
  columnResizeHandle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    cursor: 'col-resize',
  },
  columnResizeIndicator: {
    width: 3,
    height: 16,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
});
