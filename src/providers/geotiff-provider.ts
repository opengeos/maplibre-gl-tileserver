import { fromBlob, fromUrl, fromArrayBuffer } from 'geotiff';
import type { RasterProvider, RasterWindow, SourceInput } from './types.js';

async function parseGeoKeys(
  image: Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>,
): Promise<string> {
  const geoKeys = image.getGeoKeys?.() ?? null;
  if (geoKeys) {
    if (geoKeys.ProjectedCSTypeGeoKey && geoKeys.ProjectedCSTypeGeoKey !== 32767) {
      return `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
    }
    if (geoKeys.ProjCoordTransGeoKey === 11) {
      return [
        '+proj=aea',
        `+lat_1=${geoKeys.ProjStdParallel1GeoKey}`,
        `+lat_2=${geoKeys.ProjStdParallel2GeoKey}`,
        `+lat_0=${geoKeys.ProjNatOriginLatGeoKey}`,
        `+lon_0=${geoKeys.ProjNatOriginLongGeoKey}`,
        `+x_0=${geoKeys.ProjFalseEastingGeoKey ?? 0}`,
        `+y_0=${geoKeys.ProjFalseNorthingGeoKey ?? 0}`,
        `+a=${geoKeys.GeogSemiMajorAxisGeoKey ?? 6378137}`,
        `+rf=${geoKeys.GeogInvFlatteningGeoKey ?? 298.257223563}`,
        '+units=m',
        '+no_defs',
      ].join(' ');
    }
    if (geoKeys.GeographicTypeGeoKey) return `EPSG:${geoKeys.GeographicTypeGeoKey}`;
  }
  return 'EPSG:4326';
}

function parseNoData(
  image: Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>,
): number | undefined {
  const value = image.getGDALNoData();
  return value !== null && Number.isFinite(value) ? value : undefined;
}

function inferDtype(
  image: Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>,
): string {
  const bits = image.getBitsPerSample(0) ?? 32;
  const sampleFormat = image.getSampleFormat(0) ?? 1;
  if (sampleFormat === 3) return `float${bits}`;
  if (sampleFormat === 2) return `int${bits}`;
  return `uint${bits}`;
}

function boundsFromImage(
  image: Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>,
): [number, number, number, number] {
  const bbox = image.getBoundingBox();
  return [bbox[0], bbox[1], bbox[2], bbox[3]];
}

function pixelWindowForImage(
  image: Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>,
  bounds: [number, number, number, number],
  imageBounds: [number, number, number, number],
  padding: number,
) {
  const [xmin, ymin, xmax, ymax] = bounds;
  const width = image.getWidth();
  const height = image.getHeight();
  const [bxmin, bymin, bxmax, bymax] = imageBounds;
  const pxMin = Math.max(0, Math.floor(((xmin - bxmin) / (bxmax - bxmin)) * width) - padding);
  const pxMax = Math.min(width, Math.ceil(((xmax - bxmin) / (bxmax - bxmin)) * width) + padding);
  const pyMin = Math.max(0, Math.floor(((bymax - ymax) / (bymax - bymin)) * height) - padding);
  const pyMax = Math.min(height, Math.ceil(((bymax - ymin) / (bymax - bymin)) * height) + padding);
  return {
    bounds: imageBounds,
    width,
    height,
    pxMin,
    pxMax,
    pyMin,
    pyMax,
    winWidth: Math.max(1, pxMax - pxMin),
    winHeight: Math.max(1, pyMax - pyMin),
  };
}

export class GeotiffProvider implements RasterProvider {
  readonly id: string;
  readonly crs: string;
  readonly bounds: [number, number, number, number];
  readonly width: number;
  readonly height: number;
  readonly bandCount: number;
  readonly dtype: string;

  private tiff: Awaited<ReturnType<typeof fromArrayBuffer>>;
  private image: Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>;
  private noData?: number;
  private imageCache = new globalThis.Map<
    number,
    Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>
  >();

  private constructor(
    id: string,
    tiff: Awaited<ReturnType<typeof fromArrayBuffer>>,
    image: Awaited<ReturnType<Awaited<ReturnType<typeof fromArrayBuffer>>['getImage']>>,
    crs: string,
  ) {
    this.id = id;
    this.tiff = tiff;
    this.image = image;
    this.width = image.getWidth();
    this.height = image.getHeight();
    this.bandCount = image.getSamplesPerPixel();
    this.dtype = inferDtype(image);
    this.crs = crs;
    this.bounds = boundsFromImage(image);
    this.noData = parseNoData(image);
    this.imageCache.set(0, image);
  }

  static async fromSource(source: SourceInput): Promise<GeotiffProvider> {
    if (typeof source === 'string') {
      const tiff = await fromUrl(source, { allowFullFile: false });
      const image = await tiff.getImage();
      const crs = await parseGeoKeys(image);
      return new GeotiffProvider(source, tiff, image, crs);
    }
    if (source instanceof ArrayBuffer) {
      const tiff = await fromArrayBuffer(source);
      const image = await tiff.getImage();
      const crs = await parseGeoKeys(image);
      return new GeotiffProvider('buffer', tiff, image, crs);
    }
    const tiff = await fromBlob(source);
    const image = await tiff.getImage();
    const crs = await parseGeoKeys(image);
    return new GeotiffProvider(source.name, tiff, image, crs);
  }

  async close(): Promise<void> {
    await this.tiff.close?.();
  }

  async readWindow(
    bounds: [number, number, number, number],
    bands?: number[],
    options?: { maxSize?: number; width?: number; height?: number },
  ): Promise<RasterWindow> {
    const selected = bands ?? Array.from({ length: this.bandCount }, (_, i) => i + 1);
    const padding = 1;
    let readImage = this.image;
    let readWindow = pixelWindowForImage(readImage, bounds, this.bounds, padding);
    if (
      !Number.isFinite(readWindow.pxMin) ||
      !Number.isFinite(readWindow.pxMax) ||
      !Number.isFinite(readWindow.pyMin) ||
      !Number.isFinite(readWindow.pyMax) ||
      readWindow.pxMin >= readWindow.pxMax ||
      readWindow.pyMin >= readWindow.pyMax
    ) {
      return {
        width: 1,
        height: 1,
        bands: selected.length,
        data: selected.map(() => Float32Array.from([Number.NaN])),
        geotransform: [bounds[0], 1, 0, bounds[3], 0, -1],
        crs: this.crs,
        noData: this.noData,
      };
    }
    let outWidth = options?.width ?? readWindow.winWidth;
    let outHeight = options?.height ?? readWindow.winHeight;
    if (!options?.width && !options?.height && options?.maxSize) {
      const scale = Math.min(
        1,
        options.maxSize / Math.max(readWindow.winWidth, readWindow.winHeight),
      );
      outWidth = Math.max(1, Math.round(readWindow.winWidth * scale));
      outHeight = Math.max(1, Math.round(readWindow.winHeight * scale));
    }

    readImage = await this.selectOverview(
      readWindow.winWidth,
      readWindow.winHeight,
      outWidth,
      outHeight,
    );
    readWindow = pixelWindowForImage(readImage, bounds, this.bounds, padding);
    outWidth = Math.min(outWidth, readWindow.winWidth);
    outHeight = Math.min(outHeight, readWindow.winHeight);

    const rasters = await readImage.readRasters({
      window: [readWindow.pxMin, readWindow.pyMin, readWindow.pxMax, readWindow.pyMax],
      samples: selected.map((b) => b - 1),
      interleave: false,
      width: outWidth,
      height: outHeight,
    });

    const data = (Array.isArray(rasters) ? rasters : [rasters]).map((band) =>
      Float32Array.from(band as ArrayLike<number>),
    );

    const [bxmin, bymin, bxmax, bymax] = readWindow.bounds;
    const sourcePixelWidth = (bxmax - bxmin) / readWindow.width;
    const sourcePixelHeight = (bymax - bymin) / readWindow.height;
    const originX = bxmin + readWindow.pxMin * sourcePixelWidth;
    const originY = bymax - readWindow.pyMin * sourcePixelHeight;
    const pixelWidth = (readWindow.winWidth * sourcePixelWidth) / outWidth;
    const pixelHeight = (readWindow.winHeight * sourcePixelHeight) / outHeight;

    return {
      width: outWidth,
      height: outHeight,
      bands: selected.length,
      data,
      geotransform: [originX, pixelWidth, 0, originY, 0, -pixelHeight],
      crs: this.crs,
      noData: this.noData,
    };
  }

  private async getImage(index: number) {
    const cached = this.imageCache.get(index);
    if (cached) return cached;
    const image = await this.tiff.getImage(index);
    this.imageCache.set(index, image);
    return image;
  }

  private async selectOverview(
    sourceWinWidth: number,
    sourceWinHeight: number,
    outWidth: number,
    outHeight: number,
  ) {
    const count = (await this.tiff.getImageCount?.()) ?? 1;
    let selected = this.image;

    for (let index = 1; index < count; index++) {
      const candidate = await this.getImage(index);
      const candidateWinWidth = sourceWinWidth * (candidate.getWidth() / this.width);
      const candidateWinHeight = sourceWinHeight * (candidate.getHeight() / this.height);
      if (candidateWinWidth < outWidth || candidateWinHeight < outHeight) break;
      selected = candidate;
    }

    return selected;
  }
}
