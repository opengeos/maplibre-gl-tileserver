import type { IControl, Map as MapLibreMap } from 'maplibre-gl';

export const CARTODB_POSITRON_STYLE = {
  version: 8,
  sources: {
    'cartodb-positron': {
      type: 'raster',
      tiles: [
        'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'cartodb-positron',
      type: 'raster',
      source: 'cartodb-positron',
    },
  ],
} as const;

const GOOGLE_SATELLITE_SOURCE_ID = 'google-satellite';
const GOOGLE_SATELLITE_LAYER_ID = 'google-satellite';
const CONTROL_STYLE_ID = 'example-basemap-switcher-style';

function ensureBasemapSwitcherStyles(): void {
  if (document.getElementById(CONTROL_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = CONTROL_STYLE_ID;
  style.textContent = `
    .example-basemap-switcher {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    }
    .example-basemap-switcher button {
      min-width: 70px;
      height: 28px;
      border: 0;
      border-radius: 3px;
      background: transparent;
      color: #233142;
      font: 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
    }
    .example-basemap-switcher button.active {
      background: #2f7ed8;
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

function addGoogleSatelliteLayer(map: MapLibreMap): void {
  if (!map.getSource(GOOGLE_SATELLITE_SOURCE_ID)) {
    map.addSource(GOOGLE_SATELLITE_SOURCE_ID, {
      type: 'raster',
      tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
      tileSize: 256,
      maxzoom: 20,
      attribution: 'Imagery © Google',
    });
  }

  if (!map.getLayer(GOOGLE_SATELLITE_LAYER_ID)) {
    map.addLayer({
      id: GOOGLE_SATELLITE_LAYER_ID,
      type: 'raster',
      source: GOOGLE_SATELLITE_SOURCE_ID,
      layout: { visibility: 'none' },
    });
  }
}

class BasemapSwitcherControl implements IControl {
  private map?: MapLibreMap;
  private container?: HTMLElement;
  private positronButton?: HTMLButtonElement;
  private satelliteButton?: HTMLButtonElement;
  private selected: 'positron' | 'satellite' = 'positron';

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map;
    ensureBasemapSwitcherStyles();

    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl example-basemap-switcher';

    this.positronButton = this.createButton('Positron', 'positron');
    this.satelliteButton = this.createButton('Satellite', 'satellite');
    container.append(this.positronButton, this.satelliteButton);
    this.container = container;
    this.sync();

    return container;
  }

  onRemove(): void {
    this.container?.remove();
    this.map = undefined;
    this.container = undefined;
  }

  private createButton(label: string, mode: 'positron' | 'satellite'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      this.selected = mode;
      this.sync();
    });
    return button;
  }

  sync(): void {
    this.positronButton?.classList.toggle('active', this.selected === 'positron');
    this.satelliteButton?.classList.toggle('active', this.selected === 'satellite');
    if (this.map?.getLayer(GOOGLE_SATELLITE_LAYER_ID)) {
      this.map.setLayoutProperty(
        GOOGLE_SATELLITE_LAYER_ID,
        'visibility',
        this.selected === 'satellite' ? 'visible' : 'none',
      );
    }
  }
}

export function addExampleBasemaps(map: MapLibreMap): void {
  const control = new BasemapSwitcherControl();
  const addLayer = () => {
    addGoogleSatelliteLayer(map);
    control.sync();
  };
  if (map.isStyleLoaded()) {
    addLayer();
  } else {
    map.once('load', addLayer);
  }

  map.addControl(control, 'bottom-left');
}
