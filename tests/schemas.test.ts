import { describe, expect, it } from 'vitest';
import { TileParamsSchema, TileQuerySchema, parseRenderParams } from '../src/server/schemas.js';

describe('server schemas', () => {
  it('parses tile route params', () => {
    const params = TileParamsSchema.parse({ z: '2', x: '1', y: '0', ext: 'png' });
    expect(params).toEqual({ z: 2, x: 1, y: 0, ext: 'png' });
  });

  it('parses render query params', () => {
    const query = TileQuerySchema.parse({
      bands: '1,2,3',
      rescale: '0,3000',
      colormap: 'viridis',
      gamma: '1.2',
      hillshade: 'true',
    });
    const render = parseRenderParams(query, 'png');
    expect(render.bands).toEqual([1, 2, 3]);
    expect(render.rescale).toEqual([0, 3000]);
    expect(render.colormap).toBe('viridis');
    expect(render.hillshade).toBe(true);
  });
});
