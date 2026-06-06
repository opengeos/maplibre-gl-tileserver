import maplibregl from 'maplibre-gl';
import { TileViewerControl } from '../../src/lib/core/TileViewerControl';
import { addExampleBasemaps, CARTODB_POSITRON_STYLE } from '../shared/basemaps';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
  style: CARTODB_POSITRON_STYLE,
  center: [32.776, 39.91],
  zoom: 10,
});

addExampleBasemaps(map);
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(
  new TileViewerControl({
    collapsed: false,
    title: 'GeoTIFF Viewer',
    defaultMode: 'server',
    serverUrl: 'http://localhost:8000',
  }),
  'top-right',
);
