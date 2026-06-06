import { describe, expect, it } from 'vitest';
import { transformBounds, transformBoundsFallback, transformPointFallback } from '../src/gdal/reprojection.js';
import { getTileBounds, getTileMatrixSet, getTileMatrixCrs } from '../src/tilematrix/index.js';

describe('reprojection', () => {
  it('transforms between Web Mercator and WGS84', () => {
    const result = transformBoundsFallback([0, 0, 20037508.34, 20037508.34], 'EPSG:3857', 'EPSG:4326');
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(0, 0);
    expect(result![2]).toBeCloseTo(180, 0);
  });

  it('finds overlap for fixture bounds and center tile', async () => {
    const bounds: [number, number, number, number] = [
      32.77521014213562, 39.90883920013071, 32.77774751186371, 39.9113821386774,
    ];
    const centerLng = (bounds[0] + bounds[2]) / 2;
    const centerLat = (bounds[1] + bounds[3]) / 2;
    const latRad = (centerLat * Math.PI) / 180;
    const z = 12;
    const n = 2 ** z;
    const x = Math.floor(((centerLng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);

    const tms = getTileMatrixSet('WebMercatorQuad');
    const tileBounds = getTileBounds(tms, z, x, y);
    const sourceBounds = await transformBounds(tileBounds, getTileMatrixCrs(tms), 'EPSG:4326');
    expect(sourceBounds[0]).toBeLessThan(bounds[2]);
    expect(sourceBounds[2]).toBeGreaterThan(bounds[0]);
  });

  it('transforms custom Albers Equal Area projection strings', () => {
    const nlcdCrs = [
      '+proj=aea',
      '+lat_1=29.5',
      '+lat_2=45.5',
      '+lat_0=23',
      '+lon_0=-96',
      '+x_0=0',
      '+y_0=0',
      '+a=6378137',
      '+rf=298.257223563',
      '+units=m',
      '+no_defs',
    ].join(' ');

    const roundTrip = transformPointFallback([-96, 40], 'EPSG:4326', nlcdCrs);
    expect(roundTrip).not.toBeNull();
    const lngLat = transformPointFallback(roundTrip!, nlcdCrs, 'EPSG:4326');
    expect(lngLat?.[0]).toBeCloseTo(-96, 4);
    expect(lngLat?.[1]).toBeCloseTo(40, 4);

    const bounds = transformBoundsFallback(
      [-2493045, 177285, 2342655, 3310005],
      nlcdCrs,
      'EPSG:4326',
    );
    expect(bounds).not.toBeNull();
    expect(bounds![0]).toBeGreaterThan(-132);
    expect(bounds![0]).toBeLessThan(-120);
    expect(bounds![1]).toBeGreaterThan(20);
    expect(bounds![2]).toBeGreaterThan(-70);
    expect(bounds![2]).toBeLessThan(-60);
    expect(bounds![3]).toBeLessThan(55);
  });
});
