import type { RasterProvider, RasterWindow, SourceInput } from './types.js';
import { getGdal, readLocalFileToGdal } from '../gdal/gdal.js';
import { getDatasetMetadataFromGdal } from '../gdal/metadata.js';
import { getTileMatrixSet } from '../tilematrix/index.js';

export class GdalProvider implements RasterProvider {
  readonly id: string;
  readonly crs: string;
  readonly bounds: [number, number, number, number];
  readonly width: number;
  readonly height: number;
  readonly bandCount: number;
  readonly dtype = 'float32';
  readonly datasetPath: string;

  private constructor(
    id: string,
    datasetPath: string,
    meta: {
      crs: string;
      bounds: [number, number, number, number];
      width: number;
      height: number;
      bands: number;
    },
  ) {
    this.id = id;
    this.datasetPath = datasetPath;
    this.crs = meta.crs;
    this.bounds = meta.bounds;
    this.width = meta.width;
    this.height = meta.height;
    this.bandCount = meta.bands;
  }

  static async fromSource(
    source: SourceInput,
    tileMatrixSetId = 'WebMercatorQuad',
  ): Promise<GdalProvider> {
    const gdal = await getGdal();
    let datasetPath: string;
    let id: string;
    const module = (
      gdal as {
        Module?: {
          FS: {
            writeFile: (p: string, d: Int8Array) => void;
            mkdir: (p: string) => void;
          };
        };
      }
    ).Module;
    try {
      module?.FS.mkdir('/input');
    } catch {
      // ignore existing directory
    }

    if (typeof source === 'string' && !/^https?:\/\//i.test(source)) {
      datasetPath = await readLocalFileToGdal(gdal as never, source);
      id = source;
    } else if (source instanceof ArrayBuffer) {
      id = 'buffer';
      datasetPath = '/input/dataset.tif';
      module?.FS.writeFile(datasetPath, new Int8Array(source));
    } else if (typeof source === 'string') {
      const response = await fetch(source);
      const buffer = await response.arrayBuffer();
      id = source;
      datasetPath = '/input/remote.tif';
      module?.FS.writeFile(datasetPath, new Int8Array(buffer));
    } else {
      id = source.name;
      const buffer = await source.arrayBuffer();
      datasetPath = `/input/${source.name}`;
      module?.FS.writeFile(datasetPath, new Int8Array(buffer));
    }

    const tms = getTileMatrixSet(tileMatrixSetId);
    const metadata = await getDatasetMetadataFromGdal(gdal, datasetPath, tms);
    return new GdalProvider(id, datasetPath, metadata);
  }

  async close(): Promise<void> {
    // datasets are closed per operation in gdal helpers
  }

  async readWindow(
    bounds: [number, number, number, number],
    _bands?: number[],
    _options?: { maxSize?: number; width?: number; height?: number },
  ): Promise<RasterWindow> {
    return {
      width: 0,
      height: 0,
      bands: this.bandCount,
      data: [],
      geotransform: [bounds[0], 1, 0, bounds[3], 0, -1],
      crs: this.crs,
    };
  }
}
