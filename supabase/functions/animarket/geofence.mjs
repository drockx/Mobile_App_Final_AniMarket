import boundary from './boundary.json' with { type: 'json' };
function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i];
    const cross = (p.longitude - x1) * (y2 - y1) - (p.latitude - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-10 && p.longitude >= Math.min(x1, x2) - 1e-10 && p.longitude <= Math.max(x1, x2) + 1e-10 && p.latitude >= Math.min(y1, y2) - 1e-10 && p.latitude <= Math.max(y1, y2) + 1e-10) return true;
    if ((y1 > p.latitude) !== (y2 > p.latitude) && p.longitude < (x2 - x1) * (p.latitude - y1) / (y2 - y1) + x1) inside = !inside;
  } return inside;
}
export function inside(p) { return Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude) && boundary.coordinates.some((polygon) => inRing(p, polygon[0]) && !polygon.slice(1).some((ring) => inRing(p, ring))); }
