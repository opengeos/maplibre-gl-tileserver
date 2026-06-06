# Examples

Interactive demos for **maplibre-gl-raster**. Start the dev server from the project root, then open the landing page or an example directly.

## Available Examples

| Example | Path | Description |
|---------|------|-------------|
| GeoTIFF Viewer | `/examples/geotiff-viewer/` | Local GeoTIFF via the tile server API |
| COG Viewer | `/examples/cog-viewer/` | Remote Cloud Optimized GeoTIFF |
| DEM Hillshade | `/examples/dem-hillshade/` | Single-band DEM with hillshade |
| MapLibre Integration | `/examples/maplibre/` | `createMapLibreRasterSource` helper |
| React Viewer | `/examples/react/` | Collapsible control with React hooks |

## Running Examples

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) for the example index.

Some examples expect a local tile server on port 8000:

```bash
node dist/cli.mjs tests/fixtures/sample.tif --port 8000
```

## Building Examples

```bash
npm run build:examples
```

Built output is written to `dist-examples/` for GitHub Pages deployment.
