import type { TileMatrixSet } from '@developmentseed/morecantile';

const customRegistry = new Map<string, TileMatrixSet>();

export function registerCustomTileMatrixSet(tms: TileMatrixSet): void {
  const id = tms.id ?? 'custom';
  customRegistry.set(id, { ...tms, id });
}

export function loadCustomTileMatrixSet(id: string): TileMatrixSet {
  const registered = customRegistry.get(id);
  if (registered) return registered;

  throw new Error(
    `Unknown TileMatrixSet "${id}". Register it with registerCustomTileMatrixSet() or use WebMercatorQuad / WorldCRS84Quad.`,
  );
}
