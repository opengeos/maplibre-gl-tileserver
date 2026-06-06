import type { RenderParams, TileRequest } from './types.js';
import { TileOrchestrator } from './orchestrator.js';
import type { SourceInput } from './providers/types.js';
import { TileCache } from './cache/index.js';

export class RasterSource {
  private orchestrator: TileOrchestrator;

  private constructor(orchestrator: TileOrchestrator) {
    this.orchestrator = orchestrator;
  }

  static async fromUrl(url: string, options?: { tileMatrixSet?: string; cache?: TileCache }): Promise<RasterSource> {
    return RasterSource.fromSource(url, options);
  }

  static async fromSource(
    source: SourceInput,
    options?: { tileMatrixSet?: string; cache?: TileCache },
  ): Promise<RasterSource> {
    const orchestrator = new TileOrchestrator({
      source,
      tileMatrixSet: options?.tileMatrixSet,
      cache: options?.cache ?? new TileCache(),
    });
    await orchestrator.init();
    return new RasterSource(orchestrator);
  }

  getMetadata() {
    return this.orchestrator.getMetadata();
  }

  getStatistics() {
    return this.orchestrator.getStatistics();
  }

  getBounds() {
    return this.orchestrator.getBounds();
  }

  getTile(z: number, x: number, y: number, render: Partial<RenderParams> = {}) {
    const request: TileRequest = {
      z,
      x,
      y,
      render: {
        format: 'png',
        ...render,
      },
    };
    return this.orchestrator.getTile(request);
  }

  async close(): Promise<void> {
    await this.orchestrator.close();
  }
}
