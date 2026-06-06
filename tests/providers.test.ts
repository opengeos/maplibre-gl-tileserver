import { describe, expect, it } from 'vitest';
import { UnsupportedFormatError } from '../src/types.js';
import { detectUnsupportedExtension } from '../src/providers/types.js';

describe('providers', () => {
  it('detects unsupported extensions', () => {
    expect(detectUnsupportedExtension('data.nc')).toBe('.nc');
    expect(detectUnsupportedExtension('data.tif')).toBeNull();
  });

  it('throws unsupported format error', () => {
    const error = new UnsupportedFormatError('.hdf5');
    expect(error.name).toBe('UnsupportedFormatError');
    expect(error.message).toContain('HDF5');
  });
});
