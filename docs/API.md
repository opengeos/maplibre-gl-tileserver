# API Reference

## `createTileServer(config)`

Creates a Fastify-backed tile server instance.

```typescript
import { createTileServer } from 'maplibre-gl-raster';

const server = await createTileServer({
  source: 'data.tif',
  tileMatrixSet: 'WebMercatorQuad',
  port: 8000,
});
await server.start();
```

## `RasterSource`

Browser-side tile access without running Fastify.

```typescript
import { RasterSource } from 'maplibre-gl-raster/browser';

const source = await RasterSource.fromUrl('https://example.com/cog.tif');
const bytes = await source.getTile(8, 120, 85);
```

## `createMapLibreRasterSource(options)`

Returns `{ source, layer }` objects for MapLibre GL JS.

## Tile query parameters

- `bands=1,2,3`
- `rescale=0,3000`
- `colormap=viridis`
- `gamma=1.2`
- `contrast=0.2`
- `hillshade=true`

## Subpath exports

| Import path | Purpose |
|---|---|
| `maplibre-gl-raster` | Server factory and core types |
| `maplibre-gl-raster/browser` | Browser `RasterSource` |
| `maplibre-gl-raster/maplibre` | MapLibre helpers |
| `maplibre-gl-raster/server` | Fastify plugin only |
| `maplibre-gl-raster/react` | React control helpers |
