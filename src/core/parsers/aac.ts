import { BitArray, bitSlice } from '../util/binary';

export interface AACConfig {
  config: Uint8Array;
  codec: string;
  samplerate: number;
  channels: number;
}
export class AACParser {
  public codec: string;

  static get SampleRates() {
    return [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  }

  // static Profile = [
  //     0: Null
  //     1: AAC Main
  //     2: AAC LC (Low Complexity)
  //     3: AAC SSR (Scalable Sample Rate)
  //     4: AAC LTP (Long Term Prediction)
  //     5: SBR (Spectral Band Replication)
  //     6: AAC Scalable
  // ]

  public static parseAudioSpecificConfig(bytesOrBits: Uint8Array | BitArray): AACConfig {
    const config: BitArray = bytesOrBits instanceof Uint8Array ? new BitArray(bytesOrBits) : bytesOrBits;

    const bitpos = config.bitpos + (config.src.byteOffset + config.bytepos) * 8;
    const prof = config.readBits(5);
    const sfi = config.readBits(4);
    if (sfi === 0xf) config.skipBits(24);
    const channels = config.readBits(4);

    return {
      config: bitSlice(new Uint8Array(config.src.buffer), bitpos, bitpos + 16),
      codec: `mp4a.40.${prof}`,
      samplerate: AACParser.SampleRates[sfi],
      channels,
    };
  }

  public static parseStreamMuxConfig(bytes: Uint8Array): AACConfig {
    // ISO_IEC_14496-3 Part 3 Audio. StreamMuxConfig
    const config = new BitArray(bytes);

    if (!config.readBits(1)) {
      config.skipBits(14);
      return AACParser.parseAudioSpecificConfig(config);
    }
  }
}
