import { MemoryTileCache } from './memory.js';
import { IndexedDBTileCache } from './indexeddb.js';
import { buildTileCacheKey, type TileCacheKeyInput } from './key.js';

export interface TileCacheOptions {
  memory?: number;
  persistent?: boolean;
}

interface PersistentTileCache {
  init?: () => Promise<void>;
  get: (key: string) => Promise<Uint8Array | undefined>;
  set: (key: string, value: Uint8Array) => Promise<void>;
}

type FsPromises = typeof import('node:fs/promises');
type PathModule = typeof import('node:path');
type OsModule = typeof import('node:os');

const nodeImport = new Function('specifier', 'return import(specifier)') as <T>(
  specifier: string,
) => Promise<T>;

class FilesystemTileCache implements PersistentTileCache {
  private root?: string;
  private fs?: Pick<FsPromises, 'access' | 'mkdir' | 'readFile' | 'writeFile'>;
  private join?: PathModule['join'];

  constructor(private namespace = 'maplibre-gl-raster') {}

  async init(): Promise<void> {
    const [fs, path, os] = await Promise.all([
      nodeImport<FsPromises>('node:fs/promises'),
      nodeImport<PathModule>('node:path'),
      nodeImport<OsModule>('node:os'),
    ]);
    this.fs = fs;
    this.join = path.join;
    this.root = path.join(os.homedir(), '.cache', this.namespace, 'tiles');
    await fs.mkdir(this.root, { recursive: true });
  }

  private pathForKey(key: string): string {
    if (!this.root || !this.join) {
      throw new Error('Filesystem tile cache has not been initialized');
    }
    const prefix = key.slice(0, 2);
    return this.join(this.root, prefix, key);
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    if (!this.fs) {
      throw new Error('Filesystem tile cache has not been initialized');
    }
    try {
      const data = await this.fs.readFile(this.pathForKey(key));
      return new Uint8Array(data);
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    if (!this.fs || !this.join) {
      throw new Error('Filesystem tile cache has not been initialized');
    }
    const filePath = this.pathForKey(key);
    await this.fs.mkdir(this.join(filePath, '..'), { recursive: true });
    await this.fs.writeFile(filePath, value);
  }
}

export class TileCache {
  private memory: MemoryTileCache;
  private persistent?: PersistentTileCache;
  private usePersistent: boolean;
  private useFilesystemPersistent: boolean;

  constructor(options: TileCacheOptions = {}) {
    this.memory = new MemoryTileCache({ maxTiles: options.memory ?? 256 });
    this.usePersistent = options.persistent ?? true;
    this.useFilesystemPersistent = this.usePersistent && typeof window === 'undefined';
    if (this.usePersistent) {
      this.persistent = typeof indexedDB !== 'undefined' ? new IndexedDBTileCache() : undefined;
    }
  }

  async init(): Promise<void> {
    if (this.useFilesystemPersistent && !this.persistent) {
      this.persistent = new FilesystemTileCache();
    }
    await this.persistent?.init?.();
  }

  buildKey(input: TileCacheKeyInput): string {
    return buildTileCacheKey(input);
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const mem = this.memory.get(key);
    if (mem) return mem;
    if (!this.persistent) return undefined;
    const disk = await this.persistent.get(key);
    if (disk) this.memory.set(key, disk);
    return disk;
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    this.memory.set(key, value);
    await this.persistent?.set(key, value);
  }
}

export { buildTileCacheKey, buildSourceId } from './key.js';
