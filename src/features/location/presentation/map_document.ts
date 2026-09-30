import { DAVAO_DEL_NORTE_BOUNDS, DAVAO_DEL_NORTE_GEOMETRY, isInsideDavaoDelNorte } from '../domain/davao_del_norte_geofence';
import { DEFAULT_MAP_CENTER, type Coordinate } from '../domain/location';
import { LEAFLET_CSS, LEAFLET_JS } from './vendor/leaflet_assets';

const pin = '<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg"><path d="M18 42C14 36 3 25 3 17a15 15 0 1 1 30 0c0 8-11 19-15 25Z" fill="#12372a" stroke="white" stroke-width="2"/><circle cx="18" cy="17" r="5" fill="white"/></svg>';
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function createMapDocument(center: Coordinate, selected: Coordinate | null, editable: boolean) {
  const config = {
    center: isInsideDavaoDelNorte(center) ? center : DEFAULT_MAP_CENTER,
    selected: selected && isInsideDavaoDelNorte(selected) ? selected : null,
    editable, bounds: DAVAO_DEL_NORTE_BOUNDS, geometry: DAVAO_DEL_NORTE_GEOMETRY,
  };
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="color-scheme" content="light"><meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https://tile.openstreetmap.org data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>${LEAFLET_CSS}
html,body,#map{width:100%;height:100%;margin:0;overflow:hidden;background:#eaf5ed;color-scheme:light;font-family:system-ui,sans-serif}
.leaflet-container{background:#eaf5ed;touch-action:none}.leaflet-control-attribution{font-size:10px;background:#fffffff0;max-width:86%;line-height:14px}
.leaflet-control-zoom a{width:38px;height:38px;line-height:38px;color:#12372a;background:white}.leaflet-control-attribution a{color:#23583f}
.fixed-pin{position:absolute;z-index:600;left:50%;top:50%;transform:translate(-50%,-100%);pointer-events:none;filter:drop-shadow(0 2px 3px #0005)}
.place-pin{background:transparent;border:0;filter:drop-shadow(0 2px 3px #0005)}
.province{position:absolute;z-index:700;top:10px;left:10px;padding:6px 10px;border-radius:8px;background:#fffffff2;color:#12372a;font-size:12px;font-weight:700;pointer-events:none;box-shadow:0 1px 5px #0002}
.status{position:absolute;z-index:700;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 16px;border-radius:10px;max-width:70%;text-align:center;background:#ffffffed;color:#12372a;font-size:13px;line-height:19px;pointer-events:none;box-shadow:0 1px 6px #0002}.status[hidden]{display:none}
</style></head><body><div id="map" aria-label="Davao del Norte street map"></div>
<div class="province">Davao del Norte only</div><div id="status" class="status">Loading street map…</div>
${editable ? `<div class="fixed-pin">${pin}</div>` : ''}
<script>${LEAFLET_JS}</script><script>
(function(){
  var config=${safeJson(config)}, pin=${safeJson(pin)}, map, marker, userGesture=false, pointerGesture=false;
  function send(type,extra){var data=JSON.stringify(Object.assign({channel:'animarket-map',type:type},extra||{}));if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(data);else if(window.parent!==window)window.parent.postMessage(data,'*');}
  function fail(){document.getElementById('status').hidden=false;document.getElementById('status').textContent='Street map could not load. Check your connection and retry.';send('error');}
  window.addEventListener('error',fail);
  try{
    var bounds=L.latLngBounds([config.bounds.south,config.bounds.west],[config.bounds.north,config.bounds.east]);
    map=L.map('map',{center:[config.center.latitude,config.center.longitude],zoom:15,minZoom:9,maxZoom:19,maxBounds:bounds,maxBoundsViscosity:1,zoomControl:false,attributionControl:true});
    L.control.zoom({position:'topright'}).addTo(map);
    var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{minZoom:9,maxZoom:19,maxNativeZoom:19,noWrap:true,bounds:bounds,keepBuffer:1,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'});
    var loaded=0,failed=0,loadTimer;
    tiles.on('loading',function(){loaded=0;failed=0;});
    tiles.on('tileload',function(){loaded++;clearTimeout(loadTimer);document.getElementById('status').hidden=true;send('loaded');});
    tiles.on('tileerror',function(){failed++;});
    tiles.on('load',function(){if(!loaded&&failed)fail();});
    tiles.addTo(map);loadTimer=setTimeout(function(){if(!loaded)fail();},15000);
    var outside=[[[124,5],[127,5],[127,9],[124,9],[124,5]]];
    config.geometry.coordinates.forEach(function(polygon){outside.push(polygon[0]);});
    L.geoJSON({type:'Polygon',coordinates:outside},{interactive:false,style:{stroke:false,fillColor:'#edf2ee',fillOpacity:1,fillRule:'evenodd'}}).addTo(map);
    L.geoJSON(config.geometry,{interactive:false,style:{color:'#3c8060',weight:2,fill:false}}).addTo(map);
    map.attributionControl.setPrefix('<a href="https://www.geoboundaries.org/" target="_blank">geoBoundaries</a> · CC BY 3.0 IGO');
    function setMarker(point){if(config.editable)return;if(marker){marker.remove();marker=null;}if(point)marker=L.marker([point.latitude,point.longitude],{icon:L.divIcon({html:pin,className:'place-pin',iconSize:[36,44],iconAnchor:[18,44]})}).addTo(map);}
    function focus(point,selected){userGesture=false;pointerGesture=false;setMarker(selected);map.setView([point.latitude,point.longitude],map.getZoom(),{animate:false});map.invalidateSize();}
    window.AniMarketMap={focus:focus,setMarker:setMarker};setMarker(config.selected);
    window.addEventListener('message',function(event){if(event.source!==window.parent)return;try{var data=typeof event.data==='string'?JSON.parse(event.data):event.data;if(data.channel!=='animarket-map-control')return;if(data.type==='focus')focus(data.coordinate,data.selected);else if(data.type==='marker')setMarker(data.selected);}catch(error){}});
    map.on('movestart',function(){send('moving',{active:true});});
    map.on('dragstart',function(){userGesture=true;});
    map.on('zoomstart',function(){if(pointerGesture)userGesture=true;});
    map.on('moveend',function(){if(config.editable&&userGesture){var point=map.getCenter();send('select',{coordinate:{latitude:point.lat,longitude:point.lng}});}userGesture=false;pointerGesture=false;send('moving',{active:false});send('interaction',{active:false});});
    map.on('click',function(event){if(!config.editable)return;userGesture=false;pointerGesture=false;send('select',{coordinate:{latitude:event.latlng.lat,longitude:event.latlng.lng}});map.panTo(event.latlng,{animate:false});});
    document.getElementById('map').addEventListener('pointerdown',function(){pointerGesture=true;send('interaction',{active:true});},{passive:true});
    function release(){send('interaction',{active:false});}window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
    document.addEventListener('click',function(event){var anchor=event.target.closest&&event.target.closest('a[href]');if(!anchor||anchor.href.indexOf('https://')!==0)return;event.preventDefault();send('link',{url:anchor.href});});
    window.addEventListener('resize',function(){map.invalidateSize();});send('ready');
  }catch(error){fail();}
})();
</script></body></html>`;
}
