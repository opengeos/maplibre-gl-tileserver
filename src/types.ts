import { z } from 'zod';

export const TileFormatSchema = z.enum(['png', 'jpg', 'jpeg', 'webp']);
export type TileFormat = z.infer<typeof TileFormatSchema>;

export const TileMatrixSetIdSchema = z.enum(['WebMercatorQuad', 'WorldCRS84Quad']);
export type TileMatrixSetId = z.infer<typeof TileMatrixSetIdSchema>;

export const RenderParamsSchema = z.object({
  bands: z.array(z.number().int().positive()).optional(),
  rescale: z.tuple([z.number(), z.number()]).optional(),
  colormap: z.string().optional(),
  gamma: z.number().positive().optional(),
  contrast: z.number().optional(),
  hillshade: z.boolean().optional(),
  format: TileFormatSchema.default('png'),
});

export type RenderParams = z.infer<typeof RenderParamsSchema>;

export const CacheConfigSchema = z.object({
  memory: z.number().int().positive().default(256),
  persistent: z.boolean().default(true),
});

export const TileServerConfigSchema = z.object({
  source: z.union([
    z.string(),
    z.instanceof(ArrayBuffer),
    z.custom<File>((v) => typeof File !== 'undefined' && v instanceof File),
  ]),
  tileMatrixSet: z.union([TileMatrixSetIdSchema, z.string()]).default('WebMercatorQuad'),
  tileSize: z.number().int().positive().default(256),
  port: z.number().int().positive().default(8000),
  host: z.string().default('0.0.0.0'),
  cache: CacheConfigSchema.optional(),
  tms: z.boolean().default(false),
});

export type TileServerConfig = z.infer<typeof TileServerConfigSchema>;

export interface DatasetMetadata {
  width: number;
  height: number;
  bands: number;
  dtype: string;
  crs: string;
  bounds: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
}

export interface BandStatistics {
  min: number;
  max: number;
  mean: number;
  stddev: number;
}

export type DatasetStatistics = Record<string, BandStatistics>;

export interface TileRequest {
  z: number;
  x: number;
  y: number;
  render: RenderParams;
}

export interface TileServerInstance {
  tileUrl: string;
  metadataUrl: string;
  boundsUrl: string;
  statisticsUrl: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  getMetadata(): Promise<DatasetMetadata>;
  getStatistics(): Promise<DatasetStatistics>;
  getBounds(): Promise<{ bounds: [number, number, number, number] }>;
  getTile(request: TileRequest): Promise<Uint8Array>;
}

export class UnsupportedFormatError extends Error {
  constructor(format: string) {
    super(
      `Unsupported raster format: ${format}. NetCDF, HDF5, and JPEG2000 are not available in the bundled GDAL WASM build.`,
    );
    this.name = 'UnsupportedFormatError';
  }
}

export class TileOutOfBoundsError extends Error {
  constructor(z: number, x: number, y: number) {
    super(`Tile ${z}/${x}/${y} is outside dataset bounds`);
    this.name = 'TileOutOfBoundsError';
  }
}
