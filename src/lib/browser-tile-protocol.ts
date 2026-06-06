import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { DatasetMetadata, RenderParams } from '../types.js';
import type { RasterSource } from '../browser.js';

export const MLTS_PROTOCOL = 'mlts';

interface LayerRegistryEntry {
  raster: RasterSource;
  render: Partial<RenderParams>;
  version: number;
}

const layers = new globalThis.Map<string, LayerRegistryEntry>();
let protocolReady = false;
let activeTileTasks = 0;
const pendingTileTasks: Array<() => void> = [];
const maxActiveTileTasks = 2;

async function runTileTask<T>(task: () => Promise<T>): Promise<T> {
  if (activeTileTasks >= maxActiveTileTasks) {
    await new Promise<void>((resolve) => pendingTileTasks.push(resolve));
  }

  activeTileTasks++;
  try {
    return await task();
  } finally {
    activeTileTasks--;
    pendingTileTasks.shift()?.();
  }
}

function parseTileUrl(url: string): {
  layerId: string;
  z: number;
  x: number;
  y: number;
} {
  const withoutProtocol = url.replace(/^mlts:\/\//, '');
  const [pathPart] = withoutProtocol.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const layerId = segments[0]!;
  const z = Number(segments[2]);
  const x = Number(segments[3]);
  const y = Number.parseInt(segments[4]?.replace(/\.\w+$/, '') ?? '0', 10);
  return { layerId, z, x, y };
}

export function ensureBrowserTileProtocol(): void {
  if (protocolReady) return;
  protocolReady = true;

  maplibregl.addProtocol(MLTS_PROTOCOL, async (params) => {
    const { layerId, z, x, y } = parseTileUrl(params.url);
    const entry = layers.get(layerId);
    if (!entry) {
      throw new Error(`Raster layer "${layerId}" is not registered`);
    }

    const data = await runTileTask(() =>
      entry.raster.getTile(z, x, y, {
        format: 'png',
        ...entry.render,
      }),
    );
    return {
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  });
}

export function buildBrowserTileUrl(layerId: string, version: number): string {
  return `${MLTS_PROTOCOL}://${layerId}/${version}/{z}/{x}/{y}.png`;
}

export function registerBrowserTileLayer(
  layerId: string,
  raster: RasterSource,
  render: Partial<RenderParams> = {},
): number {
  ensureBrowserTileProtocol();
  const version = (layers.get(layerId)?.version ?? 0) + 1;
  layers.set(layerId, { raster, render, version });
  return version;
}

export function updateBrowserTileLayerRender(
  layerId: string,
  render: Partial<RenderParams>,
): number {
  const entry = layers.get(layerId);
  if (!entry) {
    throw new Error(`Layer ${layerId} is not registered`);
  }
  entry.render = render;
  entry.version += 1;
  return entry.version;
}

export async function unregisterBrowserTileLayer(layerId: string): Promise<void> {
  const entry = layers.get(layerId);
  if (!entry) return;
  await entry.raster.close();
  layers.delete(layerId);
}

export function addRasterLayerToMap(
  map: MapLibreMap,
  options: {
    sourceId: string;
    layerId: string;
    tileUrl: string;
    metadata: Pick<DatasetMetadata, 'bounds' | 'minzoom' | 'maxzoom'>;
    opacity?: number;
  },
): void {
  const { sourceId, layerId, tileUrl, metadata, opacity = 0.85 } = options;

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  map.addSource(sourceId, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: 256,
    bounds: metadata.bounds,
    minzoom: metadata.minzoom,
    maxzoom: metadata.maxzoom,
  });

  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': opacity,
      'raster-fade-duration': 0,
      'raster-resampling': 'nearest',
    },
  });
}

export function buildServerTileUrl(baseUrl: string, render: Partial<RenderParams>): string {
  const base = baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  if (render.rescale) params.set('rescale', render.rescale.join(','));
  if (render.colormap) params.set('colormap', render.colormap);
  if (render.hillshade) params.set('hillshade', 'true');
  if (render.gamma) params.set('gamma', String(render.gamma));
  const query = params.toString();
  return `${base}/tiles/{z}/{x}/{y}.png${query ? `?${query}` : ''}`;
}
