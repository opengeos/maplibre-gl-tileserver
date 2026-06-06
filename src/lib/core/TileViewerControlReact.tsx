import { useEffect, useRef } from 'react';
import { TileViewerControl } from './TileViewerControl';
import type { TileViewerControlOptions } from './TileViewerControl';
import type { PluginControlReactProps } from './types';

export interface TileViewerControlReactProps
  extends TileViewerControlOptions,
    Pick<PluginControlReactProps, 'map' | 'onStateChange'> {}

export function TileViewerControlReact({
  map,
  onStateChange,
  ...options
}: TileViewerControlReactProps): null {
  const controlRef = useRef<TileViewerControl | null>(null);

  useEffect(() => {
    if (!map) return;

    const control = new TileViewerControl(options);
    controlRef.current = control;

    if (onStateChange) {
      control.on('statechange', (event) => {
        onStateChange(event.state);
      });
    }

    map.addControl(control, options.position || 'top-right');

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!controlRef.current || options.collapsed === undefined) return;
    const currentState = controlRef.current.getState();
    if (options.collapsed === currentState.collapsed) return;
    if (options.collapsed) {
      controlRef.current.collapse();
    } else {
      controlRef.current.expand();
    }
  }, [options.collapsed]);

  return null;
}
