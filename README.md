# maplibre-gl-tileserver

Pure TypeScript XYZ/TMS raster tile server powered by **GDAL WebAssembly** and **geotiff.js**, built for **MapLibre GL JS** applications.

## Features

- GDAL WASM raster reading, reprojection, and PNG/JPEG/WebP encoding
- Hybrid COG/GeoTIFF remote reads via `geotiff.js` HTTP range requests
- Fastify tile server with `/metadata`, `/statistics`, `/bounds`, and `/tiles/{z}/{x}/{y}.{format}`
- OGC Tile Matrix Sets: `WebMercatorQuad`, `WorldCRS84Quad`, custom TMS registration
- Rendering options: band selection, rescale, colormaps, hillshade, gamma, contrast
- Memory LRU cache and persistent cache (IndexedDB in browser, filesystem in Node)
- Browser `RasterSource` API and MapLibre helper `createMapLibreRasterSource`
- GeoLibre Desktop plugin bundle with collapsible MapLibre control

## Install

```bash
npm install maplibre-gl-tileserver
```

## CLI

```bash
maplibre-gl-tileserver tests/fixtures/sample.tif --port 8000 --tileMatrixSet WebMercatorQuad
```

## Node.js server API

```typescript
import { createTileServer } from "maplibre-gl-tileserver";

const server = await createTileServer({
  source: "image.tif",
  tileMatrixSet: "WebMercatorQuad",
  port: 8000,
});

await server.start();
console.log(server.tileUrl);
```

## Browser API

```typescript
import { RasterSource } from "maplibre-gl-tileserver/browser";

const source = await RasterSource.fromUrl("https://example.com/image.tif");
const tile = await source.getTile(10, 312, 420, { format: "png", rescale: [0, 3000] });
```

## MapLibre integration

```typescript
import { createMapLibreRasterSource } from "maplibre-gl-tileserver/maplibre";

const spec = await createMapLibreRasterSource({ source: "image.tif" });
map.addSource("raster", spec.source);
map.addLayer(spec.layer);
```

## HTTP endpoints

| Route | Description |
|---|---|
| `GET /tiles/:z/:x/:y.png\|jpg\|webp` | Raster tile |
| `GET /metadata` | Dataset metadata |
| `GET /statistics` | Band statistics |
| `GET /bounds` | Dataset bounds |
| `GET /health` | Health check |

Tile query params: `bands`, `rescale`, `colormap`, `gamma`, `contrast`, `hillshade`.

## Format support

| Format | Support |
|---|---|
| GeoTIFF / COG | Yes (local GDAL WASM + remote geotiff.js) |
| VRT, GRIB, Zarr | Yes via bundled GDAL WASM |
| NetCDF, HDF5, JPEG2000 | Not in bundled GDAL WASM (roadmap) |

## Development

```bash
npm install
npm test
npm run build
npm run dev
npm run build:examples
npm run test:e2e
```

## Examples

- `examples/geotiff-viewer`
- `examples/cog-viewer`
- `examples/dem-hillshade`
- `examples/maplibre`
- `examples/react`

Start a local tile server for the GeoTIFF examples:

```bash
npm run build
node dist/cli.mjs tests/fixtures/sample.tif --port 8000
```

## GeoLibre plugin

```bash
npm run package:geolibre
```

## License

MIT. Includes LGPL-2.1 `gdal3.js` WebAssembly runtime (loaded dynamically).
