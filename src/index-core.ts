import type { TileServerConfig, TileServerInstance } from './types.js';
import { TileServerConfigSchema } from './types.js';
import { TileOrchestrator } from './orchestrator.js';
import { createFastifyApp } from './server/app.js';
import { TileCache } from './cache/index.js';
import type { FastifyInstance } from 'fastify';

export async function createTileServer(config: TileServerConfig): Promise<TileServerInstance> {
  const parsed = TileServerConfigSchema.parse(config);
  const cache = new TileCache(parsed.cache);
  const orchestrator = new TileOrchestrator({
    source: parsed.source,
    tileMatrixSet: parsed.tileMatrixSet,
    tileSize: parsed.tileSize,
    tms: parsed.tms,
    cache,
  });
  await orchestrator.init();

  let app: FastifyInstance | undefined;
  const port = parsed.port;
  const host = parsed.host;
  const baseUrl = () => `http://localhost:${port}`;

  return {
    tileUrl: `${baseUrl()}/tiles/{z}/{x}/{y}.png`,
    metadataUrl: `${baseUrl()}/metadata`,
    boundsUrl: `${baseUrl()}/bounds`,
    statisticsUrl: `${baseUrl()}/statistics`,
    getMetadata: () => orchestrator.getMetadata(),
    getStatistics: () => orchestrator.getStatistics(),
    getBounds: () => orchestrator.getBounds(),
    getTile: (request) => orchestrator.getTile(request),
    start: async () => {
      app = await createFastifyApp(orchestrator);
      await app.listen({ port, host });
    },
    stop: async () => {
      await app?.close();
      await orchestrator.close();
    },
  };
}

export { TileOrchestrator } from './orchestrator.js';
export { registerCustomTileMatrixSet } from './tilematrix/custom.js';
