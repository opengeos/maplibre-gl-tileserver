import { z } from 'zod';
import type { RenderParams, TileFormat } from '../types.js';

export const TileParamsSchema = z.object({
  z: z.coerce.number().int().nonnegative(),
  x: z.coerce.number().int().nonnegative(),
  y: z.coerce.number().int().nonnegative(),
  ext: z.enum(['png', 'jpg', 'jpeg', 'webp']).default('png'),
});

export const TileQuerySchema = z.object({
  bands: z.string().optional(),
  rescale: z.string().optional(),
  colormap: z.string().optional(),
  gamma: z.coerce.number().positive().optional(),
  contrast: z.coerce.number().optional(),
  hillshade: z
    .union([z.literal('true'), z.literal('false'), z.coerce.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true'),
});

export function parseRenderParams(query: z.infer<typeof TileQuerySchema>, format: TileFormat): RenderParams {
  const bands = query.bands?.split(',').map((value) => Number.parseInt(value.trim(), 10)).filter(Boolean);
  const rescale = query.rescale?.split(',').map(Number) as [number, number] | undefined;
  return {
    bands,
    rescale: rescale?.length === 2 ? rescale : undefined,
    colormap: query.colormap,
    gamma: query.gamma,
    contrast: query.contrast,
    hillshade: query.hillshade,
    format,
  };
}

export const CreateServerBodySchema = z.object({
  source: z.string(),
  tileMatrixSet: z.string().default('WebMercatorQuad'),
  port: z.number().int().positive().default(8000),
});
