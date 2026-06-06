import type { GdalModule } from './gdal.js';
import { getGdal, writeEnvToGdalFs } from './gdal.js';
import { normalizeCrs, warpDatasetToTile } from './metadata.js';
import { createPointTransformer } from './reprojection.js';
import type { RasterWindow } from '../providers/types.js';

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface SourceGrid {
  step: number;
  cols: number;
  rows: number;
  points: Array<[number, number] | null>;
}

export async function warpWindowToTile(
  window: RasterWindow,
  tileBounds: [number, number, number, number],
  targetCrs: string,
  tileSize: number,
  cacheKey: string,
): Promise<RasterWindow> {
  if (normalizeCrs(window.crs) === normalizeCrs(targetCrs)) {
    return resampleWindowToTile(window, tileBounds, targetCrs, tileSize);
  }

  const transformTargetToSource = createPointTransformer(targetCrs, window.crs);
  if (transformTargetToSource) {
    return resampleWindowToTile(window, tileBounds, targetCrs, tileSize, transformTargetToSource);
  }

  const gdal = await getGdal();
  const envPath = writeEnvToGdalFs(gdal as never, cacheKey, window);
  const warpedPath = await warpDatasetToTile(gdal, envPath, tileBounds, targetCrs, tileSize);
  return readEnviWindow(gdal, warpedPath, tileBounds, targetCrs, tileSize, window.bands);
}

async function resampleWindowToTile(
  window: RasterWindow,
  tileBounds: [number, number, number, number],
  targetCrs: string,
  tileSize: number,
  transformTargetToSource?: (point: [number, number]) => [number, number] | null,
): Promise<RasterWindow> {
  const [sourceOriginX, sourcePixelWidth, , sourceOriginY, , sourcePixelHeight] =
    window.geotransform;
  const tilePixelWidth = (tileBounds[2] - tileBounds[0]) / tileSize;
  const tilePixelHeight = (tileBounds[3] - tileBounds[1]) / tileSize;
  const output = Array.from({ length: window.bands }, () => new Float32Array(tileSize * tileSize));
  const sourceGrid = transformTargetToSource
    ? createSourceGrid(
        tileBounds,
        tileSize,
        tilePixelWidth,
        tilePixelHeight,
        transformTargetToSource,
      )
    : null;

  for (let row = 0; row < tileSize; row++) {
    if (row > 0 && row % 16 === 0) await yieldToMainThread();

    const y = tileBounds[3] - (row + 0.5) * tilePixelHeight;

    for (let col = 0; col < tileSize; col++) {
      const x = tileBounds[0] + (col + 0.5) * tilePixelWidth;
      const targetPoint: [number, number] = [x, y];
      const sourcePoint = sourceGrid
        ? interpolateSourceGrid(sourceGrid, col, row)
        : transformTargetToSource
          ? transformTargetToSource(targetPoint)
          : targetPoint;
      const targetIndex = row * tileSize + col;
      if (!sourcePoint) {
        for (let band = 0; band < window.bands; band++) output[band]![targetIndex] = Number.NaN;
        continue;
      }

      const sourceX = (sourcePoint[0] - sourceOriginX) / sourcePixelWidth - 0.5;
      const sourceYForPoint = (sourcePoint[1] - sourceOriginY) / sourcePixelHeight - 0.5;

      for (let band = 0; band < window.bands; band++) {
        output[band]![targetIndex] = sampleBilinear(
          window.data[band],
          window.width,
          window.height,
          sourceX,
          sourceYForPoint,
          window.noData,
        );
      }
    }
  }

  return {
    width: tileSize,
    height: tileSize,
    bands: window.bands,
    data: output,
    geotransform: [tileBounds[0], tilePixelWidth, 0, tileBounds[3], 0, -tilePixelHeight],
    crs: targetCrs,
    noData: window.noData,
  };
}

function createSourceGrid(
  tileBounds: [number, number, number, number],
  tileSize: number,
  tilePixelWidth: number,
  tilePixelHeight: number,
  transformTargetToSource: (point: [number, number]) => [number, number] | null,
): SourceGrid {
  const step = 16;
  const cols = Math.ceil(tileSize / step) + 1;
  const rows = Math.ceil(tileSize / step) + 1;
  const points: Array<[number, number] | null> = [];

  for (let row = 0; row < rows; row++) {
    const pixelY = Math.min(tileSize - 0.5, row * step + 0.5);
    const y = tileBounds[3] - pixelY * tilePixelHeight;
    for (let col = 0; col < cols; col++) {
      const pixelX = Math.min(tileSize - 0.5, col * step + 0.5);
      const x = tileBounds[0] + pixelX * tilePixelWidth;
      points.push(transformTargetToSource([x, y]));
    }
  }

  return { step, cols, rows, points };
}

function interpolateSourceGrid(
  grid: SourceGrid,
  col: number,
  row: number,
): [number, number] | null {
  const gridCol = Math.min(grid.cols - 2, Math.floor(col / grid.step));
  const gridRow = Math.min(grid.rows - 2, Math.floor(row / grid.step));
  const tx = (col - gridCol * grid.step) / grid.step;
  const ty = (row - gridRow * grid.step) / grid.step;
  const i00 = gridRow * grid.cols + gridCol;
  const p00 = grid.points[i00];
  const p10 = grid.points[i00 + 1];
  const p01 = grid.points[i00 + grid.cols];
  const p11 = grid.points[i00 + grid.cols + 1];
  if (!p00 || !p10 || !p01 || !p11) return null;

  const topX = p00[0] + (p10[0] - p00[0]) * tx;
  const topY = p00[1] + (p10[1] - p00[1]) * tx;
  const bottomX = p01[0] + (p11[0] - p01[0]) * tx;
  const bottomY = p01[1] + (p11[1] - p01[1]) * tx;
  return [topX + (bottomX - topX) * ty, topY + (bottomY - topY) * ty];
}

function sampleBilinear(
  data: Float32Array | undefined,
  width: number,
  height: number,
  x: number,
  y: number,
  noData?: number,
): number {
  if (!data) return Number.NaN;

  const epsilon = 1e-6;
  if (x < -epsilon || y < -epsilon || x > width - 1 + epsilon || y > height - 1 + epsilon) {
    return Number.NaN;
  }

  x = Math.max(0, Math.min(width - 1, x));
  y = Math.max(0, Math.min(height - 1, y));

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const wx = x - x0;
  const wy = y - y0;

  const samples = [
    { value: data[y0 * width + x0]!, weight: (1 - wx) * (1 - wy) },
    { value: data[y0 * width + x1]!, weight: wx * (1 - wy) },
    { value: data[y1 * width + x0]!, weight: (1 - wx) * wy },
    { value: data[y1 * width + x1]!, weight: wx * wy },
  ];

  let value = 0;
  let weight = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample.value) || (noData !== undefined && sample.value === noData))
      continue;
    value += sample.value * sample.weight;
    weight += sample.weight;
  }

  return weight > 0 ? value / weight : Number.NaN;
}

export async function warpDatasetPathToTile(
  datasetPath: string,
  tileBounds: [number, number, number, number],
  targetCrs: string,
  tileSize: number,
  bandCount: number,
): Promise<RasterWindow> {
  const gdal = await getGdal();
  const warpedPath = await warpDatasetToTile(gdal, datasetPath, tileBounds, targetCrs, tileSize);
  return readEnviWindow(gdal, warpedPath, tileBounds, targetCrs, tileSize, bandCount);
}

async function readEnviWindow(
  gdal: GdalModule,
  datasetPath: string,
  tileBounds: [number, number, number, number],
  crs: string,
  tileSize: number,
  bandCount: number,
): Promise<RasterWindow> {
  const opened = await gdal.open(datasetPath);
  const dataset = opened.datasets[0];
  if (!dataset) throw new Error(`Unable to read warped dataset at ${datasetPath}`);
  const info = (await gdal.getInfo(dataset)) as {
    width?: number;
    height?: number;
    bandCount?: number;
  };
  const width = info.width ?? tileSize;
  const height = info.height ?? tileSize;
  const bands = info.bandCount ?? bandCount;
  const translate = await gdal.gdal_translate(dataset, ['-of', 'ENVI']);
  const bytes = await gdal.getFileBytes(translate);
  await gdal.close(dataset);
  const values = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  const data = Array.from({ length: bands }, (_, band) =>
    values.slice(band * width * height, (band + 1) * width * height),
  );
  return {
    width,
    height,
    bands,
    data,
    geotransform: [
      tileBounds[0],
      (tileBounds[2] - tileBounds[0]) / width,
      0,
      tileBounds[3],
      0,
      -(tileBounds[3] - tileBounds[1]) / height,
    ],
    crs,
  };
}
