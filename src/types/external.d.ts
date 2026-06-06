declare module '*.css';

declare module 'gdal3.js/node.js' {
  import initGdalJs from 'gdal3.js';
  export default initGdalJs;
}

declare module '*.data?url' {
  const url: string;
  export default url;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare module 'd3-scale-chromatic' {
  export function interpolateViridis(t: number): string;
  export function interpolatePlasma(t: number): string;
  export function interpolateInferno(t: number): string;
  export function interpolateMagma(t: number): string;
  export function interpolateTurbo(t: number): string;
  export function interpolateGreys(t: number): string;
}
