import { describe, expect, it, vi } from 'vitest';
import { TileOrchestrator } from '../src/orchestrator.js';
import { parseRenderParams, TileParamsSchema, TileQuerySchema } from '../src/server/schemas.js';
import { createFastifyApp } from '../src/server/app.js';
import { WorkerPool } from '../src/workers/pool.js';
import { registerCustomTileMatrixSet } from '../src/tilematrix/custom.js';
import { getTileMatrixSet } from '../src/tilematrix/index.js';
import { WEB_MERCATOR_QUAD } from '../src/tilematrix/definitions.js';
import { encodeImage } from '../src/rendering/encode.js';
import { UnsupportedFormatError, TileOutOfBoundsError } from '../src/types.js';
import { createRasterProvider } from '../src/providers/index.js';
import { MemoryTileCache } from '../src/cache/memory.js';
import { buildTileCacheKey } from '../src/cache/key.js';

describe('server and orchestrator units', () => {
  it('parses tile params and render query', () => {
    const params = TileParamsSchema.parse({ z: '1', x: '2', y: '3', ext: 'webp' });
    expect(params.ext).toBe('webp');
    const query = TileQuerySchema.parse({ rescale: '0,255', hillshade: 'false' });
    expect(parseRenderParams(query, 'png').hillshade).toBe(false);
  });

  it('registers custom tile matrix sets', () => {
    registerCustomTileMatrixSet({ ...WEB_MERCATOR_QUAD, id: 'CustomSet' });
    expect(getTileMatrixSet('CustomSet').id).toBe('CustomSet');
  });

  it('runs worker pool jobs', async () => {
    const pool = new WorkerPool(1);
    const result = await pool.enqueue({ id: 'a', run: async () => 42 });
    expect(result).toBe(42);
  });

  it('creates fastify app with mocked orchestrator', async () => {
    const orchestrator = {
      getMetadata: vi.fn(async () => ({
        width: 1,
        height: 1,
        bands: 1,
        dtype: 'uint8',
        crs: 'EPSG:4326',
        bounds: [0, 0, 1, 1],
        minzoom: 0,
        maxzoom: 1,
      })),
      getBounds: vi.fn(async () => ({ bounds: [0, 0, 1, 1] as [number, number, number, number] })),
      getStatistics: vi.fn(async () => ({ band1: { min: 0, max: 1, mean: 0.5, stddev: 0.1 } })),
      getTile: vi.fn(async () => Uint8Array.from([137, 80, 78, 71])),
    } as unknown as TileOrchestrator;

    const app = await createFastifyApp(orchestrator);
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.json()).toEqual({ status: 'ok' });
    const metadata = await app.inject({ method: 'GET', url: '/metadata' });
    expect(metadata.json().width).toBe(1);
    const tile = await app.inject({ method: 'GET', url: '/tiles/0/0/0.png' });
    expect(tile.statusCode).toBe(200);
    await app.close();
  });

  it('throws typed errors', () => {
    expect(new UnsupportedFormatError('.nc').name).toBe('UnsupportedFormatError');
    expect(new TileOutOfBoundsError(1, 2, 3).message).toContain('1/2/3');
  });

  it('encodes jpeg fallback as png container', () => {
    const rgba = Uint8ClampedArray.from([0, 0, 0, 255]);
    const bytes = encodeImage(1, 1, rgba, 'jpg');
    expect(bytes[0]).toBe(137);
  });

  it('builds cache keys and stores tiles in memory', () => {
    const cache = new MemoryTileCache({ maxTiles: 10 });
    const key = buildTileCacheKey({
      sourceId: 'demo',
      tileMatrixSet: 'WebMercatorQuad',
      z: 0,
      x: 0,
      y: 0,
      render: { format: 'png' },
    });
    cache.set(key, Uint8Array.from([1, 2, 3]));
    expect(cache.get(key)).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it('rejects unsupported providers', async () => {
    await expect(createRasterProvider('sample.nc')).rejects.toBeInstanceOf(UnsupportedFormatError);
  });
});
