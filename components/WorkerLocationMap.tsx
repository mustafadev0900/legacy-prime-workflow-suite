// TypeScript base shim — Metro resolves .native.tsx / .web.tsx at bundle time.
// This file is only used by the TypeScript compiler for type resolution.
import React from 'react';

export interface WorkerPin {
  employeeId: string;
  employeeName: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  status: 'working' | 'on_break';
  updatedAt: string;
}

export interface WorkerLocationMapProps {
  workers: WorkerPin[];
  height?: number;
}

export default function WorkerLocationMap(_props: WorkerLocationMapProps): React.ReactElement | null {
  return null;
}
