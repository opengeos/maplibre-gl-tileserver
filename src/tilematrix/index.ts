import { xy_bounds } from '@developmentseed/morecantile';
import type { TileMatrixSet } from '@developmentseed/morecantile';
import { BUILTIN_TILE_MATRIX_SETS } from './definitions.js';
import { loadCustomTileMatrixSet } from './custom.js';

export type { TileMatrixSet };
export { BUILTIN_TILE_MATRIX_SETS };

const WEB_MERCATOR_ORIGIN = 20037508.342789244;

export function getTileMatrixSet(id: string, custom?: TileMatrixSet): TileMatrixSet {
  if (custom) return custom;
  const builtIn = BUILTIN_TILE_MATRIX_SETS[id];
  if (builtIn) return builtIn;
  return loadCustomTileMatrixSet(id);
}

export function getTileBoundsWebMercator(
  z: number,
  x: number,
  y: number,
  tileSize = 256,
): [number, number, number, number] {
  const res = (WEB_MERCATOR_ORIGIN * 2) / (tileSize * 2 ** z);
  const xmin = -WEB_MERCATOR_ORIGIN + x * tileSize * res;
  const xmax = -WEB_MERCATOR_ORIGIN + (x + 1) * tileSize * res;
  const ymax = WEB_MERCATOR_ORIGIN - y * tileSize * res;
  const ymin = WEB_MERCATOR_ORIGIN - (y + 1) * tileSize * res;
  return [xmin, ymin, xmax, ymax];
}

export function getTileBoundsWorldCrs84(
  z: number,
  x: number,
  y: number,
  tmsYFlip = false,
): [number, number, number, number] {
  const matrixWidth = 2 ** (z + 1);
  const matrixHeight = 2 ** z;
  const row = tmsYFlip ? y : matrixHeight - 1 - y;
  const lonStep = 360 / matrixWidth;
  const latStep = 180 / matrixHeight;
  const xmin = -180 + x * lonStep;
  const xmax = -180 + (x + 1) * lonStep;
  const ymax = 90 - row * latStep;
  const ymin = 90 - (row + 1) * latStep;
  return [xmin, ymin, xmax, ymax];
}

export function getTileBounds(
  tms: TileMatrixSet,
  z: number,
  x: number,
  y: number,
  tmsYFlip = false,
  tileSize = 256,
): [number, number, number, number] {
  const id = tms.id ?? 'WebMercatorQuad';
  if (id === 'WebMercatorQuad') {
    const matrixHeight = tms.tileMatrices[z]?.matrixHeight ?? 2 ** z;
    const row = tmsYFlip ? matrixHeight - 1 - y : y;
    return getTileBoundsWebMercator(z, x, row, tileSize);
  }
  if (id === 'WorldCRS84Quad') {
    return getTileBoundsWorldCrs84(z, x, y, tmsYFlip);
  }

  const matrixHeight = tms.tileMatrices[z]?.matrixHeight ?? 2 ** z;
  const row = tmsYFlip ? y : matrixHeight - 1 - y;
  const bbox = xy_bounds(tms, { x, y: row, z });
  return [bbox.lowerLeft[0], bbox.lowerLeft[1], bbox.upperRight[0], bbox.upperRight[1]];
}

export function getTileMatrixCrs(tms: TileMatrixSet): string {
  const crs = tms.crs;
  const uri = typeof crs === 'string' ? crs : typeof crs === 'object' && crs && 'uri' in crs ? String(crs.uri) : '';
  const epsgMatch = uri.match(/EPSG[/\\](?:0[/\\])?(\d+)/i);
  if (epsgMatch) return `EPSG:${epsgMatch[1]}`;
  if (uri.includes('CRS84')) return 'EPSG:4326';
  return uri || 'EPSG:3857';
}

export function computeZoomRange(
  bounds: [number, number, number, number],
  tms: TileMatrixSet,
  tileSize = 256,
  sourceSize?: { width: number; height: number },
): { minzoom: number; maxzoom: number } {
  const spanX = Math.abs(bounds[2] - bounds[0]);
  const spanY = Math.abs(bounds[3] - bounds[1]);
  const maxSpan = Math.max(spanX, spanY);
  let minzoom = 0;
  let maxzoom = tms.tileMatrices.length - 1;

  if (tms.id === 'WebMercatorQuad') {
    for (let z = 0; z < 24; z++) {
      const worldSpan = (WEB_MERCATOR_ORIGIN * 2) / 2 ** z;
      if (maxSpan <= worldSpan) {
        minzoom = z;
        break;
      }
    }
    for (let z = 0; z < 24; z++) {
      const pixelSize = (WEB_MERCATOR_ORIGIN * 2) / (tileSize * 2 ** z);
      const targetPixelSize = sourceSize
        ? Math.max(spanX / sourceSize.width, spanY / sourceSize.height)
        : maxSpan / 4;
      if (pixelSize <= targetPixelSize) {
        maxzoom = Math.min(sourceSize ? z + 1 : z + 4, 23);
        break;
      }
    }
    return { minzoom, maxzoom: Math.max(minzoom, maxzoom) };
  }

  for (let z = 0; z < tms.tileMatrices.length; z++) {
    const matrix = tms.tileMatrices[z];
    const worldSpan = matrix.cellSize * matrix.tileWidth * matrix.matrixWidth;
    if (maxSpan <= worldSpan) {
      minzoom = z;
      break;
    }
  }

  return { minzoom, maxzoom: Math.max(minzoom, maxzoom) };
}
