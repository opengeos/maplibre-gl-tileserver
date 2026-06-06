// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { createRasterProvider } from '../src/providers/index.js';
import { createTileServer } from '../src/index-core.js';
import { warpDatasetPathToTile } from '../src/gdal/window.js';

const fixture = resolve('tests/fixtures/sample.tif');

describe('integration', () => {
  it('creates raster provider from local geotiff', async () => {
    const provider = await createRasterProvider(fixture);
    expect(provider.width).toBe(256);
    expect(provider.height).toBe(256);
    await provider.close();
  }, 60_000);

  it('serves metadata and bounds from a local GeoTIFF', async () => {
    const server = await createTileServer({
      source: fixture,
      port: 18000,
      host: '127.0.0.1',
      cache: { memory: 32, persistent: false },
    });

    const metadata = await server.getMetadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.bands).toBeGreaterThan(0);
    expect(metadata.crs).toBe('EPSG:4326');
    expect(metadata.bounds[0]).toBeGreaterThan(30);

    const bounds = await server.getBounds();
    expect(bounds.bounds.length).toBe(4);

    const statistics = await server.getStatistics();
    expect(Object.keys(statistics).length).toBeGreaterThan(0);

    await server.stop();
  }, 60_000);

  it('warps a dataset window to a PNG tile', async () => {
    const provider = await createRasterProvider(fixture);
    const datasetBounds = await import('../src/gdal/reprojection.js').then(({ transformBounds }) =>
      transformBounds(provider.bounds, provider.crs, 'EPSG:3857'),
    );
    const window = await warpDatasetPathToTile(
      (provider as import('../src/providers/gdal-provider.js').GdalProvider).datasetPath,
      datasetBounds,
      'EPSG:3857',
      128,
      provider.bandCount,
    );
    expect(window.width).toBe(128);
    expect(window.data.length).toBeGreaterThan(0);
    await provider.close();
  }, 120_000);
});
