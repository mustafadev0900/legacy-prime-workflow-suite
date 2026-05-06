import React, { useEffect, useRef, useMemo } from 'react';
import type { WorkerPin, WorkerLocationMapProps } from './WorkerLocationMap';
import { buildWorkerMapHtml } from './workerMapHtml';

function clearEl(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export default function WorkerLocationMap({ workers, height = 280 }: WorkerLocationMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const html   = useMemo(() => buildWorkerMapHtml(workers), [workers]);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const iframe = document.createElement('iframe');
    // srcdoc works on iOS Safari/WKWebView; blob: URLs are blocked there
    iframe.srcdoc = html;
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;border:none;display:block;';

    clearEl(el);
    el.appendChild(iframe);

    return () => { clearEl(el); };
  }, [html]);

  if (workers.length === 0) return null;

  return (
    <div
      ref={divRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB',
      }}
    />
  );
}
