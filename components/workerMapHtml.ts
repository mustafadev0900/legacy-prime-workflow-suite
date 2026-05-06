import type { WorkerPin } from './WorkerLocationMap';

const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function initialsColor(name: string): string {
  const palette = [
    '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0] || 'U').slice(0, 2).toUpperCase();
}

export function buildWorkerMapHtml(workers: WorkerPin[]): string {
  const markersJs = workers.map((w, idx) => {
    const statusColor = w.status === 'on_break' ? '#F59E0B' : '#10B981';
    const statusLabel = w.status === 'on_break' ? 'On Break' : 'Working';
    const nameEs  = esc(w.employeeName);
    const avatarEs = w.avatarUrl ? esc(w.avatarUrl) : '';
    const bg  = initialsColor(w.employeeName);
    const ini = initials(w.employeeName);

    const markerHtml = `
<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
  <div style="position:relative;width:48px;height:48px;">
    <div style="width:48px;height:48px;border-radius:50%;background:${bg};
      border:3px solid ${statusColor};box-shadow:0 3px 10px rgba(0,0,0,0.35);
      overflow:hidden;display:flex;align-items:center;justify-content:center;">
      ${avatarEs
        ? `<img src="${avatarEs}" style="width:100%;height:100%;object-fit:cover;"
             onerror="this.style.display='none';this.nextSibling.style.display='flex';"/>`
        : ''}
      <span style="display:${avatarEs ? 'none' : 'flex'};align-items:center;justify-content:center;
        width:100%;height:100%;color:#fff;font-size:14px;font-weight:700;
        font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${ini}</span>
    </div>
    <div style="position:absolute;bottom:1px;right:1px;width:13px;height:13px;
      background:${statusColor};border-radius:50%;border:2px solid #fff;
      box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
  </div>
  <div style="width:0;height:0;border-left:8px solid transparent;
    border-right:8px solid transparent;border-top:10px solid ${statusColor};
    filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));margin-top:-1px;"></div>
  <div style="background:rgba(15,23,42,0.85);color:#fff;font-size:10px;font-weight:700;
    padding:2px 7px;border-radius:20px;margin-top:3px;white-space:nowrap;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);max-width:90px;overflow:hidden;text-overflow:ellipsis;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${nameEs}</div>
</div>`;

    return `(function(){
  var icon=L.divIcon({className:'',html:${JSON.stringify(markerHtml)},
    iconSize:[100,80],iconAnchor:[50,58]});
  var m=L.marker([${w.latitude},${w.longitude}],{icon:icon,zIndexOffset:${idx * 10}}).addTo(map);
  m.bindPopup(
    '<div style="min-width:140px;">'
    +'<b style="font-size:13px;color:#0F172A">${nameEs}</b><br/>'
    +'<span style="color:${statusColor};font-weight:600;font-size:12px">${esc(statusLabel)}</span>'
    +'</div>',
    {maxWidth:200}
  );
  coords.push([${w.latitude},${w.longitude}]);
})();`;
  }).join('\n');

  const centerLat = workers.length > 0 ? workers[0].latitude : 37.7749;
  const centerLng = workers.length > 0 ? workers[0].longitude : -122.4194;

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
var map=L.map('map',{zoomControl:true,scrollWheelZoom:true})
  .setView([${centerLat},${centerLng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom:19
}).addTo(map);
var coords=[];
${markersJs}
if(coords.length===1){
  map.setView(coords[0],16);
}else if(coords.length>1){
  map.fitBounds(coords,{padding:[60,60]});
}
setTimeout(function(){map.invalidateSize();},150);
</script>
</body></html>`;
}
