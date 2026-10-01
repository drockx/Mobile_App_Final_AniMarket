import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { isInsideDavaoDelNorte } from '../domain/davao_del_norte_geofence';
import { DEFAULT_MAP_CENTER, type Coordinate } from '../domain/location';
import { createMapDocument } from './map_document';
import { decodeMapEvent, type LocationMapProps } from './map_types';

export function LocationMap(props: LocationMapProps) {
  const { center, selected, height = 300 } = props;
  const webview = useRef<WebView>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  const lastValid = useRef<Coordinate>(isInsideDavaoDelNorte(center) ? center : DEFAULT_MAP_CENTER);
  const [html] = useState(() => createMapDocument(center, selected, !!props.onChange));
  const source = useMemo(() => ({ html }), [html]);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    const point = isInsideDavaoDelNorte(center) ? center : DEFAULT_MAP_CENTER;
    lastValid.current = point;
    if (ready.current) webview.current?.injectJavaScript('window.AniMarketMap.focus(' + JSON.stringify(point) + ',' + JSON.stringify(latest.current.selected) + ');true;');
  }, [center]);
  useEffect(() => {
    if (ready.current && !latest.current.onChange) webview.current?.injectJavaScript('window.AniMarketMap.setMarker(' + JSON.stringify(selected) + ');true;');
  }, [selected]);
  useEffect(() => {
    const timer = setTimeout(() => { if (!ready.current) latest.current.onError?.(); }, 20000);
    return () => clearTimeout(timer);
  }, []);

  function receive(raw: string) {
    const message = decodeMapEvent(raw);
    if (!message) return;
    const current = latest.current;
    if (message.type === 'ready') {
      ready.current = true;
      webview.current?.injectJavaScript('window.AniMarketMap.focus(' + JSON.stringify(lastValid.current) + ',' + JSON.stringify(current.selected) + ');true;');
    } else if (message.type === 'loaded') current.onLoaded?.();
    else if (message.type === 'error') current.onError?.();
    else if (message.type === 'moving') current.onMovingChange?.(message.active);
    else if (message.type === 'interaction') current.onInteractionChange?.(message.active);
    else if (message.type === 'link') Linking.openURL(message.url).catch(() => {});
    else if (message.type === 'select' && current.onChange) {
      if (isInsideDavaoDelNorte(message.coordinate)) { lastValid.current = message.coordinate; current.onChange(message.coordinate); }
      else {
        current.onOutside?.();
        webview.current?.injectJavaScript('window.AniMarketMap.focus(' + JSON.stringify(lastValid.current) + ',null);true;');
      }
    }
  }
  return <View style={[styles.container, { height }]} onTouchStart={() => props.onInteractionChange?.(true)} onTouchEnd={() => props.onInteractionChange?.(false)} onTouchCancel={() => props.onInteractionChange?.(false)}>
    <WebView ref={webview} source={source} originWhitelist={['*']} javaScriptEnabled cacheEnabled forceDarkOn={false} applicationNameForUserAgent="AniMarket/1.0" geolocationEnabled={false} scrollEnabled={false} nestedScrollEnabled overScrollMode="never" style={styles.webview}
      accessibilityLabel="Davao del Norte street map"
      onMessage={(event) => receive(event.nativeEvent.data)}
      onError={() => props.onError?.()} onHttpError={() => props.onError?.()}
      onShouldStartLoadWithRequest={(request) => !request.url || request.url === 'about:blank'}
    />
  </View>;
}
const styles = StyleSheet.create({ container: { width: '100%', backgroundColor: '#eaf5ed' }, webview: { flex: 1, backgroundColor: '#eaf5ed' } });
