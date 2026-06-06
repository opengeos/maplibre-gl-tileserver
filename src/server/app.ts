import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { TileOrchestrator } from '../orchestrator.js';
import { registerTileRoutes } from './routes/tiles.js';

export async function createFastifyApp(orchestrator: TileOrchestrator) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await registerTileRoutes(app, orchestrator);
  return app;
}
