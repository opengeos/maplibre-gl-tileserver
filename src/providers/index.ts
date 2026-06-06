import { detectUnsupportedExtension, isGeotiffSource, isRemoteUrl } from './types.js';
import { GeotiffProvider } from './geotiff-provider.js';
import { GdalProvider } from './gdal-provider.js';
import { UnsupportedFormatError } from '../types.js';

export async function createRasterProvider(
  source: import('./types.js').SourceInput,
  tileMatrixSetId = 'WebMercatorQuad',
): Promise<import('./types.js').RasterProvider> {
  if (typeof source === 'string') {
    const unsupported = detectUnsupportedExtension(source);
    if (unsupported) throw new UnsupportedFormatError(unsupported);
  }

  if (isGeotiffSource(source) && (typeof source !== 'string' || isRemoteUrl(source))) {
    return GeotiffProvider.fromSource(source);
  }

  return GdalProvider.fromSource(source, tileMatrixSetId);
}

export { GeotiffProvider, GdalProvider };
export type { RasterProvider, SourceInput, RasterWindow } from './types.js';
