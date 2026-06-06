import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export class FilesystemTileCache {
  private root: string;

  constructor(namespace = 'maplibre-gl-raster') {
    this.root = join(homedir(), '.cache', namespace, 'tiles');
  }

  private pathForKey(key: string): string {
    const prefix = key.slice(0, 2);
    return join(this.root, prefix, key);
  }

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    try {
      const data = await readFile(this.pathForKey(key));
      return new Uint8Array(data);
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const filePath = this.pathForKey(key);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, value);
  }

  async has(key: string): Promise<boolean> {
    try {
      await access(this.pathForKey(key));
      return true;
    } catch {
      return false;
    }
  }
}
