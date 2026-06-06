import { test, expect } from '@playwright/test';
import { createTileServer } from '../../src/index-core.js';
import { resolve } from 'node:path';

test('tile server exposes metadata and health endpoints', async ({ request }) => {
  const fixture = resolve('tests/fixtures/sample.tif');
  const server = await createTileServer({
    source: fixture,
    port: 18010,
    host: '127.0.0.1',
    cache: { memory: 16, persistent: false },
  });
  await server.start();

  try {
    const health = await request.get('http://127.0.0.1:18010/health');
    expect(health.ok()).toBeTruthy();
    const metadata = await request.get('http://127.0.0.1:18010/metadata');
    expect(metadata.ok()).toBeTruthy();
    const body = await metadata.json();
    expect(body.width).toBe(256);
  } finally {
    await server.stop();
  }
});
