import { describe, expect, it } from 'vitest';
import {
  applyContrast,
  applyGamma,
  autoStretchRange,
  rescaleValue,
  stretchBand,
} from '../src/rendering/stretch.js';
import { applyColormap, grayscaleToRgb } from '../src/rendering/colormap.js';
import { computeHillshade } from '../src/rendering/hillshade.js';
import { renderWindow } from '../src/rendering/pipeline.js';
import { encodePng } from '../src/rendering/encode.js';

describe('rendering', () => {
  it('rescales values between min and max', () => {
    expect(rescaleValue(50, 0, 100)).toBeCloseTo(0.5);
    expect(rescaleValue(-10, 0, 100)).toBe(0);
    expect(rescaleValue(200, 0, 100)).toBe(1);
  });

  it('auto-stretches band data', () => {
    const data = Float32Array.from([0, 50, 100]);
    const [min, max] = autoStretchRange(data);
    expect(min).toBe(0);
    expect(max).toBe(100);
    const stretched = stretchBand(data, min, max);
    expect(stretched[1]).toBe(128);
  });

  it('applies gamma and contrast', () => {
    expect(applyGamma(0.5, 2)).toBeCloseTo(Math.pow(0.5, 0.5));
    expect(applyContrast(0.5, 0.2)).toBeGreaterThan(0);
  });

  it('maps grayscale to rgb', () => {
    const gray = Uint8ClampedArray.from([0, 128, 255]);
    const rgb = grayscaleToRgb(gray);
    expect(rgb.length).toBe(9);
    expect(rgb[0]).toBe(0);
    expect(rgb[4]).toBe(128);
  });

  it('applies colormap', () => {
    const values = Uint8ClampedArray.from([0, 128, 255]);
    const rgb = applyColormap(values, 'viridis');
    expect(rgb.length).toBe(9);
    expect(rgb[0]).not.toBe(rgb[3]);
  });

  it('computes hillshade', () => {
    const width = 4;
    const height = 4;
    const elevation = Float32Array.from({ length: width * height }, (_, i) => i);
    const shaded = computeHillshade(elevation, width, height);
    expect(shaded.length).toBe(width * height);
    expect(shaded.some((v) => v > 0)).toBe(true);
  });

  it('renders rgb window', () => {
    const width = 2;
    const height = 2;
    const rendered = renderWindow(
      {
        width,
        height,
        bands: 3,
        data: [
          Float32Array.from([0, 1, 2, 3]),
          Float32Array.from([0, 1, 2, 3]),
          Float32Array.from([0, 1, 2, 3]),
        ],
        geotransform: [0, 1, 0, 0, 0, -1],
        crs: 'EPSG:3857',
      },
      { format: 'png', bands: [1, 2, 3] },
    );
    expect(rendered.rgba.length).toBe(width * height * 4);
  });

  it('encodes png bytes with signature', () => {
    const rgba = Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255]);
    const png = encodePng(1, 2, rgba);
    expect(png[0]).toBe(137);
    expect(png[1]).toBe(80);
    expect(png[2]).toBe(78);
  });
});
