import { isCoordinate, type Coordinate } from '../domain/location';

export type LocationMapProps = {
  center: Coordinate; selected: Coordinate | null; height?: number;
  onChange?: (coordinate: Coordinate) => void; onMovingChange?: (moving: boolean) => void;
  onInteractionChange?: (interacting: boolean) => void; onError?: () => void; onLoaded?: () => void; onOutside?: () => void;
};
export type MapEvent =
  | { type: 'ready' | 'loaded' | 'error' }
  | { type: 'moving' | 'interaction'; active: boolean }
  | { type: 'select'; coordinate: Coordinate }
  | { type: 'link'; url: string };

export function decodeMapEvent(raw: unknown): MapEvent | null {
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.channel !== 'animarket-map') return null;
    if (['ready', 'loaded', 'error'].includes(data.type)) return { type: data.type };
    if (['moving', 'interaction'].includes(data.type) && typeof data.active === 'boolean') return { type: data.type, active: data.active };
    if (data.type === 'select' && isCoordinate(data.coordinate)) return { type: data.type, coordinate: data.coordinate };
    if (data.type === 'link' && typeof data.url === 'string' && /^https:\/\/(www\.openstreetmap\.org\/copyright|www\.geoboundaries\.org\/|creativecommons\.org\/licenses\/)/.test(data.url)) return { type: 'link', url: data.url };
  } catch { /* Ignore unrelated or malformed messages. */ }
  return null;
}
