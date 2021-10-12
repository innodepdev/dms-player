import { getTagged } from '../../deps/bp_logger';

/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
 */

const logger = getTagged('util:exp');
export class ExpGolomb {
  public data: Uint8Array;
  public bytesAvailable: number;
  public bitsAvailable: number;
  public word: number;

  constructor(data: Uint8Array) {
    this.data = data;
    // the number of bytes left to examine in this.data
    this.bytesAvailable = this.data.byteLength;
    // the current word being examined
    this.word = 0; // :uint
    // the number of bits left to examine in the current word
    this.bitsAvailable = 0; // :uint
  }

  // ():void
  public loadWord(): void {
    const position = this.data.byteLength - this.bytesAvailable,
      workingBytes = new Uint8Array(4),
      availableBytes = Math.min(4, this.bytesAvailable);
    if (availableBytes === 0) {
      throw new Error('no bytes available');
    }
    workingBytes.set(this.data.subarray(position, position + availableBytes));
    this.word = new DataView(workingBytes.buffer, workingBytes.byteOffset, workingBytes.byteLength).getUint32(0);
    // track the amount of this.data that has been processed
    this.bitsAvailable = availableBytes * 8;
    this.bytesAvailable -= availableBytes;
  }

  // (count:int):void
  public skipBits(count: number): void {
    let skipBytes: number; // :int
    if (this.bitsAvailable > count) {
      this.word <<= count;
      this.bitsAvailable -= count;
    } else {
      count -= this.bitsAvailable;
      skipBytes = count >> 3;
      count -= skipBytes << 3;
      this.bytesAvailable -= skipBytes;
      this.loadWord();
      this.word <<= count;
      this.bitsAvailable -= count;
    }
  }

  // (size:int):uint
  public readBits(size: number): number {
    let bits = Math.min(this.bitsAvailable, size); // :uint
    const valu = this.word >>> (32 - bits); // :uint
    if (size > 32) {
      logger.error('Cannot read more than 32 bits at a time');
    }
    this.bitsAvailable -= bits;
    if (this.bitsAvailable > 0) {
      this.word <<= bits;
    } else if (this.bytesAvailable > 0) {
      this.loadWord();
    }
    bits = size - bits;
    if (bits > 0) {
      return (valu << bits) | this.readBits(bits);
    } else {
      return valu;
    }
  }

  // ():uint
  public skipLZ(): number {
    let leadingZeroCount: number; // :uint
    for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
      if (0 !== (this.word & (0x80000000 >>> leadingZeroCount))) {
        // the first bit of working word is 1
        this.word <<= leadingZeroCount;
        this.bitsAvailable -= leadingZeroCount;
        return leadingZeroCount;
      }
    }
    // we exhausted word and still have not found a 1
    this.loadWord();
    return leadingZeroCount + this.skipLZ();
  }

  // ():void
  public skipUEG(): void {
    this.skipBits(1 + this.skipLZ());
  }

  // ():void
  public skipEG(): void {
    this.skipBits(1 + this.skipLZ());
  }

  // ():uint
  public readUEG(): number {
    const clz = this.skipLZ(); // :uint
    return this.readBits(clz + 1) - 1;
  }

  // ():int
  public readEG(): number {
    const valu = this.readUEG(); // :int
    if (0x01 & valu) {
      // the number is odd if the low order bit is set
      return (1 + valu) >>> 1; // add 1 to make it even, and divide by 2
    } else {
      return -1 * (valu >>> 1); // divide by two then make it negative
    }
  }

  // Some convenience functions
  // :Boolean
  public readBoolean(): boolean {
    return 1 === this.readBits(1);
  }

  // ():int
  public readUByte(): number {
    return this.readBits(8);
  }

  // ():int
  public readUShort(): number {
    return this.readBits(16);
  }
  // ():int
  public readUInt(): number {
    return this.readBits(32);
  }
}
