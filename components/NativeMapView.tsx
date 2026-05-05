// TypeScript type reference only — Metro resolves to .native.tsx or .web.tsx at bundle time.
import React from 'react';

interface LocationPoint {
  label: string;
  time: string;
  address: string;
  lat: number;
  lng: number;
  color: string;
}

interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface NativeMapViewProps {
  initialRegion: MapRegion;
  points: LocationPoint[];
}

export default function NativeMapView(_: NativeMapViewProps) {
  return null;
}
