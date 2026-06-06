#!/usr/bin/env node
import { Command } from 'commander';
import { createTileServer } from './index-core.js';

const program = new Command();

program
  .name('maplibre-gl-tileserver')
  .description('Serve local and remote raster datasets as XYZ tiles for MapLibre GL JS')
  .argument('<source>', 'Raster dataset path or URL')
  .option('-p, --port <port>', 'HTTP port', '8000')
  .option('--host <host>', 'Bind host', '0.0.0.0')
  .option('--tileMatrixSet <id>', 'Tile matrix set id', 'WebMercatorQuad')
  .option('--tms', 'Use TMS y indexing instead of XYZ', false)
  .action(async (source: string, options) => {
    const server = await createTileServer({
      source,
      port: Number.parseInt(String(options.port), 10),
      host: options.host,
      tileMatrixSet: options.tileMatrixSet,
      tms: options.tms,
      tileSize: 256,
    });
    await server.start();
    console.log('Tile server running on:');
    console.log(`  ${server.tileUrl.replace('{z}/{x}/{y}.png', '')}`);
    console.log('Metadata:');
    console.log(`  ${server.metadataUrl}`);
    console.log('Tiles:');
    console.log(`  ${server.tileUrl}`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
