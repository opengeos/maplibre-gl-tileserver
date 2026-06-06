import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, '../tests/fixtures/sample.tif');

async function main() {
  const initGdalJs = (await import('gdal3.js/node.js')).default;
  const Gdal = await initGdalJs({ useWorker: false });

  const width = 256;
  const height = 256;
  const bytes = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      bytes[idx] = (x / width) * 255;
      bytes[idx + 1] = (y / height) * 255;
      bytes[idx + 2] = 128;
    }
  }

  const hdr = [
    'ENVI',
    'description = { fixture }',
    `samples = ${width}`,
    `lines = ${height}`,
    'bands = 3',
    'header offset = 0',
    'file type = ENVI Standard',
    'data type = 4',
    'interleave = bsq',
    'byte order = 0',
    'map info = {EPSG:3857, 1, 1, -20037508.342789244, 20037508.342789244, 156543.03392804097, 156543.03392804097, WKT-EPSG}',
  ].join('\n');

  Gdal.Module.FS.mkdir('/input');
  Gdal.Module.FS.writeFile('/input/fixture.hdr', new Int8Array(Buffer.from(hdr)));
  Gdal.Module.FS.writeFile('/input/fixture.dat', new Int8Array(bytes.buffer));

  const opened = await Gdal.open('/input/fixture.dat');
  const dataset = opened.datasets[0];
  const translated = await Gdal.gdal_translate(dataset, [
    '-of',
    'GTiff',
    '-a_srs',
    'EPSG:3857',
    '-a_ullr',
    '-20037508.342789244',
    '20037508.342789244',
    '20037508.342789244',
    '-20037508.342789244',
  ]);
  const tifBytes = await Gdal.getFileBytes(translated);
  await mkdir(dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, Buffer.from(tifBytes));
  console.log(`Wrote ${fixturePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
