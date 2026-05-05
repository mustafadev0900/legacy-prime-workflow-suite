import React, { useEffect, useRef, useMemo } from 'react';
import { buildMapHtml, type LocationPoint, type MapRegion } from './mapHtml';

interface Props {
  points: LocationPoint[];
  focus?: LocationPoint;
  region: MapRegion;
}

function clearEl(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export default function WebMapFallback({ points, focus, region }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const html = useMemo(
    () => buildMapHtml(points, focus, region),
    [points, focus, region],
  );

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

    return () => {
      clearEl(el);
    };
  }, [html]);

  return (
    <div
      ref={divRef}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}
