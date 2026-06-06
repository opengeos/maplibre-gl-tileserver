export interface RasterWindow {
  width: number;
  height: number;
  bands: number;
  data: Float32Array[];
  geotransform: [number, number, number, number, number, number];
  crs: string;
  noData?: number;
}

export interface RasterProvider {
  readonly id: string;
  readonly crs: string;
  readonly bounds: [number, number, number, number];
  readonly width: number;
  readonly height: number;
  readonly bandCount: number;
  readonly dtype: string;
  close(): Promise<void>;
  readWindow(
    bounds: [number, number, number, number],
    bands?: number[],
    options?: { maxSize?: number; width?: number; height?: number },
  ): Promise<RasterWindow>;
}

export type SourceInput = string | ArrayBuffer | File;

export function isRemoteUrl(source: SourceInput): source is string {
  return typeof source === 'string' && /^https?:\/\//i.test(source);
}

export function isGeotiffSource(source: SourceInput): boolean {
  if (typeof source !== 'string') return true;
  const path = isRemoteUrl(source) ? (source.split('?')[0] ?? source) : source;
  const lower = path.toLowerCase();
  return lower.endsWith('.tif') || lower.endsWith('.tiff') || lower.endsWith('.cog');
}

export const UNSUPPORTED_EXTENSIONS = ['.nc', '.hdf', '.h5', '.hdf5', '.jp2', '.j2k'];

export function detectUnsupportedExtension(source: string): string | null {
  const lower = source.toLowerCase().split('?')[0] ?? source;
  for (const ext of UNSUPPORTED_EXTENSIONS) {
    if (lower.endsWith(ext)) return ext;
  }
  return null;
}
