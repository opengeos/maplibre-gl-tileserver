import maplibregl from 'maplibre-gl';
import { TileViewerControl } from '../../src/lib/core/TileViewerControl';
import { addExampleBasemaps, CARTODB_POSITRON_STYLE } from '../shared/basemaps';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
  style: CARTODB_POSITRON_STYLE,
  center: [-119.5, 37.7],
  zoom: 9,
});

addExampleBasemaps(map);

map.addControl(
  new TileViewerControl({
    collapsed: false,
    title: 'DEM Hillshade',
    defaultMode: 'server',
    showHillshade: true,
    rescale: '0,3000',
    colormap: 'gray',
    serverUrl: 'http://localhost:8000',
  }),
  'top-right',
);
