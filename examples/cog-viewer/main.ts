import maplibregl from 'maplibre-gl';
import { TileViewerControl } from '../../src/lib/core/TileViewerControl';
import { addExampleBasemaps, CARTODB_POSITRON_STYLE } from '../shared/basemaps';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
  style: CARTODB_POSITRON_STYLE,
  center: [0, 0],
  zoom: 2,
});

addExampleBasemaps(map);

map.addControl(
  new TileViewerControl({
    collapsed: false,
    title: 'COG Viewer',
    defaultMode: 'url',
    colormap: 'viridis',
    sampleUrl:
      'https://cdn.jsdelivr.net/gh/cogeotiff/cog-spec@master/data/uint16.tif',
  }),
  'top-right',
);
