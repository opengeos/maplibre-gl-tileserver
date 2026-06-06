import type { RenderParams } from '../types.js';

export interface TileCacheKeyInput {
  sourceId: string;
  tileMatrixSet: string;
  z: number;
  x: number;
  y: number;
  render: RenderParams;
}

const encoder = new TextEncoder();

function hashBytes(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let seed = 0; seed < 8; seed++) {
    let hash = 0x811c9dc5 ^ seed;
    for (let index = 0; index < bytes.length; index++) {
      hash ^= bytes[index]!;
      hash = Math.imul(hash, 0x01000193);
    }
    parts.push((hash >>> 0).toString(16).padStart(8, '0'));
  }
  return parts.join('');
}

function hashString(value: string): string {
  return hashBytes(encoder.encode(value));
}

export function buildTileCacheKey(input: TileCacheKeyInput): string {
  const renderKey = JSON.stringify({
    bands: input.render.bands,
    rescale: input.render.rescale,
    colormap: input.render.colormap,
    gamma: input.render.gamma,
    contrast: input.render.contrast,
    hillshade: input.render.hillshade,
    format: input.render.format,
  });
  const raw = `${input.sourceId}|${input.tileMatrixSet}|${input.z}|${input.x}|${input.y}|${renderKey}`;
  return hashString(raw);
}

export function buildSourceId(source: string | ArrayBuffer | File): string {
  if (typeof source === 'string') return source;
  if (source instanceof ArrayBuffer) return hashBytes(new Uint8Array(source));
  return `${source.name}:${source.size}:${source.lastModified}`;
}
