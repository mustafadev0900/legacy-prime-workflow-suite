export interface LocationPoint {
  label: string;
  time: string;
  address: string;
  lat: number;
  lng: number;
  color: string;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function eventIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('clock in'))  return 'I';
  if (l.includes('clock out')) return 'O';
  if (l.includes('lunch out')) return '↑';
  if (l.includes('lunch in'))  return '↓';
  return label.charAt(0).toUpperCase();
}

export function buildMapHtml(
  points: LocationPoint[],
  focus: LocationPoint | undefined,
  region: MapRegion,
): string {
  const centerLat = focus?.lat ?? region.latitude;
  const centerLng = focus?.lng ?? region.longitude;
  const zoom = Math.max(
    10,
    Math.min(17, Math.round(14 - Math.log2(Math.max(region.latitudeDelta, 0.005) * 111))),
  );

  const markersJs = points
    .map((p, idx) => {
      const icon    = eventIcon(p.label);
      const isFocus = focus && focus.lat === p.lat && focus.lng === p.lng;

      const markerHtml = `
<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
  <div style="width:${isFocus ? 40 : 34}px;height:${isFocus ? 40 : 34}px;
    border-radius:50%;background:${esc(p.color)};
    border:${isFocus ? 3 : 2.5}px solid #fff;
    box-shadow:0 ${isFocus ? 4 : 2}px ${isFocus ? 12 : 8}px rgba(0,0,0,${isFocus ? '0.45' : '0.35'});
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-size:${isFocus ? 15 : 13}px;font-weight:800;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${esc(icon)}</div>
  <div style="width:0;height:0;border-left:7px solid transparent;
    border-right:7px solid transparent;border-top:9px solid ${esc(p.color)};
    filter:drop-shadow(0 2px 1px rgba(0,0,0,0.2));margin-top:-1px;"></div>
  <div style="background:rgba(15,23,42,0.8);color:#fff;font-size:9px;font-weight:700;
    padding:2px 6px;border-radius:20px;margin-top:3px;white-space:nowrap;
    box-shadow:0 1px 3px rgba(0,0,0,0.25);
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${esc(p.label)}</div>
</div>`;

      const anchorY = isFocus ? 53 : 47;

      return `(function(){
  var icon=L.divIcon({className:'',html:${JSON.stringify(markerHtml)},
    iconSize:[90,${anchorY + 10}],iconAnchor:[45,${anchorY}],popupAnchor:[0,-${anchorY}]});
  L.marker([${p.lat},${p.lng}],{icon:icon,zIndexOffset:${isFocus ? 1000 : idx * 10}}).addTo(map)
    .bindPopup(
      '<div style="min-width:150px;">'
      +'<b style="font-size:12px;color:${esc(p.color)}">${esc(p.label)}</b>'
      +' <span style="color:#64748B;font-size:11px">${esc(p.time)}</span><br/>'
      +'<small style="color:#6B7280">${esc(p.address)}</small>'
      +'</div>',
      {maxWidth:220}
    )${isFocus ? '.openPopup()' : ''};
})();`;
    })
    .join('\n');

  const coordsArr = points.map(p => `[${p.lat},${p.lng}]`).join(',');
  const polylineJs = points.length > 1
    ? `L.polyline([${coordsArr}],{color:'#94A3B8',weight:2,dashArray:'5,6',opacity:0.6}).addTo(map);`
    : '';

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body,#map{width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
  .leaflet-popup-content-wrapper{border-radius:10px;font-size:12px;box-shadow:0 4px 16px rgba(0,0,0,.15)}
  .leaflet-popup-content{margin:10px 14px}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,scrollWheelZoom:true})
         .setView([${centerLat},${centerLng}],${zoom});
L.control.zoom({position:'topright'}).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom:19
}).addTo(map);
${polylineJs}
${markersJs}
setTimeout(function(){map.invalidateSize();},150);
</script>
</body></html>`;
}
