import { Log } from '../../deps/bp_logger';
import { NalType, NalUnit } from './nal-unit';

export interface NALUHeader {
  nri: number;
  type: number;
}

export class NALUAsm {
  public fragmentedNalu: NalUnit;

  constructor() {
    this.fragmentedNalu = null;
  }

  public static parseNALHeader(hdr: number): NALUHeader {
    return {
      nri: hdr & 0x60,
      type: hdr & 0x1f,
    };
  }

  public parseSingleNALUPacket(rawData: Uint8Array, header: NALUHeader, dts: number, pts: number) {
    return new NalUnit(header.type, header.nri, rawData.subarray(0), dts, pts);
  }

  public parseAggregationPacket(rawData: Uint8Array, header: NALUHeader, dts: number, pts: number): NalUnit[] {
    const data = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
    let startIndex = 0;
    // let don: number = 0;
    if (NalType.STAP_B === header.type) {
      //  don = data.getUint16(nal_start_idx);
      startIndex += 2;
    }
    const ret = [];
    while (startIndex < data.byteLength) {
      const size = data.getUint16(startIndex);
      startIndex += 2;
      const header = NALUAsm.parseNALHeader(data.getInt8(startIndex));
      startIndex++;
      const nalu = this.parseSingleNALUPacket(rawData.subarray(startIndex, startIndex + size), header, dts, pts);
      if (nalu !== null) {
        ret.push(nalu);
      }
      startIndex += size;
    }
    return ret;
  }

  public parseFragmentationUnit(rawData: Uint8Array, header: NALUHeader, dts: number, pts: number): NalUnit {
    const data = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
    let startIndex = 0;
    const fuHeader = data.getUint8(startIndex);
    const isStart = (fuHeader & 0x80) >>> 7;
    const isEnd = (fuHeader & 0x40) >>> 6;
    const payloadType = fuHeader & 0x1f;
    let ret: NalUnit = null;

    startIndex++;
    // let don = 0;
    if (NalType.FU_B === header.type) {
      // don = data.getUint16(nal_start_idx);
      startIndex += 2;
    }

    if (isStart) {
      this.fragmentedNalu = new NalUnit(payloadType, header.nri, rawData.subarray(startIndex), dts, pts);
    }
    if (this.fragmentedNalu && this.fragmentedNalu.type === payloadType) {
      if (!isStart) {
        this.fragmentedNalu.appendData(rawData.subarray(startIndex));
      }
      if (isEnd) {
        ret = this.fragmentedNalu;
        this.fragmentedNalu = null;
        return ret;
      }
    }
    return null;
  }

  public onNALUFragment(rawData: Uint8Array, dts: number, pts: number = 0): NalUnit[] {
    const data = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);

    const header = NALUAsm.parseNALHeader(data.getUint8(0));

    const startIndex = 1;

    let unit: NalUnit = null;
    if (header.type > 0 && header.type < 24) {
      unit = this.parseSingleNALUPacket(rawData.subarray(startIndex), header, dts, pts);
    } else if (NalType.FU_A === header.type || NalType.FU_B === header.type) {
      unit = this.parseFragmentationUnit(rawData.subarray(startIndex), header, dts, pts);
    } else if (NalType.STAP_A === header.type || NalType.STAP_B === header.type) {
      return this.parseAggregationPacket(rawData.subarray(startIndex), header, dts, pts);
    } else {
      /* 30 - 31 is undefined, ignore those (RFC3984). */
      Log.log('Undefined NAL unit, type: ' + header.type);
      return null;
    }
    if (unit) {
      return [unit];
    }
    return null;
  }
}
