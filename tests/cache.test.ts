import { describe, expect, it } from 'vitest';
import { buildSourceId, buildTileCacheKey } from '../src/cache/key.js';
import { MemoryTileCache } from '../src/cache/memory.js';

describe('cache', () => {
  it('builds stable tile cache keys', () => {
    const keyA = buildTileCacheKey({
      sourceId: 'demo.tif',
      tileMatrixSet: 'WebMercatorQuad',
      z: 1,
      x: 2,
      y: 3,
      render: { format: 'png', rescale: [0, 1000] },
    });
    const keyB = buildTileCacheKey({
      sourceId: 'demo.tif',
      tileMatrixSet: 'WebMercatorQuad',
      z: 1,
      x: 2,
      y: 3,
      render: { format: 'png', rescale: [0, 1000] },
    });
    expect(keyA).toBe(keyB);
    expect(keyA).toHaveLength(64);
  });

  it('hashes array buffer sources', () => {
    const id = buildSourceId(new ArrayBuffer(8));
    expect(id).toHaveLength(64);
  });

  it('evicts old entries from memory cache', () => {
    const cache = new MemoryTileCache({ maxTiles: 2 });
    cache.set('a', Uint8Array.from([1]));
    cache.set('b', Uint8Array.from([2]));
    cache.set('c', Uint8Array.from([3]));
    expect(cache.has('a')).toBe(false);
    expect(cache.get('c')).toEqual(Uint8Array.from([3]));
  });
});
