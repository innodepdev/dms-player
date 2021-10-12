import { PayloadType } from '../defs';
import { BitArray } from '../util/binary';
import { PESAsm } from './pes';

export interface TrackType {
  type: number;
  offset: number;
}

export class PESType {
  static get AAC() {
    return 0x0f;
  } // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
  static get ID3() {
    return 0x15;
  } // Packetized metadata (ID3)
  static get H264() {
    return 0x1b;
  } // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
}

export class TSParser {
  static get PACKET_LENGTH() {
    return 188;
  }

  public pmtParsed: boolean = false;
  public pesParserTypes: { [id: string]: any } = {};
  public pesParsers: { [id: string]: any } = {};
  public pesAsms: PESAsm = new PESAsm();
  public ontracks: (track: Set<TrackType>) => void;
  public toSkip = 0;
  public pmtId: number = 0;

  public addPesParser(pesType, constructor) {
    this.pesParserTypes.set(pesType, constructor);
  }

  public parse(packet) {
    const bits = new BitArray(packet);
    if (packet[0] === 0x47) {
      bits.skipBits(9);
      const payStart = bits.readBits(1);
      bits.skipBits(1);
      const pid = bits.readBits(13);
      bits.skipBits(2);
      const adaptFlag = bits.readBits(1);
      const payFlag = bits.readBits(1);
      bits.skipBits(4);
      if (adaptFlag) {
        const adaptSize = bits.readBits(8);
        this.toSkip = bits.skipBits(adaptSize * 8);
        if (bits.finished()) {
          return;
        }
      }
      if (!payFlag) return;

      const payload = packet.subarray(bits.bytepos); // bitSlice(packet, bits.bitpos+bits.bytepos*8);

      if (this.pmtParsed && this.pesParsers.has(pid)) {
        const pes = this.pesAsms[pid].feed(payload, payStart);
        if (pes) {
          return this.pesParsers.get(pid).parse(pes);
        }
      } else {
        if (pid === 0) {
          this.pmtId = this.parsePAT(payload);
        } else if (pid === this.pmtId) {
          this.parsePMT(payload);
          this.pmtParsed = true;
        }
      }
    }
    return null;
  }

  public parsePAT(data: Uint8Array): number {
    const bits = new BitArray(data);
    const ptr = bits.readBits(8);
    bits.skipBits(8 * ptr + 83);
    return bits.readBits(13);
  }

  public parsePMT(data) {
    const bits = new BitArray(data);
    const ptr = bits.readBits(8);
    bits.skipBits(8 * ptr + 8);
    bits.skipBits(6);
    const secLen = bits.readBits(10);
    bits.skipBits(62);
    const pil = bits.readBits(10);
    bits.skipBits(pil * 8);

    const tracks = new Set<TrackType>();
    let readLen = secLen - 13 - pil;
    while (readLen > 0) {
      const pesType = bits.readBits(8);
      bits.skipBits(3);
      const pid = bits.readBits(13);
      bits.skipBits(6);
      const il = bits.readBits(10);
      bits.skipBits(il * 8);
      if ([PESType.AAC, PESType.H264].indexOf(pesType) >= 0) {
        if (this.pesParserTypes.has(pesType) && !this.pesParsers.has(pid)) {
          this.pesParsers.set(pid, new (this.pesParserTypes.get(pesType))());
          this.pesAsms[pid] = new PESAsm();
          switch (pesType) {
            case PESType.H264:
              tracks.add({
                type: PayloadType.H264,
                offset: 0,
              });
              break;
            case PESType.AAC:
              tracks.add({
                type: PayloadType.AAC,
                offset: 0,
              });
              break;
          }
        }
      }
      readLen -= 5 + il;
    }
    // TODO: notify about tracks
    if (this.ontracks) {
      this.ontracks(tracks);
    }
  }
}
