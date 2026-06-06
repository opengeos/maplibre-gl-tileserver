import { getGdal } from './gdal.js';
import { normalizeCrs } from './metadata.js';

function lngLatToMercator(lng: number, lat: number): [number, number] {
  const x = (lng * 20037508.34) / 180;
  const clampedLat = Math.max(Math.min(lat, 85.0511287798), -85.0511287798);
  const y = Math.log(Math.tan(((90 + clampedLat) * Math.PI) / 360)) * (20037508.34 / Math.PI);
  return [x, y];
}

function mercatorToLngLat(x: number, y: number): [number, number] {
  const lng = (x * 180) / 20037508.34;
  const lat = (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lng, lat];
}

function parseProjString(crs: string): Record<string, string> | null {
  if (!crs.trim().startsWith('+proj=')) return null;
  const params: Record<string, string> = {};
  for (const part of crs.trim().split(/\s+/)) {
    const [key, value = ''] = part.replace(/^\+/, '').split('=');
    if (key) params[key] = value;
  }
  return params;
}

type AlbersProjection = ReturnType<typeof albersConstants>;
type PointTransformer = (point: [number, number]) => [number, number] | null;

function albersConstants(params: Record<string, string>) {
  const toRad = Math.PI / 180;
  const a = Number(params.a ?? 6378137);
  const rf = Number(params.rf ?? 298.257223563);
  const f = rf === 0 ? 0 : 1 / rf;
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(Math.max(0, e2));
  const phi1 = Number(params.lat_1) * toRad;
  const phi2 = Number(params.lat_2) * toRad;
  const phi0 = Number(params.lat_0 ?? 0) * toRad;
  const lambda0 = Number(params.lon_0 ?? 0) * toRad;
  const x0 = Number(params.x_0 ?? 0);
  const y0 = Number(params.y_0 ?? 0);

  const m = (phi: number) => Math.cos(phi) / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const q = (phi: number) => {
    const sin = Math.sin(phi);
    if (e < 1e-12) return 2 * sin;
    return (
      (1 - e2) *
      (sin / (1 - e2 * sin ** 2) - (1 / (2 * e)) * Math.log((1 - e * sin) / (1 + e * sin)))
    );
  };

  const m1 = m(phi1);
  const q1 = q(phi1);
  const q2 = q(phi2);
  const n = Math.abs(phi1 - phi2) < 1e-12 ? Math.sin(phi1) : (m1 ** 2 - m(phi2) ** 2) / (q2 - q1);
  const c = m1 ** 2 + n * q1;
  const rho0 = (a * Math.sqrt(c - n * q(phi0))) / n;
  return { a, e2, n, c, rho0, lambda0, x0, y0, q };
}

function albersToLngLat(x: number, y: number, projection: AlbersProjection): [number, number] {
  const { a, n, c, rho0, lambda0, x0, y0, q } = projection;
  const dx = x - x0;
  const dy = rho0 - (y - y0);
  const rho = Math.sign(n) * Math.sqrt(dx * dx + dy * dy);
  const theta = Math.atan2(dx, dy);
  const targetQ = (c - ((rho * n) / a) ** 2) / n;
  let phi = Math.asin(Math.max(-1, Math.min(1, targetQ / 2)));
  for (let i = 0; i < 12; i++) {
    const delta = 1e-7;
    const f = q(phi) - targetQ;
    const derivative = (q(phi + delta) - q(phi - delta)) / (2 * delta);
    if (Math.abs(derivative) < 1e-12) break;
    phi -= f / derivative;
  }
  const lambda = lambda0 + theta / n;
  return [(lambda * 180) / Math.PI, (phi * 180) / Math.PI];
}

function lngLatToAlbers(lng: number, lat: number, projection: AlbersProjection): [number, number] {
  const { a, n, c, rho0, lambda0, x0, y0, q } = projection;
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const rho = (a * Math.sqrt(c - n * q(phi))) / n;
  const theta = n * (lambda - lambda0);
  return [x0 + rho * Math.sin(theta), y0 + rho0 - rho * Math.cos(theta)];
}

export function createPointTransformer(
  sourceCrs: string,
  targetCrs: string,
): PointTransformer | null {
  const from = normalizeCrs(sourceCrs);
  const to = normalizeCrs(targetCrs);
  if (from === to) return (point) => point;

  if (from === 'EPSG:4326' && to === 'EPSG:3857')
    return (point) => lngLatToMercator(point[0], point[1]);
  if (from === 'EPSG:3857' && to === 'EPSG:4326')
    return (point) => mercatorToLngLat(point[0], point[1]);

  const fromProj = parseProjString(from);
  const toProj = parseProjString(to);
  const fromAlbers = fromProj?.proj === 'aea' ? albersConstants(fromProj) : null;
  const toAlbers = toProj?.proj === 'aea' ? albersConstants(toProj) : null;

  if (fromAlbers && to === 'EPSG:4326') {
    return (point) => albersToLngLat(point[0], point[1], fromAlbers);
  }
  if (fromAlbers && to === 'EPSG:3857') {
    return (point) => {
      const lngLat = albersToLngLat(point[0], point[1], fromAlbers);
      return lngLatToMercator(lngLat[0], lngLat[1]);
    };
  }
  if (from === 'EPSG:4326' && toAlbers) {
    return (point) => lngLatToAlbers(point[0], point[1], toAlbers);
  }
  if (from === 'EPSG:3857' && toAlbers) {
    return (point) => {
      const lngLat = mercatorToLngLat(point[0], point[1]);
      return lngLatToAlbers(lngLat[0], lngLat[1], toAlbers);
    };
  }
  return null;
}

export function transformPointFallback(
  point: [number, number],
  sourceCrs: string,
  targetCrs: string,
): [number, number] | null {
  return createPointTransformer(sourceCrs, targetCrs)?.(point) ?? null;
}

export function transformBoundsFallback(
  bounds: [number, number, number, number],
  sourceCrs: string,
  targetCrs: string,
): [number, number, number, number] | null {
  const [xmin, ymin, xmax, ymax] = bounds;
  const points: Array<[number, number]> = [
    [xmin, ymin],
    [xmin, (ymin + ymax) / 2],
    [xmin, ymax],
    [(xmin + xmax) / 2, ymin],
    [(xmin + xmax) / 2, (ymin + ymax) / 2],
    [(xmin + xmax) / 2, ymax],
    [xmax, ymin],
    [xmax, (ymin + ymax) / 2],
    [xmax, ymax],
  ];
  const transformer = createPointTransformer(sourceCrs, targetCrs);
  if (!transformer) return null;
  const transformed = points
    .map((point) => transformer(point))
    .filter((point): point is [number, number] => Boolean(point));
  if (transformed.length === 0) return null;
  const xs = transformed.map((point) => point[0]);
  const ys = transformed.map((point) => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export async function transformBounds(
  bounds: [number, number, number, number],
  sourceCrs: string,
  targetCrs: string,
): Promise<[number, number, number, number]> {
  const from = normalizeCrs(sourceCrs);
  const to = normalizeCrs(targetCrs);
  if (from === to) return bounds;
  const fallback = transformBoundsFallback(bounds, from, to);
  if (fallback) return fallback;

  try {
    const gdal = await getGdal();
    const [xmin, ymin, xmax, ymax] = bounds;
    const corners = [
      [xmin, ymin],
      [xmin, ymax],
      [xmax, ymin],
      [xmax, ymax],
    ];
    const transformed = await gdal.gdaltransform(corners, [
      '-s_srs',
      from,
      '-t_srs',
      to,
      '-output_xy',
    ]);
    const xs = transformed.map((point: number[]) => point[0]!);
    const ys = transformed.map((point: number[]) => point[1]!);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  } catch {
    return transformBoundsFallback(bounds, from, to) ?? bounds;
  }
}

export async function transformBoundsToSource(
  bounds: [number, number, number, number],
  tileCrs: string,
  sourceCrs: string,
): Promise<[number, number, number, number]> {
  return transformBounds(bounds, tileCrs, sourceCrs);
}

export { warpDatasetToTile } from './metadata.js';
