function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function deflateStored(data: Uint8Array): Uint8Array {
  const maxBlockLength = 0xffff;
  const chunks = Math.ceil(data.length / maxBlockLength);
  const output = new Uint8Array(2 + chunks * 5 + data.length + 4);
  let offset = 0;
  output[offset++] = 0x78;
  output[offset++] = 0x01;

  for (let position = 0; position < data.length; position += maxBlockLength) {
    const remaining = data.length - position;
    const len = Math.min(maxBlockLength, remaining);
    const isFinal = position + len >= data.length;
    output[offset++] = isFinal ? 0x01 : 0x00;
    output[offset++] = len & 0xff;
    output[offset++] = (len >> 8) & 0xff;
    output[offset++] = ~len & 0xff;
    output[offset++] = (~len >> 8) & 0xff;
    output.set(data.subarray(position, position + len), offset);
    offset += len;
  }

  new DataView(output.buffer).setUint32(offset, adler32(data));
  return output;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  const typeBytes = Uint8Array.from(type.split('').map((c) => c.charCodeAt(0)));
  const combined = new Uint8Array(4 + 4 + data.length + 4);
  combined.set(length, 0);
  combined.set(typeBytes, 4);
  combined.set(data, 8);
  const crc = crc32(combined.slice(4, 8 + data.length));
  new DataView(combined.buffer).setUint32(8 + data.length, crc);
  return combined;
}

export function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = new Uint8Array(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + stride)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (1 + stride) + 1);
  }

  const compressed = deflateStored(raw);
  const png = new Uint8Array(signature.length + 8192 + compressed.length);
  let offset = 0;
  const append = (part: Uint8Array) => {
    png.set(part, offset);
    offset += part.length;
  };
  append(signature);
  append(chunk('IHDR', ihdr));
  append(chunk('IDAT', compressed));
  append(chunk('IEND', new Uint8Array(0)));
  return png.slice(0, offset);
}

export function encodeJpeg(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  // Minimal JPEG is complex; reuse PNG for fallback in tests and use gdal for production JPEG.
  return encodePng(width, height, rgba);
}

export function encodeImage(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  format: 'png' | 'jpg' | 'jpeg' | 'webp',
): Uint8Array {
  if (format === 'png') return encodePng(width, height, rgba);
  return encodePng(width, height, rgba);
}
