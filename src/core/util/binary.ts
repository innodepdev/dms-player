export function appendByteArray(buffer1: Uint8Array, buffer2: Uint8Array) {
  const tmp = new Uint8Array((buffer1.byteLength | 0) + (buffer2.byteLength | 0));
  tmp.set(buffer1, 0);
  tmp.set(buffer2, buffer1.byteLength | 0);
  return tmp;
}

export function appendByteArrayAsync(buffer1: Uint8Array, buffer2: Uint8Array) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer1, buffer2]);
    const reader = new FileReader();
    reader.addEventListener('loadend', () => {
      resolve();
    });
    reader.readAsArrayBuffer(blob);
  });
}
export function base64ToArrayBuffer(base64: string) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export function hexToByteArray(hex: string) {
  const len = hex.length >> 1;
  const bufView = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bufView[i] = parseInt(hex.substr(i << 1, 2), 16);
  }
  return bufView;
}

export function concatenate(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function bitSlice(bytearray: Uint8Array, start = 0, end = bytearray.byteLength * 8) {
  const byteLen = Math.ceil((end - start) / 8);
  const res = new Uint8Array(byteLen);
  const startByte = start >>> 3; // /8
  const endByte = (end >>> 3) - 1; // /8
  const bitOffset = start & 0x7; // %8
  const nBitOffset = 8 - bitOffset;
  const endOffset = (8 - end) & 0x7; // %8
  for (let i = 0; i < byteLen; ++i) {
    let tail = 0;
    if (i < endByte) {
      tail = bytearray[startByte + i + 1] >> nBitOffset;
      if (i === endByte - 1 && endOffset < 8) {
        tail >>= endOffset;
        tail <<= endOffset;
      }
    }
    res[i] = (bytearray[startByte + i] << bitOffset) | tail;
  }
  return res;
}

export class BitArray {
  public src: DataView;
  public bitpos: number;
  public byte: number;
  public bytepos: number;

  constructor(src: Uint8Array) {
    this.src = new DataView(src.buffer, src.byteOffset, src.byteLength);
    this.bitpos = 0;
    this.byte = this.src.getUint8(0); /* This should really be undefined, uint wont allow it though */
    this.bytepos = 0;
  }

  public readBits(length: number) {
    if (32 < (length | 0) || 0 === (length | 0)) {
      /* To big for an uint */
      throw new Error('too big');
    }

    let result = 0;
    for (let i = length; i > 0; --i) {
      /* Shift result one left to make room for another bit,
             then add the next bit on the stream. */
      result = ((result | 0) << 1) | (((this.byte | 0) >> (8 - ++this.bitpos)) & 0x01);
      if ((this.bitpos | 0) >= 8) {
        this.byte = this.src.getUint8(++this.bytepos);
        this.bitpos &= 0x7;
      }
    }

    return result;
  }
  public skipBits(length: number) {
    this.bitpos += (length | 0) & 0x7; // %8
    this.bytepos += (length | 0) >>> 3; // *8
    if (this.bitpos > 7) {
      this.bitpos &= 0x7;
      ++this.bytepos;
    }

    if (!this.finished()) {
      this.byte = this.src.getUint8(this.bytepos);
      return 0;
    } else {
      return this.bytepos - this.src.byteLength - this.bitpos;
    }
  }

  public finished(): boolean {
    return this.bytepos >= this.src.byteLength;
  }
}
