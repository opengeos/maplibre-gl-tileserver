import type { TileMatrixSet } from '@developmentseed/morecantile';

const WEB_MERCATOR_ORIGIN = 20037508.342789244;

export const WEB_MERCATOR_QUAD: TileMatrixSet = {
  id: 'WebMercatorQuad',
  title: 'Google Maps Compatible',
  crs: {
    uri: 'http://www.opengis.net/def/crs/EPSG/0/3857',
  },
  wellKnownScaleSet: 'http://www.opengis.net/def/wkss/OGC/1.0/GoogleMapsCompatible',
  tileMatrices: Array.from({ length: 24 }, (_, z) => {
    const scaleDenominator = 559082264.0287178 / 2 ** z;
    const cellSize = (WEB_MERCATOR_ORIGIN * 2) / (256 * 2 ** z);
    return {
      id: String(z),
      scaleDenominator,
      cellSize,
      pointOfOrigin: [0, 0] as [number, number],
      tileWidth: 256,
      tileHeight: 256,
      matrixWidth: 2 ** z,
      matrixHeight: 2 ** z,
    };
  }),
};

export const WORLD_CRS84_QUAD: TileMatrixSet = {
  id: 'WorldCRS84Quad',
  title: 'World CRS84 Quad',
  crs: {
    uri: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
  },
  wellKnownScaleSet: 'http://www.opengis.net/def/wkss/OGC/1.0/WorldCRS84Quad',
  tileMatrices: Array.from({ length: 24 }, (_, z) => {
    const matrixWidth = 2 ** (z + 1);
    const matrixHeight = 2 ** z;
    const cellSize = 360 / matrixWidth;
    return {
      id: String(z),
      scaleDenominator: cellSize * (96 / 0.0254),
      cellSize,
      pointOfOrigin: [-180, 90] as [number, number],
      tileWidth: 256,
      tileHeight: 256,
      matrixWidth,
      matrixHeight,
    };
  }),
};

export const BUILTIN_TILE_MATRIX_SETS: Record<string, TileMatrixSet> = {
  WebMercatorQuad: WEB_MERCATOR_QUAD,
  WorldCRS84Quad: WORLD_CRS84_QUAD,
};
