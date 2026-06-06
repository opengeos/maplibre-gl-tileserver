import type { RenderParams } from '../types.js';
import type { RasterWindow } from '../providers/types.js';
import { applyContrast, applyGamma, autoStretchRange, stretchBand } from './stretch.js';
import { applyColormap, grayscaleToRgb, mergeRgbBands } from './colormap.js';
import { computeHillshade } from './hillshade.js';

export interface RenderedImage {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export function renderWindow(window: RasterWindow, params: RenderParams): RenderedImage {
  const bands = params.bands ?? [1, 2, 3].filter((b) => b <= window.bands);
  if (bands.length === 0) bands.push(1);

  const noData = window.noData;
  let rgb: Uint8ClampedArray;

  if (params.hillshade) {
    const elevation = window.data[0]!;
    const shaded = computeHillshade(elevation, window.width, window.height);
    rgb = grayscaleToRgb(shaded);
  } else if (bands.length >= 3 && window.bands >= 3 && !params.colormap) {
    const ranges = bands.slice(0, 3).map((band, i) => {
      const data = window.data[i] ?? window.data[band - 1]!;
      return params.rescale ?? autoStretchRange(data, noData);
    });
    const channels = bands.slice(0, 3).map((band, i) => {
      const data = window.data[i] ?? window.data[band - 1]!;
      const [min, max] = ranges[i]!;
      return stretchBand(data, min, max, noData);
    });
    rgb = mergeRgbBands(channels[0]!, channels[1]!, channels[2]!);
  } else {
    const data = window.data[bands[0]! - 1] ?? window.data[0]!;
    const [min, max] = params.rescale ?? autoStretchRange(data, noData);
    let values = stretchBand(data, min, max, noData);
    if (params.gamma && params.gamma !== 1) {
      values = new Uint8ClampedArray(
        values.map((v) => Math.round(applyGamma(v / 255, params.gamma!) * 255)),
      );
    }
    if (params.contrast) {
      values = new Uint8ClampedArray(
        values.map((v) => Math.round(applyContrast(v / 255, params.contrast!) * 255)),
      );
    }
    rgb = params.colormap ? applyColormap(values, params.colormap) : grayscaleToRgb(values);
  }

  const rgba = new Uint8ClampedArray(window.width * window.height * 4);
  for (let i = 0; i < window.width * window.height; i++) {
    rgba[i * 4] = rgb[i * 3]!;
    rgba[i * 4 + 1] = rgb[i * 3 + 1]!;
    rgba[i * 4 + 2] = rgb[i * 3 + 2]!;
    const alphaSource = window.data[0]?.[i];
    rgba[i * 4 + 3] =
      alphaSource === undefined ||
      !Number.isFinite(alphaSource) ||
      (noData !== undefined && alphaSource === noData)
        ? 0
        : 255;
  }

  return { width: window.width, height: window.height, rgba };
}
