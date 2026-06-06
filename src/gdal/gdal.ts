export type GdalModule = {
  open: (file: string | string[]) => Promise<{ datasets: Array<{ pointer: number; path: string; type: string }>; errors: string[] }>;
  close: (dataset: { pointer: number }) => Promise<void>;
  getInfo: (dataset: { pointer: number }) => Promise<Record<string, unknown>>;
  gdal_translate: (dataset: { pointer: number }, options?: string[]) => Promise<{ local: string; real: string }>;
  gdalwarp: (dataset: { pointer: number }, options?: string[]) => Promise<{ local: string; real: string }>;
  gdaltransform: (coords: number[][], options: string[]) => Promise<number[][]>;
  getFileBytes: (filePath: string | { local: string; real: string }) => Promise<Uint8Array>;
  Module?: { FS: { writeFile: (path: string, data: Int8Array) => void; mkdir: (path: string) => void } };
};

let gdalPromise: Promise<GdalModule> | null = null;

export async function loadGdal(): Promise<GdalModule> {
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

  if (!isNode && typeof window !== 'undefined') {
    // Vite-style `?url` asset imports are loaded lazily so that Node-based
    // runners (e.g. Playwright) never try to resolve the raw .data/.wasm files.
    const [{ default: initGdalJs }, { default: dataUrl }, { default: wasmUrl }] = await Promise.all([
      import('gdal3.js'),
      import('gdal3.js/dist/package/gdal3WebAssembly.data?url'),
      import('gdal3.js/dist/package/gdal3WebAssembly.wasm?url'),
    ]);
    return initGdalJs({
      paths: {
        data: dataUrl,
        wasm: wasmUrl,
      },
      useWorker: false,
    }) as unknown as GdalModule;
  }

  const { default: initNode } = await import('gdal3.js/node.js');
  return initNode({ useWorker: false }) as unknown as GdalModule;
}

export async function getGdal(): Promise<GdalModule> {
  if (!gdalPromise) gdalPromise = loadGdal();
  return gdalPromise;
}

export async function writeFileToGdalFs(
  gdal: GdalModule,
  virtualPath: string,
  data: Uint8Array,
): Promise<void> {
  if (!gdal.Module?.FS) {
    throw new Error('GDAL Emscripten filesystem is unavailable');
  }
  try {
    gdal.Module.FS.mkdir('/input');
  } catch {
    // directory may already exist
  }
  gdal.Module.FS.writeFile(virtualPath, new Int8Array(data.buffer, data.byteOffset, data.byteLength));
}

export async function readLocalFileToGdal(
  gdal: GdalModule,
  localPath: string,
  virtualPath?: string,
): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(localPath);
  const target = virtualPath ?? `/input/${localPath.split(/[/\\]/).pop() ?? 'dataset.tif'}`;
  await writeFileToGdalFs(gdal, target, new Uint8Array(bytes));
  return target;
}

export function writeEnvToGdalFs(
  gdal: GdalModule,
  baseName: string,
  window: {
    width: number;
    height: number;
    bands: number;
    data: Float32Array[];
    geotransform: [number, number, number, number, number, number];
    crs: string;
  },
): string {
  const module = gdal.Module!;
  try {
    module.FS.mkdir('/input');
  } catch {
    // ignore
  }
  const hdrPath = `/input/${baseName}.hdr`;
  const datPath = `/input/${baseName}.dat`;
  const [originX, pixelWidth, , originY, , pixelHeight] = window.geotransform;
  const header = [
    'ENVI',
    `description = { maplibre-gl-raster window }`,
    `samples = ${window.width}`,
    `lines = ${window.height}`,
    `bands = ${window.bands}`,
    'header offset = 0',
    'file type = ENVI Standard',
    'data type = 4',
    'interleave = bsq',
    'byte order = 0',
    `map info = {${window.crs}, 1, 1, ${originX}, ${originY}, ${pixelWidth}, ${pixelHeight}, WKT-CRS}`,
  ].join('\n');
  module.FS.writeFile(hdrPath, new Int8Array(new TextEncoder().encode(header)));
  const bytes = new Float32Array(window.width * window.height * window.bands);
  for (let b = 0; b < window.bands; b++) {
    bytes.set(window.data[b]!, b * window.width * window.height);
  }
  module.FS.writeFile(datPath, new Int8Array(bytes.buffer));
  return datPath;
}

export async function encodeRasterFormat(
  gdal: GdalModule,
  datasetPath: string,
  format: 'png' | 'jpg' | 'jpeg' | 'webp',
): Promise<Uint8Array> {
  const of = format === 'jpg' || format === 'jpeg' ? 'JPEG' : format === 'webp' ? 'WEBP' : 'PNG';
  const opened = await gdal.open(datasetPath);
  const dataset = opened.datasets[0];
  if (!dataset) throw new Error(`Failed to open dataset at ${datasetPath}`);
  const output = await gdal.gdal_translate(dataset, ['-of', of]);
  const bytes = await gdal.getFileBytes(output);
  await gdal.close(dataset);
  return bytes;
}
