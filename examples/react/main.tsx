import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl, { Map } from 'maplibre-gl';
import { TileViewerControlReact } from '../../src/lib/core/TileViewerControlReact';
import { addExampleBasemaps, CARTODB_POSITRON_STYLE } from '../shared/basemaps';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: CARTODB_POSITRON_STYLE,
      center: [32.776, 39.91],
      zoom: 10,
    });

    addExampleBasemaps(mapInstance);
    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstance.on('load', () => setMap(mapInstance));
    return () => mapInstance.remove();
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {map ? (
        <TileViewerControlReact
          map={map}
          collapsed={false}
          title="Raster Viewer"
          defaultMode="file"
        />
      ) : null}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
