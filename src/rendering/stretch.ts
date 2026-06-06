export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function rescaleValue(value: number, srcMin: number, srcMax: number): number {
  if (srcMax === srcMin) return 0;
  return clamp((value - srcMin) / (srcMax - srcMin), 0, 1);
}

export function applyGamma(value: number, gamma: number): number {
  return Math.pow(clamp(value, 0, 1), 1 / gamma);
}

export function applyContrast(value: number, contrast: number): number {
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  return clamp((factor * (value * 255 - 128) + 128) / 255, 0, 1);
}

export function computePercentile(values: Float32Array, percentile: number): number {
  const sorted = Array.from(values).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = clamp(Math.floor((percentile / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx] ?? 0;
}

export function stretchBand(
  data: Float32Array,
  min: number,
  max: number,
  noData?: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    const value = data[i]!;
    if (noData !== undefined && value === noData) {
      out[i] = 0;
      continue;
    }
    out[i] = Math.round(rescaleValue(value, min, max) * 255);
  }
  return out;
}

export function autoStretchRange(data: Float32Array, noData?: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const value = data[i]!;
    if (!Number.isFinite(value) || (noData !== undefined && value === noData)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  return [min, max];
}
