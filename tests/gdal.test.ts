// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGdal } from '../src/gdal/gdal.js';
import { GdalProvider } from '../src/providers/gdal-provider.js';

describe('gdal debug', () => {
  it('loads node gdal and opens fixture', async () => {
    const gdal = await getGdal();
    expect(gdal.Module?.FS).toBeTruthy();
    try {
      gdal.Module!.FS.mkdir('/input');
    } catch {
      // ignore
    }
    const bytes = await readFile(resolve('tests/fixtures/sample.tif'));
    gdal.Module!.FS.writeFile('/input/sample.tif', new Int8Array(bytes));
    const opened = await gdal.open('/input/sample.tif');
    expect(opened.datasets.length).toBe(1);
  }, 60_000);

  it('creates gdal provider', async () => {
    const provider = await GdalProvider.fromSource(resolve('tests/fixtures/sample.tif'));
    expect(provider.width).toBe(256);
    await provider.close();
  }, 60_000);
});
