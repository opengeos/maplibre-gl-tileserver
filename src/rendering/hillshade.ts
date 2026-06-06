import { clamp } from './stretch.js';

export interface HillshadeOptions {
  azimuth?: number;
  altitude?: number;
  zFactor?: number;
}

export function computeHillshade(
  elevation: Float32Array,
  width: number,
  height: number,
  cellSizeX = 1,
  cellSizeY = 1,
  options: HillshadeOptions = {},
): Uint8ClampedArray {
  const azimuth = ((options.azimuth ?? 315) * Math.PI) / 180;
  const altitude = ((options.altitude ?? 45) * Math.PI) / 180;
  const zFactor = options.zFactor ?? 1;
  const out = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const z1 = sample(elevation, width, height, x - 1, y - 1);
      const z2 = sample(elevation, width, height, x, y - 1);
      const z3 = sample(elevation, width, height, x + 1, y - 1);
      const z4 = sample(elevation, width, height, x - 1, y);
      const z6 = sample(elevation, width, height, x + 1, y);
      const z7 = sample(elevation, width, height, x - 1, y + 1);
      const z8 = sample(elevation, width, height, x, y + 1);
      const z9 = sample(elevation, width, height, x + 1, y + 1);

      const dzdx = ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8 * cellSizeX);
      const dzdy = ((z7 + 2 * z8 + z9) - (z1 + 2 * z2 + z3)) / (8 * cellSizeY);
      const slope = Math.atan(zFactor * Math.sqrt(dzdx * dzdx + dzdy * dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      const shaded =
        Math.sin(altitude) * Math.cos(slope) +
        Math.cos(altitude) * Math.sin(slope) * Math.cos(azimuth - aspect);
      out[idx] = Math.round(clamp((shaded + 1) / 2, 0, 1) * 255);
    }
  }

  return out;
}

function sample(data: Float32Array, width: number, height: number, x: number, y: number): number {
  const sx = clamp(x, 0, width - 1);
  const sy = clamp(y, 0, height - 1);
  return data[sy * width + sx] ?? 0;
}
