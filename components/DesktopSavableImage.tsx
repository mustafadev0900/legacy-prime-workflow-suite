import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Image, ImageProps } from 'expo-image';

// On web, expo-image renders a <div style="background-image: url(...)"> which
// browsers treat as a styled element — NOT an <img>. That's why the native
// "Save image as…" entry is missing from the right-click context menu and
// drag-to-desktop doesn't save the file.
//
// This component swaps to a native <img> on web (preserving right-click +
// drag-save in Chrome / Safari / Firefox) and falls through to expo-image
// on iOS / Android, where <img> doesn't exist and the expo-image features
// (blurhash, priority, transitions) matter.

interface Props extends ImageProps {
  alt?: string;
}

export function DesktopSavableImage(props: Props) {
  if (Platform.OS === 'web') {
    const { source, style, contentFit, alt } = props;
    const uri =
      typeof source === 'object' && source !== null && 'uri' in source
        ? (source as { uri?: string }).uri
        : typeof source === 'string'
          ? source
          : undefined;

    if (!uri) return null;

    const flatStyle = (StyleSheet.flatten(style as any) || {}) as React.CSSProperties;

    return React.createElement('img', {
      src: uri,
      alt: alt || '',
      draggable: true,
      style: {
        ...flatStyle,
        objectFit: (contentFit as any) || 'cover',
        display: 'block',
      },
    });
  }

  return <Image {...props} />;
}
