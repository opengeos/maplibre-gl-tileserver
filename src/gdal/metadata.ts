import type { GdalModule } from './gdal.js';
import type { DatasetMetadata, DatasetStatistics, BandStatistics } from '../types.js';
import { computeZoomRange, getTileMatrixCrs, type TileMatrixSet } from '../tilematrix/index.js';

function parseEpsgFromWkt(wkt?: string): string {
  if (!wkt) return 'EPSG:4326';
  if (/WGS_1984_Web_Mercator/i.test(wkt) || /Pseudo-Mercator/i.test(wkt)) return 'EPSG:3857';
  const matches = [...wkt.matchAll(/AUTHORITY\["EPSG","(\d+)"\]/gi)];
  if (matches.length > 0) {
    return `EPSG:${matches[matches.length - 1]![1]}`;
  }
  if (/WGS 84/i.test(wkt)) return 'EPSG:4326';
  return 'EPSG:4326';
}

export function normalizeCrs(crs: string): string {
  if (crs.startsWith('EPSG:')) return crs;
  if (crs.trim().startsWith('+proj=')) return crs.trim();
  return parseEpsgFromWkt(crs);
}

function normalizeGeoTransform(value: unknown): number[] | null {
  if (Array.isArray(value) && value.length >= 6) return value as number[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, number>;
    const values = [0, 1, 2, 3, 4, 5].map((index) => record[String(index)] ?? record[index]);
    if (values.every((entry) => typeof entry === 'number')) return values as number[];
  }
  return null;
}

function boundsFromInfo(info: {
  corners?: Array<Array<number>>;
  width?: number;
  height?: number;
  coordinateTransform?: unknown;
}): [number, number, number, number] {
  if (info.corners && info.corners.length >= 4) {
    const xs = info.corners.map((c) => c[0]!);
    const ys = info.corners.map((c) => c[1]!);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  const gt = normalizeGeoTransform(info.coordinateTransform);
  if (gt && info.width && info.height) {
    const [originX, pixelWidth, , originY, , pixelHeight] = gt;
    const xmin = originX;
    const ymax = originY;
    const xmax = originX + pixelWidth * info.width;
    const ymin = originY + pixelHeight * info.height;
    return [Math.min(xmin, xmax), Math.min(ymin, ymax), Math.max(xmin, xmax), Math.max(ymin, ymax)];
  }
  return [-180, -85.0511, 180, 85.0511];
}

export async function getDatasetMetadataFromGdal(
  gdal: GdalModule,
  datasetPath: string,
  tms: TileMatrixSet,
): Promise<DatasetMetadata> {
  const opened = await gdal.open(datasetPath);
  const dataset = opened.datasets[0];
  if (!dataset) throw new Error(`Unable to open dataset: ${datasetPath}`);
  const info = (await gdal.getInfo(dataset)) as {
    width?: number;
    height?: number;
    bandCount?: number;
    projectionWkt?: string;
    coordinateTransform?: unknown;
    corners?: Array<Array<number>>;
  };
  const crs = parseEpsgFromWkt(info.projectionWkt);
  const bounds = boundsFromInfo(info);
  const zoom = computeZoomRange(bounds, tms);
  await gdal.close(dataset);
  return {
    width: info.width ?? 0,
    height: info.height ?? 0,
    bands: info.bandCount ?? 1,
    dtype: 'float32',
    crs,
    bounds,
    minzoom: zoom.minzoom,
    maxzoom: zoom.maxzoom,
  };
}

export async function warpDatasetToTile(
  gdal: GdalModule,
  datasetPath: string,
  bounds: [number, number, number, number],
  targetCrs: string,
  tileSize: number,
  sourceCrs?: string,
  nodataValue?: string,
): Promise<string> {
  const opened = await gdal.open(datasetPath);
  const dataset = opened.datasets[0];
  if (!dataset) throw new Error(`Unable to open dataset: ${datasetPath}`);
  const [xmin, ymin, xmax, ymax] = bounds;
  const output = await gdal.gdalwarp(dataset, [
    '-of',
    'GTiff',
    ...(sourceCrs ? ['-s_srs', sourceCrs] : []),
    ...(nodataValue ? ['-srcnodata', nodataValue, '-dstnodata', nodataValue] : []),
    '-t_srs',
    targetCrs,
    '-te',
    String(xmin),
    String(ymin),
    String(xmax),
    String(ymax),
    '-ts',
    String(tileSize),
    String(tileSize),
    '-r',
    'bilinear',
    '-co',
    'COMPRESS=LZW',
  ]);
  await gdal.close(dataset);
  return output.real ?? output.local;
}

export async function computeStatisticsFromWindow(
  data: Float32Array[],
  noData?: number,
): Promise<DatasetStatistics> {
  const stats: DatasetStatistics = {};
  data.forEach((band, index) => {
    stats[`band${index + 1}`] = computeBandStatistics(band, noData);
  });
  return stats;
}

export function computeBandStatistics(values: Float32Array, noData?: number): BandStatistics {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (!Number.isFinite(value) || (noData !== undefined && value === noData)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
    count++;
  }
  if (count === 0) return { min: 0, max: 0, mean: 0, stddev: 0 };
  const mean = sum / count;
  let variance = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (!Number.isFinite(value) || (noData !== undefined && value === noData)) continue;
    variance += (value - mean) ** 2;
  }
  return { min, max, mean, stddev: Math.sqrt(variance / count) };
}

export { getTileMatrixCrs };
