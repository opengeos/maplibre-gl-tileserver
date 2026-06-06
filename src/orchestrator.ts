import type { TileMatrixSet } from '@developmentseed/morecantile';
import type { DatasetMetadata, DatasetStatistics, TileRequest } from './types.js';
import { TileOutOfBoundsError } from './types.js';
import { transformBounds, transformBoundsToSource } from './gdal/reprojection.js';
import type { SourceInput } from './providers/types.js';
import { createRasterProvider, GdalProvider, type RasterProvider } from './providers/index.js';
import { buildSourceId, TileCache } from './cache/index.js';
import {
  getTileBounds,
  getTileMatrixCrs,
  getTileMatrixSet,
  computeZoomRange,
} from './tilematrix/index.js';
import { renderWindow } from './rendering/pipeline.js';
import { encodeImage } from './rendering/encode.js';
import { warpDatasetPathToTile, warpWindowToTile } from './gdal/window.js';
import { computeStatisticsFromWindow, normalizeCrs } from './gdal/metadata.js';

export interface TileOrchestratorOptions {
  source: SourceInput;
  tileMatrixSet?: string | TileMatrixSet;
  tileSize?: number;
  tms?: boolean;
  cache?: TileCache;
}

export class TileOrchestrator {
  readonly sourceId: string;
  private provider!: RasterProvider;
  private tms: TileMatrixSet;
  private tileSize: number;
  private tmsYFlip: boolean;
  private cache: TileCache;
  private metadataCache?: DatasetMetadata;
  private statisticsCache?: DatasetStatistics;

  constructor(private options: TileOrchestratorOptions) {
    this.sourceId = buildSourceId(options.source);
    this.tms =
      typeof options.tileMatrixSet === 'string' || !options.tileMatrixSet
        ? getTileMatrixSet(options.tileMatrixSet ?? 'WebMercatorQuad')
        : options.tileMatrixSet;
    this.tileSize = options.tileSize ?? 256;
    this.tmsYFlip = options.tms ?? false;
    this.cache = options.cache ?? new TileCache();
  }

  async init(): Promise<void> {
    await this.cache.init();
    this.provider = await createRasterProvider(
      this.options.source,
      this.tms.id ?? 'WebMercatorQuad',
    );
  }

  async getMetadata(): Promise<DatasetMetadata> {
    if (this.metadataCache) return this.metadataCache;
    const targetBounds = await transformBounds(
      this.provider.bounds,
      normalizeCrs(this.provider.crs),
      getTileMatrixCrs(this.tms),
    );
    const zoom = computeZoomRange(targetBounds, this.tms, this.tileSize, {
      width: this.provider.width,
      height: this.provider.height,
    });
    this.metadataCache = {
      width: this.provider.width,
      height: this.provider.height,
      bands: this.provider.bandCount,
      dtype: this.provider.dtype,
      crs: this.provider.crs,
      bounds: this.provider.bounds,
      minzoom: zoom.minzoom,
      maxzoom: zoom.maxzoom,
    };
    return this.metadataCache;
  }

  async getBounds(): Promise<{ bounds: [number, number, number, number] }> {
    return { bounds: this.provider.bounds };
  }

  async getStatistics(): Promise<DatasetStatistics> {
    if (this.statisticsCache) return this.statisticsCache;
    const maxNativePixels = this.tileSize * this.tileSize * 16;
    const nativePixels = this.provider.width * this.provider.height;
    const window = await this.provider.readWindow(
      this.provider.bounds,
      undefined,
      nativePixels > maxNativePixels ? { maxSize: 1024 } : undefined,
    );
    if (window.data.length === 0 && this.provider instanceof GdalProvider) {
      const targetCrs = getTileMatrixCrs(this.tms);
      const sample = await warpDatasetPathToTile(
        this.provider.datasetPath,
        this.provider.bounds,
        targetCrs,
        Math.min(this.tileSize, 128),
        this.provider.bandCount,
      );
      this.statisticsCache = await computeStatisticsFromWindow(sample.data);
      return this.statisticsCache;
    }
    this.statisticsCache = await computeStatisticsFromWindow(window.data, window.noData);
    return this.statisticsCache;
  }

  async getTile(request: TileRequest): Promise<Uint8Array> {
    const key = this.cache.buildKey({
      sourceId: this.sourceId,
      tileMatrixSet: this.tms.id ?? 'WebMercatorQuad',
      z: request.z,
      x: request.x,
      y: request.y,
      render: request.render,
    });
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const tileBounds = getTileBounds(
      this.tms,
      request.z,
      request.x,
      request.y,
      this.tmsYFlip,
      this.tileSize,
    );
    const targetCrs = getTileMatrixCrs(this.tms);
    const datasetBounds = await transformBounds(
      this.provider.bounds,
      normalizeCrs(this.provider.crs),
      targetCrs,
    );

    if (!this.intersects(datasetBounds, tileBounds)) {
      throw new TileOutOfBoundsError(request.z, request.x, request.y);
    }

    let window;
    if (this.provider instanceof GdalProvider) {
      window = await warpDatasetPathToTile(
        this.provider.datasetPath,
        tileBounds,
        targetCrs,
        this.tileSize,
        this.provider.bandCount,
      );
    } else {
      const sourceBounds = await transformBoundsToSource(
        tileBounds,
        targetCrs,
        normalizeCrs(this.provider.crs),
      );
      const rawWindow = await this.provider.readWindow(sourceBounds, request.render.bands, {
        maxSize: this.tileSize * 2,
      });
      window = await warpWindowToTile(
        rawWindow,
        tileBounds,
        targetCrs,
        this.tileSize,
        `tile_${request.z}_${request.x}_${request.y}`,
      );
    }

    const rendered = renderWindow(window, request.render);
    const bytes = encodeImage(
      rendered.width,
      rendered.height,
      rendered.rgba,
      request.render.format,
    );
    await this.cache.set(key, bytes);
    return bytes;
  }

  private intersects(
    a: [number, number, number, number],
    b: [number, number, number, number],
  ): boolean {
    return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
  }

  async close(): Promise<void> {
    await this.provider?.close();
  }
}
