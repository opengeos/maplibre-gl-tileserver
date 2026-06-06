import { LRUCache } from 'lru-cache';

export interface MemoryCacheOptions {
  maxTiles: number;
}

export class MemoryTileCache {
  private cache: LRUCache<string, Uint8Array>;

  constructor(options: MemoryCacheOptions) {
    this.cache = new LRUCache<string, Uint8Array>({
      max: options.maxTiles,
      sizeCalculation: (value) => value.byteLength,
      maxSize: options.maxTiles * 256 * 256 * 4,
    });
  }

  get(key: string): Uint8Array | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: Uint8Array): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
