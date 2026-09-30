import provinceBoundary from '../../../constants/davao_del_norte_boundary.json';
import type { Coordinate } from './location';

export const DAVAO_DEL_NORTE_GEOMETRY = provinceBoundary;
const vertices = provinceBoundary.coordinates.flat(2);
export const DAVAO_DEL_NORTE_BOUNDS = {
  west: Math.min(...vertices.map((point) => point[0])), south: Math.min(...vertices.map((point) => point[1])),
  east: Math.max(...vertices.map((point) => point[0])), north: Math.max(...vertices.map((point) => point[1])),
};

function inRing(point: Coordinate, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    const cross = (point.longitude - x1) * (y2 - y1) - (point.latitude - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-10 && point.longitude >= Math.min(x1, x2) - 1e-10 && point.longitude <= Math.max(x1, x2) + 1e-10 && point.latitude >= Math.min(y1, y2) - 1e-10 && point.latitude <= Math.max(y1, y2) + 1e-10) return true;
    if ((y1 > point.latitude) !== (y2 > point.latitude) && point.longitude < (x2 - x1) * (point.latitude - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

export function isInsideDavaoDelNorte(point: Coordinate) {
  if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude)) return false;
  const bounds = DAVAO_DEL_NORTE_BOUNDS;
  if (point.longitude < bounds.west || point.longitude > bounds.east || point.latitude < bounds.south || point.latitude > bounds.north) return false;
  return provinceBoundary.coordinates.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole)));
}
