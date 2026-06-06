import { describe, expect, it } from 'vitest';
import {
  getTileBounds,
  getTileMatrixCrs,
  getTileMatrixSet,
  computeZoomRange,
} from '../src/tilematrix/index.js';

describe('tilematrix', () => {
  it('resolves WebMercatorQuad', () => {
    const tms = getTileMatrixSet('WebMercatorQuad');
    expect(tms.id).toBe('WebMercatorQuad');
    expect(getTileMatrixCrs(tms)).toBe('EPSG:3857');
  });

  it('computes tile bounds for zoom 0', () => {
    const tms = getTileMatrixSet('WebMercatorQuad');
    const bounds = getTileBounds(tms, 0, 0, 0);
    expect(bounds[0]).toBeCloseTo(-20037508.34, -3);
    expect(bounds[2]).toBeCloseTo(20037508.34, -3);
  });

  it('flips y for TMS indexing', () => {
    const tms = getTileMatrixSet('WebMercatorQuad');
    const xyz = getTileBounds(tms, 2, 1, 1, false);
    const tmsBounds = getTileBounds(tms, 2, 1, 1, true);
    expect(xyz).not.toEqual(tmsBounds);
  });

  it('computes zoom range from bounds', () => {
    const tms = getTileMatrixSet('WebMercatorQuad');
    const range = computeZoomRange([-180, -85, 180, 85], tms);
    expect(range.minzoom).toBeGreaterThanOrEqual(0);
    expect(range.maxzoom).toBeGreaterThanOrEqual(range.minzoom);
  });

  it('resolves WorldCRS84Quad', () => {
    const tms = getTileMatrixSet('WorldCRS84Quad');
    expect(getTileMatrixCrs(tms)).toBe('EPSG:4326');
  });
});
