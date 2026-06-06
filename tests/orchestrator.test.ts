import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TileOrchestrator } from '../src/orchestrator.js';
import * as providers from '../src/providers/index.js';
import { TileCache } from '../src/cache/index.js';

describe('orchestrator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns metadata from provider', async () => {
    vi.spyOn(providers, 'createRasterProvider').mockResolvedValue({
      id: 'demo',
      crs: 'EPSG:4326',
      bounds: [0, 0, 1, 1],
      width: 10,
      height: 10,
      bandCount: 1,
      dtype: 'float32',
      close: vi.fn(),
      readWindow: vi.fn(async () => ({
        width: 1,
        height: 1,
        bands: 1,
        data: [Float32Array.from([1])],
        geotransform: [0, 1, 0, 1, 0, -1],
        crs: 'EPSG:4326',
      })),
    });

    const orchestrator = new TileOrchestrator({
      source: 'demo.tif',
      cache: new TileCache({ memory: 8, persistent: false }),
    });
    await orchestrator.init();
    const metadata = await orchestrator.getMetadata();
    expect(metadata.width).toBe(10);
    await orchestrator.close();
  });
});
