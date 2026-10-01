import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { isInsideDavaoDelNorte } from '../domain/davao_del_norte_geofence';
import { DEFAULT_MAP_CENTER } from '../domain/location';
import { createMapDocument } from './map_document';
import { decodeMapEvent, type LocationMapProps } from './map_types';

export function LocationMap(props: LocationMapProps) {
  const { center, selected, height = 300 } = props;
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  const lastValid = useRef(isInsideDavaoDelNorte(center) ? center : DEFAULT_MAP_CENTER);
  const [html] = useState(() => createMapDocument(center, selected, !!props.onChange));
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    const send = (type: string, coordinate = lastValid.current) => frame.current?.contentWindow?.postMessage(JSON.stringify({ channel: 'animarket-map-control', type, coordinate, selected: latest.current.selected }), '*');
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = decodeMapEvent(event.data);
      if (!message) return;
      const current = latest.current;
      if (message.type === 'ready') { ready.current = true; send('focus'); }
      else if (message.type === 'loaded') current.onLoaded?.();
      else if (message.type === 'error') current.onError?.();
      else if (message.type === 'moving') current.onMovingChange?.(message.active);
      else if (message.type === 'interaction') current.onInteractionChange?.(message.active);
      else if (message.type === 'link') Linking.openURL(message.url).catch(() => {});
      else if (message.type === 'select' && current.onChange) {
        if (isInsideDavaoDelNorte(message.coordinate)) { lastValid.current = message.coordinate; current.onChange(message.coordinate); }
        else { current.onOutside?.(); send('focus'); }
      }
    };
    window.addEventListener('message', receive);
    const timer = setTimeout(() => { if (!ready.current) latest.current.onError?.(); }, 20000);
    return () => { window.removeEventListener('message', receive); clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const point = isInsideDavaoDelNorte(center) ? center : DEFAULT_MAP_CENTER;
    lastValid.current = point;
    if (ready.current) frame.current?.contentWindow?.postMessage(JSON.stringify({ channel: 'animarket-map-control', type: 'focus', coordinate: point, selected: latest.current.selected }), '*');
  }, [center]);
  useEffect(() => {
    if (ready.current && !latest.current.onChange) frame.current?.contentWindow?.postMessage(JSON.stringify({ channel: 'animarket-map-control', type: 'marker', selected }), '*');
  }, [selected]);
  return <View style={{ width: '100%', height, backgroundColor: '#eaf5ed' }}>
    <iframe ref={frame} srcDoc={html} title="Davao del Norte street map" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin" onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ channel: 'animarket-map-control', type: 'ping' }), '*')} style={{ display: 'block', width: '100%', height, border: 0, background: '#eaf5ed' }} />
  </View>;
}
