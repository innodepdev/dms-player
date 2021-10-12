import { appendByteArray } from '../util/binary';
import { DtsUnit } from './dts-unit';

export enum NalType {
  NDR = 1,
  SLICE_PART_A = 2,
  SLICE_PART_B = 3,
  SLICE_PART_C = 4,
  IDR = 5,
  SEI = 6,
  SPS = 7,
  PPS = 8,
  DELIMITER = 9,
  EOSEQ = 10,
  EOSTR = 11,
  FILTER = 12,
  STAP_A = 24,
  STAP_B = 25,
  FU_A = 28,
  FU_B = 29,
}

export class NalUnit extends DtsUnit {
  static get TYPES() {
    return {
      [NalType.IDR]: 'IDR',
      [NalType.SEI]: 'SEI',
      [NalType.SPS]: 'SPS',
      [NalType.PPS]: 'PPS',
      [NalType.NDR]: 'NDR',
    };
  }

  public static type(nalu: NalUnit) {
    if (nalu.type in NalUnit.TYPES) {
      return NalUnit.TYPES[nalu.type];
    } else {
      return 'UNKNOWN';
    }
  }

  private rawData: Uint8Array;
  public sliceType: number;

  constructor(nalType?: number, nri?: number, data?: Uint8Array, dts?: number, pts?: number, gs?: number) {
    super();
    if (data) {
      this.rawData = new Uint8Array(data.byteLength + 5);
      this.rawData.set([0, 0, 0, 1, (nri & 0x60) | (nalType & 0x1f)], 0);
      this.rawData.set(data, 5);
      this.dts = dts;
      this.pts = pts ? pts : this.dts;
      this.gs = gs;

      const view = new DataView(this.rawData.buffer, this.rawData.byteOffset, this.rawData.byteLength);
      view.setUint32(0, this.rawData.byteLength - 4);
    } else {
      this.rawData = undefined;
      this.dts = this.pts = null;
    }
  }

  public appendData(idata: Uint8Array) {
    this.rawData = appendByteArray(this.rawData, idata);
    const view = new DataView(this.rawData.buffer, this.rawData.byteOffset, this.rawData.byteLength);
    view.setUint32(0, this.rawData.byteLength - 4);
  }

  public setRawData(data: Uint8Array, pts: number, metaInfo: string) {
    this.rawData = data;
    const view = new DataView(this.rawData.buffer, this.rawData.byteOffset, this.rawData.byteLength);
    view.setUint32(0, this.rawData.byteLength - 4);
    this.dts = this.pts = pts;
    this.gs = (view.getUint8(4) & 0x1f) === NalType.SPS ? 1 : 0;
  }

  public toString() {
    return `${NalUnit.type(this)}(${this.rawData.byteLength}): NRI: ${this.nri}, PTS: ${this.pts}, DTS: ${this.dts}`;
  }

  public get nri(): number {
    return (this.rawData[4] & 0x60) >> 5;
  }

  public get type(): NalType {
    return this.rawData[4] & 0x1f;
  }

  public get isKeyframe(): boolean {
    return this.type === NalType.IDR || this.sliceType === 7;
  }

  public get size(): number {
    return this.rawData.byteLength;
  }

  public get data(): Uint8Array {
    return this.rawData;
  }
}
