import type { Map as MapLibreMap } from 'maplibre-gl';
import { PluginControl } from './PluginControl';
import type { PluginControlOptions } from './types';
import type { DatasetMetadata, RenderParams } from '../../types.js';
import { RasterSource } from '../../browser.js';
import { transformBounds } from '../../gdal/reprojection.js';
import {
  addRasterLayerToMap,
  buildBrowserTileUrl,
  buildServerTileUrl,
  registerBrowserTileLayer,
  unregisterBrowserTileLayer,
  updateBrowserTileLayerRender,
} from '../browser-tile-protocol.js';

export type TileViewerSourceMode = 'file' | 'url' | 'server';

export interface TileViewerControlOptions extends PluginControlOptions {
  rescale?: string;
  colormap?: string;
  showHillshade?: boolean;
  defaultMode?: TileViewerSourceMode;
  serverUrl?: string;
  sampleUrl?: string;
  opacity?: number;
}

const SOURCE_ID = 'mlts-raster-source';
const LAYER_ID = 'mlts-raster-layer';
const REGISTRY_ID = 'viewer';
const COLORMAP_OPTIONS = ['viridis', 'plasma', 'inferno', 'magma', 'turbo', 'gray'];

function parseRescaleInput(value: string): [number, number] | undefined {
  const parts = value.split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
    return [parts[0]!, parts[1]!];
  }
  return undefined;
}

function buildRenderParams(options: {
  rescale?: string;
  colormap?: string;
  showHillshade?: boolean;
}): Partial<RenderParams> {
  return {
    format: 'png',
    rescale: options.rescale ? parseRescaleInput(options.rescale) : undefined,
    colormap: options.colormap || undefined,
    hillshade: options.showHillshade ?? false,
  };
}

function defaultRescaleFromStatistics(stats: Record<string, { min: number; max: number }>): string {
  const first = stats.band1 ?? Object.values(stats)[0];
  if (!first) return '0,255';
  return `${Math.floor(first.min)},${Math.ceil(first.max)}`;
}

function shouldReadStatisticsBeforeRender(metadata: DatasetMetadata): boolean {
  return metadata.width * metadata.height <= 50_000_000;
}

function fallbackRescaleFromMetadata(metadata: DatasetMetadata, current: string): string {
  if (current && current !== '0,3000') return current;
  if (metadata.bands === 1 && (metadata.dtype.startsWith('uint8') || metadata.dtype.startsWith('int8'))) {
    return '0,100';
  }
  if (metadata.dtype.startsWith('uint8') || metadata.dtype.startsWith('int8')) return '0,255';
  return current || '0,255';
}

export class TileViewerControl extends PluginControl {
  private viewerOptions: Required<
    Pick<TileViewerControlOptions, 'rescale' | 'colormap' | 'showHillshade' | 'serverUrl' | 'opacity'>
  > &
    Pick<TileViewerControlOptions, 'sampleUrl' | 'defaultMode'>;

  private mode: TileViewerSourceMode;
  private loaded = false;
  private browserMode = true;
  private metadata?: DatasetMetadata;
  private mapBounds?: [number, number, number, number];

  private fileInput?: HTMLInputElement;
  private urlInput?: HTMLInputElement;
  private serverInput?: HTMLInputElement;
  private rescaleInput?: HTMLInputElement;
  private colormapSelect?: HTMLSelectElement;
  private hillshadeInput?: HTMLInputElement;
  private opacityInput?: HTMLInputElement;
  private loadButton?: HTMLButtonElement;
  private clearButton?: HTMLButtonElement;
  private statusEl?: HTMLElement;
  private metadataEl?: HTMLElement;
  private modeButtons = new globalThis.Map<TileViewerSourceMode, HTMLButtonElement>();

  constructor(options?: TileViewerControlOptions) {
    super({
      ...options,
      title: options?.title ?? 'Raster Viewer',
      panelWidth: options?.panelWidth ?? 320,
    });
    this.viewerOptions = {
      rescale: options?.rescale ?? '0,3000',
      colormap: options?.colormap ?? 'viridis',
      showHillshade: options?.showHillshade ?? false,
      serverUrl: options?.serverUrl ?? 'http://localhost:8000',
      opacity: options?.opacity ?? 0.85,
      sampleUrl: options?.sampleUrl,
      defaultMode: options?.defaultMode ?? 'file',
    };
    this.mode = this.viewerOptions.defaultMode ?? 'file';
    this.setState({
      data: {
        mode: this.mode,
        rescale: this.viewerOptions.rescale,
        colormap: this.viewerOptions.colormap,
        showHillshade: this.viewerOptions.showHillshade,
        loaded: false,
      },
    });
  }

  protected createPanelContent(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'tile-viewer-panel';

    root.appendChild(this.createModeSwitcher());
    root.appendChild(this.createSourceSection());
    root.appendChild(this.createDivider());
    root.appendChild(this.createRenderSection());
    root.appendChild(this.createDivider());
    root.appendChild(this.createActionSection());
    root.appendChild(this.createStatusSection());

    this.syncModeUi();
    return root;
  }

  protected onBeforeRemove(): void {
    void this.clearLayer();
  }

  private createModeSwitcher(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'plugin-control-group tile-viewer-mode-switch';

    const label = document.createElement('span');
    label.className = 'plugin-control-label';
    label.textContent = 'Source type';
    group.appendChild(label);

    const buttons = document.createElement('div');
    buttons.className = 'tile-viewer-mode-buttons';

    for (const [mode, text] of [
      ['file', 'Local file'],
      ['url', 'Remote URL'],
      ['server', 'Tile server'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile-viewer-mode-button';
      button.textContent = text;
      button.addEventListener('click', () => {
        this.mode = mode;
        this.syncModeUi();
        this.setState({ data: { ...this.getState().data, mode } });
      });
      this.modeButtons.set(mode, button);
      buttons.appendChild(button);
    }

    group.appendChild(buttons);
    return group;
  }

  private createSourceSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'plugin-control-group tile-viewer-source-section';

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.tif,.tiff,.cog,.geotiff,image/tiff';
    this.fileInput.className = 'tile-viewer-file-input';
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput?.files?.[0]) {
        this.setStatus(`Selected ${this.fileInput.files[0].name}`);
      }
    });

    const fileButton = document.createElement('button');
    fileButton.type = 'button';
    fileButton.className = 'plugin-control-button tile-viewer-file-button';
    fileButton.textContent = 'Choose GeoTIFF…';
    fileButton.addEventListener('click', () => this.fileInput?.click());

    this.urlInput = document.createElement('input');
    this.urlInput.type = 'url';
    this.urlInput.className = 'plugin-control-input';
    this.urlInput.placeholder = 'https://example.com/data.tif';
    if (this.viewerOptions.sampleUrl) {
      this.urlInput.value = this.viewerOptions.sampleUrl;
    }

    this.serverInput = document.createElement('input');
    this.serverInput.type = 'url';
    this.serverInput.className = 'plugin-control-input';
    this.serverInput.placeholder = 'http://localhost:8000';
    this.serverInput.value = this.viewerOptions.serverUrl;

    section.appendChild(this.fileInput);
    section.appendChild(fileButton);
    section.appendChild(this.urlInput);
    section.appendChild(this.serverInput);
    return section;
  }

  private createRenderSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'plugin-control-flex-col';

    this.rescaleInput = document.createElement('input');
    this.rescaleInput.type = 'text';
    this.rescaleInput.className = 'plugin-control-input';
    this.rescaleInput.value = this.viewerOptions.rescale;
    this.rescaleInput.placeholder = 'min,max';
    section.appendChild(this.createField('Rescale', this.rescaleInput));

    this.colormapSelect = document.createElement('select');
    this.colormapSelect.className = 'plugin-control-input';
    for (const name of COLORMAP_OPTIONS) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === this.viewerOptions.colormap) option.selected = true;
      this.colormapSelect.appendChild(option);
    }
    section.appendChild(this.createField('Colormap', this.colormapSelect));

    const hillshadeWrap = document.createElement('label');
    hillshadeWrap.className = 'tile-viewer-checkbox';
    this.hillshadeInput = document.createElement('input');
    this.hillshadeInput.type = 'checkbox';
    this.hillshadeInput.checked = this.viewerOptions.showHillshade;
    hillshadeWrap.appendChild(this.hillshadeInput);
    hillshadeWrap.append(' Hillshade');
    section.appendChild(hillshadeWrap);

    this.opacityInput = document.createElement('input');
    this.opacityInput.type = 'range';
    this.opacityInput.className = 'tile-viewer-opacity';
    this.opacityInput.min = '0';
    this.opacityInput.max = '100';
    this.opacityInput.value = String(Math.round(this.viewerOptions.opacity * 100));
    this.opacityInput.addEventListener('input', () => this.applyOpacity());
    section.appendChild(this.createField('Opacity', this.opacityInput));

    return section;
  }

  private createActionSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'plugin-control-flex';

    this.loadButton = document.createElement('button');
    this.loadButton.type = 'button';
    this.loadButton.className = 'plugin-control-button';
    this.loadButton.textContent = 'Load raster';
    this.loadButton.addEventListener('click', () => {
      void this.loadRaster();
    });

    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.className = 'plugin-control-button tile-viewer-secondary-button';
    this.clearButton.textContent = 'Clear';
    this.clearButton.disabled = true;
    this.clearButton.addEventListener('click', () => {
      void this.clearLayer();
    });

    section.appendChild(this.loadButton);
    section.appendChild(this.clearButton);
    return section;
  }

  private createStatusSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'tile-viewer-status-section';

    this.statusEl = document.createElement('p');
    this.statusEl.className = 'tile-viewer-status';
    this.statusEl.textContent = 'Choose a source and click Load raster.';

    this.metadataEl = document.createElement('div');
    this.metadataEl.className = 'tile-viewer-metadata';

    section.appendChild(this.statusEl);
    section.appendChild(this.metadataEl);
    return section;
  }

  private createField(labelText: string, input: HTMLElement): HTMLElement {
    const group = document.createElement('div');
    group.className = 'plugin-control-group';
    const label = document.createElement('label');
    label.className = 'plugin-control-label';
    label.textContent = labelText;
    group.appendChild(label);
    group.appendChild(input);
    return group;
  }

  private createDivider(): HTMLElement {
    const divider = document.createElement('div');
    divider.className = 'plugin-control-divider';
    return divider;
  }

  private syncModeUi(): void {
    for (const [mode, button] of this.modeButtons) {
      button.classList.toggle('active', mode === this.mode);
    }

    const fileButton = this.fileInput?.nextElementSibling as HTMLElement | null;
    if (this.fileInput) this.fileInput.style.display = 'none';
    if (fileButton) fileButton.style.display = this.mode === 'file' ? 'inline-flex' : 'none';
    if (this.urlInput) this.urlInput.style.display = this.mode === 'url' ? 'block' : 'none';
    if (this.serverInput) this.serverInput.style.display = this.mode === 'server' ? 'block' : 'none';
  }

  private getRenderParams(): Partial<RenderParams> {
    return buildRenderParams({
      rescale: this.rescaleInput?.value ?? this.viewerOptions.rescale,
      colormap: this.colormapSelect?.value ?? this.viewerOptions.colormap,
      showHillshade: this.hillshadeInput?.checked ?? this.viewerOptions.showHillshade,
    });
  }

  private getOpacity(): number {
    const value = Number.parseInt(this.opacityInput?.value ?? '85', 10);
    return Number.isFinite(value) ? value / 100 : this.viewerOptions.opacity;
  }

  private setStatus(message: string, isError = false): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.classList.toggle('error', isError);
  }

  private setLoading(loading: boolean): void {
    if (this.loadButton) {
      this.loadButton.disabled = loading;
      this.loadButton.textContent = loading ? 'Loading…' : this.loaded ? 'Apply render' : 'Load raster';
    }
  }

  private updateMetadata(metadata: DatasetMetadata): void {
    this.metadata = metadata;
    if (!this.metadataEl) return;
    this.metadataEl.innerHTML = `
      <div><strong>Size:</strong> ${metadata.width} × ${metadata.height}</div>
      <div><strong>Bands:</strong> ${metadata.bands} (${metadata.dtype})</div>
      <div><strong>CRS:</strong> ${metadata.crs}</div>
      <div><strong>Zoom:</strong> ${metadata.minzoom}–${metadata.maxzoom}</div>
    `;
  }

  private async loadRaster(): Promise<void> {
    const map = this.getMap();
    if (!map) {
      this.setStatus('Map is not ready yet.', true);
      return;
    }

    this.setLoading(true);
    try {
      await this.waitForMapStyle(map);

      if (this.loaded && this.browserMode) {
        await this.applyBrowserRender(map);
        return;
      }

      if (this.mode === 'server') {
        await this.loadFromServer(map);
      } else {
        await this.loadFromBrowserSource(map);
      }

      this.loaded = true;
      if (this.clearButton) this.clearButton.disabled = false;
      this.setState({
        data: {
          mode: this.mode,
          loaded: true,
          ...this.getRenderParams(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load raster';
      this.setStatus(message, true);
    } finally {
      this.setLoading(false);
    }
  }

  private async loadFromBrowserSource(map: MapLibreMap): Promise<void> {
    const sourceInput = await this.resolveBrowserSource();
    this.setStatus('Initializing GDAL and reading metadata…');
    this.browserMode = true;

    await this.clearLayer(false);
    const raster = await RasterSource.fromSource(sourceInput);
    const metadata = await raster.getMetadata();
    const mapBounds = await this.getMapLibreBounds(metadata);

    let rescale = this.rescaleInput?.value ?? this.viewerOptions.rescale;
    if (shouldReadStatisticsBeforeRender(metadata)) {
      this.setStatus('Estimating raster statistics…');
      const stats = await raster.getStatistics();
      rescale = defaultRescaleFromStatistics(stats);
    } else {
      rescale = fallbackRescaleFromMetadata(metadata, rescale);
    }
    if (this.rescaleInput) this.rescaleInput.value = rescale;

    this.setStatus('Adding raster layer…');
    const render = buildRenderParams({
      rescale,
      colormap: this.colormapSelect?.value,
      showHillshade: this.hillshadeInput?.checked,
    });

    const version = registerBrowserTileLayer(REGISTRY_ID, raster, render);
    const tileUrl = buildBrowserTileUrl(REGISTRY_ID, version);

    addRasterLayerToMap(map, {
      sourceId: SOURCE_ID,
      layerId: LAYER_ID,
      tileUrl,
      metadata: { ...metadata, bounds: mapBounds },
      opacity: this.getOpacity(),
    });

    map.fitBounds(
      [
        [mapBounds[0], mapBounds[1]],
        [mapBounds[2], mapBounds[3]],
      ],
      { padding: 40, duration: 800 },
    );

    this.mapBounds = mapBounds;
    this.updateMetadata(metadata);
    this.setStatus('Raster loaded in the browser.');
  }

  private async applyBrowserRender(map: MapLibreMap): Promise<void> {
    const render = this.getRenderParams();
    const version = updateBrowserTileLayerRender(REGISTRY_ID, render);
    const tileUrl = buildBrowserTileUrl(REGISTRY_ID, version);

    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    if (!this.metadata) {
      throw new Error('Raster metadata is unavailable');
    }
    const mapBounds = this.mapBounds ?? await this.getMapLibreBounds(this.metadata);

    addRasterLayerToMap(map, {
      sourceId: SOURCE_ID,
      layerId: LAYER_ID,
      tileUrl,
      metadata: { ...this.metadata, bounds: mapBounds },
      opacity: this.getOpacity(),
    });

    this.setStatus('Render settings applied.');
  }

  private async loadFromServer(map: MapLibreMap): Promise<void> {
    const baseUrl = (this.serverInput?.value ?? this.viewerOptions.serverUrl).trim();
    if (!baseUrl) {
      throw new Error('Enter a tile server URL');
    }

    this.setStatus('Fetching metadata from tile server…');
    this.browserMode = false;
    await this.clearLayer(false);

    const metadataResponse = await fetch(`${baseUrl.replace(/\/$/, '')}/metadata`);
    if (!metadataResponse.ok) {
      throw new Error(`Tile server metadata request failed (${metadataResponse.status})`);
    }
    const metadata = (await metadataResponse.json()) as DatasetMetadata;
    const mapBounds = await this.getMapLibreBounds(metadata);
    const render = this.getRenderParams();
    const tileUrl = buildServerTileUrl(baseUrl, render);

    addRasterLayerToMap(map, {
      sourceId: SOURCE_ID,
      layerId: LAYER_ID,
      tileUrl,
      metadata: { ...metadata, bounds: mapBounds },
      opacity: this.getOpacity(),
    });

    map.fitBounds(
      [
        [mapBounds[0], mapBounds[1]],
        [mapBounds[2], mapBounds[3]],
      ],
      { padding: 40, duration: 800 },
    );

    this.mapBounds = mapBounds;
    this.updateMetadata(metadata);
    this.setStatus(`Connected to ${baseUrl}`);
  }

  private async resolveBrowserSource(): Promise<string | File> {
    if (this.mode === 'url') {
      const url = this.urlInput?.value.trim();
      if (!url) throw new Error('Enter a raster URL');
      return url;
    }

    const file = this.fileInput?.files?.[0];
    if (!file) throw new Error('Choose a GeoTIFF file');
    return file;
  }

  private async waitForMapStyle(map: MapLibreMap): Promise<void> {
    if (map.isStyleLoaded() || map.getStyle()?.version) return;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        map.off('load', onLoad);
        map.off('styledata', onLoad);
        reject(new Error('Map style did not finish loading'));
      }, 30_000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        map.off('load', onLoad);
        map.off('styledata', onLoad);
      };
      const onLoad = () => {
        if (!map.getStyle()?.version) return;
        cleanup();
        resolve();
      };

      map.once('load', onLoad);
      map.once('styledata', onLoad);
    });
  }

  private async getMapLibreBounds(metadata: DatasetMetadata): Promise<[number, number, number, number]> {
    const bounds = await transformBounds(metadata.bounds, metadata.crs, 'EPSG:4326');
    const west = Math.max(-180, Math.min(180, bounds[0]));
    const south = Math.max(-90, Math.min(90, bounds[1]));
    const east = Math.max(-180, Math.min(180, bounds[2]));
    const north = Math.max(-90, Math.min(90, bounds[3]));
    if (west >= east || south >= north) {
      throw new Error(`Unable to transform raster bounds from ${metadata.crs} to longitude/latitude`);
    }
    return [west, south, east, north];
  }

  private applyOpacity(): void {
    const map = this.getMap();
    if (!map || !this.loaded || !map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(LAYER_ID, 'raster-opacity', this.getOpacity());
  }

  private async clearLayer(resetUi = true): Promise<void> {
    const map = this.getMap();
    if (map?.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map?.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    await unregisterBrowserTileLayer(REGISTRY_ID);

    this.loaded = false;
    this.browserMode = true;
    this.metadata = undefined;
    this.mapBounds = undefined;
    if (this.metadataEl) this.metadataEl.innerHTML = '';
    if (this.clearButton) this.clearButton.disabled = true;
    if (resetUi) {
      this.setStatus('Raster layer removed.');
      this.setLoading(false);
      this.setState({ data: { ...this.getState().data, loaded: false } });
    }
  }
}

export { PluginControl as TileViewerControlBase };
