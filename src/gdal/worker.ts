export type WorkerRequest =
  | { type: 'open'; source: string }
  | { type: 'tile'; z: number; x: number; y: number; render: Record<string, unknown> }
  | { type: 'metadata' }
  | { type: 'close' };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'tile'; bytes: Uint8Array }
  | { type: 'metadata'; metadata: Record<string, unknown> }
  | { type: 'error'; message: string };
