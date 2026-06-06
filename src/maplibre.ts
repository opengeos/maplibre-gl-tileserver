import type { SourceInput } from './providers/types.js';
import { RasterSource } from './browser.js';

export {
  ensureBrowserTileProtocol,
  buildBrowserTileUrl,
  registerBrowserTileLayer,
  updateBrowserTileLayerRender,
  unregisterBrowserTileLayer,
  addRasterLayerToMap,
  buildServerTileUrl,
  MLTS_PROTOCOL,
} from './lib/browser-tile-protocol.js';

export interface MapLibreRasterSpec {
  source: {
    type: 'raster';
    tiles: string[];
    tileSize: number;
    bounds?: [number, number, number, number];
    minzoom?: number;
    maxzoom?: number;
  };
  layer: {
    id: string;
    type: 'raster';
    source: string;
    paint?: Record<string, unknown>;
  };
}

export async function createMapLibreRasterSource(options: {
  source: SourceInput;
  sourceId?: string;
  layerId?: string;
  tileUrl?: string;
  tileMatrixSet?: string;
}): Promise<MapLibreRasterSpec> {
  const raster = await RasterSource.fromSource(options.source, {
    tileMatrixSet: options.tileMatrixSet,
  });
  const metadata = await raster.getMetadata();
  const sourceId = options.sourceId ?? 'raster';
  const layerId = options.layerId ?? `${sourceId}-layer`;
  const tileUrl =
    options.tileUrl ??
    (typeof options.source === 'string' && !/^https?:\/\//i.test(options.source)
      ? `http://localhost:8000/tiles/{z}/{x}/{y}.png`
      : `{z}/{x}/{y}.png`);

  return {
    source: {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
      bounds: metadata.bounds,
      minzoom: metadata.minzoom,
      maxzoom: metadata.maxzoom,
    },
    layer: {
      id: layerId,
      type: 'raster',
      source: sourceId,
    },
  };
}
