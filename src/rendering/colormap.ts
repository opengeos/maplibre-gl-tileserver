import { interpolateViridis, interpolatePlasma, interpolateInferno, interpolateMagma, interpolateTurbo, interpolateGreys } from 'd3-scale-chromatic';

const COLORMAPS: Record<string, (t: number) => string> = {
  viridis: interpolateViridis,
  plasma: interpolatePlasma,
  inferno: interpolateInferno,
  magma: interpolateMagma,
  turbo: interpolateTurbo,
  grayscale: interpolateGreys,
  grey: interpolateGreys,
  gray: interpolateGreys,
};

function parseColor(hex: string): [number, number, number] {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

export function applyColormap(
  values: Uint8ClampedArray,
  name: string,
): Uint8ClampedArray {
  const fn = COLORMAPS[name.toLowerCase()] ?? interpolateViridis;
  const out = new Uint8ClampedArray(values.length * 3);
  for (let i = 0; i < values.length; i++) {
    const [r, g, b] = parseColor(fn(values[i]! / 255));
    const idx = i * 3;
    out[idx] = r;
    out[idx + 1] = g;
    out[idx + 2] = b;
  }
  return out;
}

export function grayscaleToRgb(values: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(values.length * 3);
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    const idx = i * 3;
    out[idx] = v;
    out[idx + 1] = v;
    out[idx + 2] = v;
  }
  return out;
}

export function mergeRgbBands(r: Uint8ClampedArray, g: Uint8ClampedArray, b: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(r.length * 3);
  for (let i = 0; i < r.length; i++) {
    const idx = i * 3;
    out[idx] = r[i]!;
    out[idx + 1] = g[i]!;
    out[idx + 2] = b[i]!;
  }
  return out;
}
