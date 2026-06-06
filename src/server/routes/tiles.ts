import type { FastifyInstance } from 'fastify';
import type { TileOrchestrator } from '../../orchestrator.js';
import { TileOutOfBoundsError } from '../../types.js';
import { parseRenderParams, TileParamsSchema, TileQuerySchema } from '../schemas.js';

export async function registerTileRoutes(app: FastifyInstance, orchestrator: TileOrchestrator): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/metadata', async () => orchestrator.getMetadata());
  app.get('/bounds', async () => orchestrator.getBounds());
  app.get('/statistics', async () => orchestrator.getStatistics());

  app.get<{
    Params: { z: string; x: string; y: string; ext: string };
    Querystring: Record<string, string | undefined>;
  }>('/tiles/:z/:x/:y.:ext', async (request, reply) => {
    const params = TileParamsSchema.parse({
      ...request.params,
      ext: request.params.ext,
    });
    const query = TileQuerySchema.parse(request.query);
    const render = parseRenderParams(query, params.ext === 'jpeg' ? 'jpg' : params.ext);

    try {
      const bytes = await orchestrator.getTile({
        z: params.z,
        x: params.x,
        y: params.y,
        render,
      });
      const contentType =
        params.ext === 'png'
          ? 'image/png'
          : params.ext === 'webp'
            ? 'image/webp'
            : 'image/jpeg';
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(Buffer.from(bytes));
    } catch (error) {
      if (error instanceof TileOutOfBoundsError) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });
}
