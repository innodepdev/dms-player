import { MP4Sample, MP4Track } from '../remuxer/base';

/**
 * Generate MP4 Box
 * got from: https://github.com/dailymotion/hls.js
 */

export class MP4 {
  public static types: { [id: string]: number[] };
  public static HDLR_TYPES: { [id: string]: Uint8Array };
  public static STTS: Uint8Array;
  public static STSC: Uint8Array;
  public static STCO: Uint8Array;
  public static STSZ: Uint8Array;
  public static VMHD: Uint8Array;
  public static SMHD: Uint8Array;
  public static STSD: Uint8Array;
  public static FTYP: Uint8Array;
  public static DINF: Uint8Array;

  public static init() {
    MP4.types = {
      avc1: [], // codingname
      avcC: [],
      btrt: [],
      dinf: [],
      dref: [],
      esds: [],
      ftyp: [],
      hdlr: [],
      mdat: [],
      mdhd: [],
      mdia: [],
      mfhd: [],
      minf: [],
      moof: [],
      moov: [],
      mp4a: [],
      mvex: [],
      mvhd: [],
      sdtp: [],
      stbl: [],
      stco: [],
      stsc: [],
      stsd: [],
      stsz: [],
      stts: [],
      tfdt: [],
      tfhd: [],
      traf: [],
      trak: [],
      trun: [],
      trex: [],
      tkhd: [],
      vmhd: [],
      smhd: [],
    };

    for (const i in MP4.types) {
      if (MP4.types.hasOwnProperty(i)) {
        MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
      }
    }

    const videoHdlr = new Uint8Array([
      0x00, // version 0
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00,
      0x00,
      0x00, // pre_defined
      0x76,
      0x69,
      0x64,
      0x65, // handler_type: 'vide'
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x56,
      0x69,
      0x64,
      0x65,
      0x6f,
      0x48,
      0x61,
      0x6e,
      0x64,
      0x6c,
      0x65,
      0x72,
      0x00, // name: 'VideoHandler'
    ]);

    const audioHdlr = new Uint8Array([
      0x00, // version 0
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00,
      0x00,
      0x00, // pre_defined
      0x73,
      0x6f,
      0x75,
      0x6e, // handler_type: 'soun'
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x53,
      0x6f,
      0x75,
      0x6e,
      0x64,
      0x48,
      0x61,
      0x6e,
      0x64,
      0x6c,
      0x65,
      0x72,
      0x00, // name: 'SoundHandler'
    ]);

    MP4.HDLR_TYPES = {
      video: videoHdlr,
      audio: audioHdlr,
    };

    const dref = new Uint8Array([
      0x00, // version 0
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00,
      0x00,
      0x01, // entry_count
      0x00,
      0x00,
      0x00,
      0x0c, // entry_size
      0x75,
      0x72,
      0x6c,
      0x20, // 'url' type
      0x00, // version 0
      0x00,
      0x00,
      0x01, // entry_flags
    ]);

    const stco = new Uint8Array([
      0x00, // version
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00,
      0x00,
      0x00, // entry_count
    ]);

    MP4.STTS = MP4.STSC = MP4.STCO = stco;

    MP4.STSZ = new Uint8Array([
      0x00, // version
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00,
      0x00,
      0x00, // sample_size
      0x00,
      0x00,
      0x00,
      0x00, // sample_count
    ]);
    MP4.VMHD = new Uint8Array([
      0x00, // version
      0x00,
      0x00,
      0x01, // flags
      0x00,
      0x00, // graphicsmode
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // opcolor
    ]);
    MP4.SMHD = new Uint8Array([
      0x00, // version
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00, // balance
      0x00,
      0x00, // reserved
    ]);

    MP4.STSD = new Uint8Array([
      0x00, // version 0
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00,
      0x00,
      0x01,
    ]); // entry_count

    const majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
    const avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
    const minorVersion = new Uint8Array([0, 0, 0, 1]);

    MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
    MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
  }

  public static box(type: number[], ...payload: any[]) {
    let size = 8,
      i = payload.length;
    const len = i;

    let result: Uint8Array;
    // calculate the total size we need to allocate
    while (i--) {
      size += payload[i].byteLength;
    }
    result = new Uint8Array(size);
    result[0] = (size >> 24) & 0xff;
    result[1] = (size >> 16) & 0xff;
    result[2] = (size >> 8) & 0xff;
    result[3] = size & 0xff;
    result.set(type, 4);
    // copy the payload into the result
    size = 8;
    for (i = 0; i < len; ++i) {
      // copy payload[i] array @ offset size
      result.set(payload[i], size);
      size += payload[i].byteLength;
    }
    return result;
  }

  public static hdlr(type: string) {
    return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
  }

  public static mdat(data: Uint8Array) {
    return MP4.box(MP4.types.mdat, data);
  }

  public static mdhd(timescale: number, duration: number) {
    return MP4.box(
      MP4.types.mdhd,
      new Uint8Array([
        0x00, // version 0
        0x00,
        0x00,
        0x00, // flags
        0x00,
        0x00,
        0x00,
        0x02, // creation_time
        0x00,
        0x00,
        0x00,
        0x03, // modification_time
        (timescale >> 24) & 0xff,
        (timescale >> 16) & 0xff,
        (timescale >> 8) & 0xff,
        timescale & 0xff, // timescale
        duration >> 24,
        (duration >> 16) & 0xff,
        (duration >> 8) & 0xff,
        duration & 0xff, // duration
        0x55,
        0xc4, // 'und' language (undetermined)
        0x00,
        0x00,
      ])
    );
  }

  public static mdia(track: MP4Track) {
    return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
  }

  public static mfhd(sequenceNumber: number) {
    return MP4.box(
      MP4.types.mfhd,
      new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x00, // flags
        sequenceNumber >> 24,
        (sequenceNumber >> 16) & 0xff,
        (sequenceNumber >> 8) & 0xff,
        sequenceNumber & 0xff, // sequence_number
      ])
    );
  }

  public static minf(track: MP4Track) {
    if (track.type === 'audio') {
      return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
    } else {
      return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
    }
  }

  public static moof(sn: number, baseMediaDecodeTime: number, track: MP4Track) {
    return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
  }
  /**
   * @param tracks... (optional) {array} the tracks associated with this movie
   */
  public static moov(tracks: MP4Track[], duration: number, timescale: number) {
    let i = tracks.length;
    const boxes: Uint8Array[] = [];

    while (i--) {
      boxes[i] = MP4.trak(tracks[i]);
    }

    return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(timescale, duration)].concat(boxes).concat(MP4.mvex(tracks)));
  }

  public static mvex(tracks: MP4Track[]) {
    let i = tracks.length;
    const boxes: Uint8Array[] = [];
    const ary: any[] = [MP4.types.mvex];

    while (i--) {
      boxes[i] = MP4.trex(tracks[i]);
    }
    return MP4.box.apply(null, ary.concat(boxes));
  }

  public static mvhd(timescale: number, duration: number) {
    const bytes = new Uint8Array([
      0x00, // version 0
      0x00,
      0x00,
      0x00, // flags
      0x00,
      0x00,
      0x00,
      0x01, // creation_time
      0x00,
      0x00,
      0x00,
      0x02, // modification_time
      (timescale >> 24) & 0xff,
      (timescale >> 16) & 0xff,
      (timescale >> 8) & 0xff,
      timescale & 0xff, // timescale
      (duration >> 24) & 0xff,
      (duration >> 16) & 0xff,
      (duration >> 8) & 0xff,
      duration & 0xff, // duration
      0x00,
      0x01,
      0x00,
      0x00, // 1.0 rate
      0x01,
      0x00, // 1.0 volume
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x40,
      0x00,
      0x00,
      0x00, // transformation: unity matrix
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // pre_defined
      0xff,
      0xff,
      0xff,
      0xff, // next_track_ID
    ]);
    return MP4.box(MP4.types.mvhd, bytes);
  }

  public static sdtp(track: MP4Track) {
    const samples = track.samples || [];
    const bytes = new Uint8Array(4 + samples.length);
    let flags, i: number;
    // leave the full box header (4 bytes) all zero
    // write the sample table
    for (i = 0; i < samples.length; i++) {
      flags = samples[i].flags;
      bytes[i + 4] = (flags.dependsOn << 4) | (flags.isDependedOn << 2) | flags.hasRedundancy;
    }

    return MP4.box(MP4.types.sdtp, bytes);
  }

  public static stbl(track: MP4Track) {
    return MP4.box(
      MP4.types.stbl,
      MP4.stsd(track),
      MP4.box(MP4.types.stts, MP4.STTS),
      MP4.box(MP4.types.stsc, MP4.STSC),
      MP4.box(MP4.types.stsz, MP4.STSZ),
      MP4.box(MP4.types.stco, MP4.STCO)
    );
  }

  public static avc1(track: MP4Track) {
    let sps = [],
      pps = [],
      i: number,
      data,
      len;
    // assemble the SPSs

    for (i = 0; i < track.sps.length; i++) {
      data = track.sps[i];
      len = data.byteLength;
      sps.push((len >>> 8) & 0xff);
      sps.push(len & 0xff);
      sps = sps.concat(Array.prototype.slice.call(data)); // SPS
    }

    // assemble the PPSs
    for (i = 0; i < track.pps.length; i++) {
      data = track.pps[i];
      len = data.byteLength;
      pps.push((len >>> 8) & 0xff);
      pps.push(len & 0xff);
      pps = pps.concat(Array.prototype.slice.call(data));
    }

    const avcc = MP4.box(
        MP4.types.avcC,
        new Uint8Array(
          [
            0x01, // version
            sps[3], // profile
            sps[4], // profile compat
            sps[5], // level
            0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
            0xe0 | track.sps.length, // 3bit reserved (111) + numOfSequenceParameterSets
          ]
            .concat(sps)
            .concat([
              track.pps.length, // numOfPictureParameterSets
            ])
            .concat(pps)
        )
      ), // "PPS"
      width = track.width,
      height = track.height;
    // console.log('avcc:' + Hex.hexDump(avcc));
    return MP4.box(
      MP4.types.avc1,
      new Uint8Array([
        0x00,
        0x00,
        0x00, // reserved
        0x00,
        0x00,
        0x00, // reserved
        0x00,
        0x01, // data_reference_index
        0x00,
        0x00, // pre_defined
        0x00,
        0x00, // reserved
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // pre_defined
        (width >> 8) & 0xff,
        width & 0xff, // width
        (height >> 8) & 0xff,
        height & 0xff, // height
        0x00,
        0x48,
        0x00,
        0x00, // horizresolution
        0x00,
        0x48,
        0x00,
        0x00, // vertresolution
        0x00,
        0x00,
        0x00,
        0x00, // reserved
        0x00,
        0x01, // frame_count
        0x12,
        0x62,
        0x69,
        0x6e,
        0x65, // binelpro.ru
        0x6c,
        0x70,
        0x72,
        0x6f,
        0x2e,
        0x72,
        0x75,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // compressorname
        0x00,
        0x18, // depth = 24
        0x11,
        0x11,
      ]), // pre_defined = -1
      avcc,
      MP4.box(
        MP4.types.btrt,
        new Uint8Array([
          0x00,
          0x1c,
          0x9c,
          0x80, // bufferSizeDB
          0x00,
          0x2d,
          0xc6,
          0xc0, // maxBitrate
          0x00,
          0x2d,
          0xc6,
          0xc0,
        ])
      ) // avgBitrate
    );
  }

  public static esds(track: MP4Track) {
    const configlen = track.config.byteLength;
    const data = new Uint8Array(26 + configlen + 3);
    data.set([
      0x00, // version 0
      0x00,
      0x00,
      0x00, // flags

      0x03, // descriptor_type
      0x17 + configlen, // length
      0x00,
      0x01, // es_id
      0x00, // stream_priority

      0x04, // descriptor_type
      0x0f + configlen, // length
      0x40, // codec : mpeg4_audio
      0x15, // stream_type
      0x00,
      0x00,
      0x00, // buffer_size
      0x00,
      0x00,
      0x00,
      0x00, // maxBitrate
      0x00,
      0x00,
      0x00,
      0x00, // avgBitrate

      0x05, // descriptor_type
      configlen,
    ]);
    data.set(track.config, 26);
    data.set([0x06, 0x01, 0x02], 26 + configlen);
    // return new Uint8Array([
    //     0x00, // version 0
    //     0x00, 0x00, 0x00, // flags
    //
    //     0x03, // descriptor_type
    //     0x17+configlen, // length
    //     0x00, 0x01, //es_id
    //     0x00, // stream_priority
    //
    //     0x04, // descriptor_type
    //     0x0f+configlen, // length
    //     0x40, //codec : mpeg4_audio
    //     0x15, // stream_type
    //     0x00, 0x00, 0x00, // buffer_size
    //     0x00, 0x00, 0x00, 0x00, // maxBitrate
    //     0x00, 0x00, 0x00, 0x00, // avgBitrate
    //
    //     0x05 // descriptor_type
    // ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
    return data;
  }

  public static mp4a(track: MP4Track) {
    const audiosamplerate = track.audiosamplerate;
    return MP4.box(
      MP4.types.mp4a,
      new Uint8Array([
        0x00,
        0x00,
        0x00, // reserved
        0x00,
        0x00,
        0x00, // reserved
        0x00,
        0x01, // data_reference_index
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // reserved
        0x00,
        track.channelCount, // channelcount
        0x00,
        0x10, // sampleSize:16bits
        0x00,
        0x00, // pre_defined
        0x00,
        0x00, // reserved2
        (audiosamplerate >> 8) & 0xff,
        audiosamplerate & 0xff, //
        0x00,
        0x00,
      ]),
      MP4.box(MP4.types.esds, MP4.esds(track))
    );
  }

  public static stsd(track: MP4Track) {
    if (track.type === 'audio') {
      return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
    } else {
      return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
    }
  }

  public static tkhd(track: MP4Track) {
    const id = track.id,
      duration = track.duration,
      width = track.width,
      height = track.height,
      volume = track.volume;
    return MP4.box(
      MP4.types.tkhd,
      new Uint8Array([
        0x00, // version 0
        0x00,
        0x00,
        0x07, // flags
        0x00,
        0x00,
        0x00,
        0x00, // creation_time
        0x00,
        0x00,
        0x00,
        0x00, // modification_time
        (id >> 24) & 0xff,
        (id >> 16) & 0xff,
        (id >> 8) & 0xff,
        id & 0xff, // track_ID
        0x00,
        0x00,
        0x00,
        0x00, // reserved
        duration >> 24,
        (duration >> 16) & 0xff,
        (duration >> 8) & 0xff,
        duration & 0xff, // duration
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // reserved
        0x00,
        0x00, // layer
        0x00,
        0x00, // alternate_group
        (volume >> 0) & 0xff,
        (((volume % 1) * 10) >> 0) & 0xff, // track volume // FIXME
        0x00,
        0x00, // reserved
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x40,
        0x00,
        0x00,
        0x00, // transformation: unity matrix
        (width >> 8) & 0xff,
        width & 0xff,
        0x00,
        0x00, // width
        (height >> 8) & 0xff,
        height & 0xff,
        0x00,
        0x00, // height
      ])
    );
  }

  public static traf(track: MP4Track, baseMediaDecodeTime: number) {
    const sampleDependencyTable = MP4.sdtp(track),
      id = track.id;
    return MP4.box(
      MP4.types.traf,
      MP4.box(
        MP4.types.tfhd,
        new Uint8Array([
          0x00, // version 0
          0x00,
          0x00,
          0x00, // flags
          id >> 24,
          (id >> 16) & 0xff,
          (id >> 8) & 0xff,
          id & 0xff, // track_ID
        ])
      ),
      MP4.box(
        MP4.types.tfdt,
        new Uint8Array([
          0x00, // version 0
          0x00,
          0x00,
          0x00, // flags
          baseMediaDecodeTime >> 24,
          (baseMediaDecodeTime >> 16) & 0xff,
          (baseMediaDecodeTime >> 8) & 0xff,
          baseMediaDecodeTime & 0xff, // baseMediaDecodeTime
        ])
      ),
      MP4.trun(
        track,
        sampleDependencyTable.length +
        16 + // tfhd
        16 + // tfdt
        8 + // traf header
        16 + // mfhd
        8 + // moof header
          8
      ), // mdat header
      sampleDependencyTable
    );
  }

  /**
   * Generate a track box.
   * @param track {object} a track definition
   * @return {Uint8Array} the track box
   */
  public static trak(track: MP4Track): Uint8Array {
    track.duration = track.duration || 0xffffffff;
    return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
  }

  public static trex(track: MP4Track) {
    const id = track.id;
    return MP4.box(
      MP4.types.trex,
      new Uint8Array([
        0x00, // version 0
        0x00,
        0x00,
        0x00, // flags
        id >> 24,
        (id >> 16) & 0xff,
        (id >> 8) & 0xff,
        id & 0xff, // track_ID
        0x00,
        0x00,
        0x00,
        0x01, // default_sample_description_index
        0x00,
        0x00,
        0x00,
        0x00, // default_sample_duration
        0x00,
        0x00,
        0x00,
        0x00, // default_sample_size
        0x00,
        0x01,
        0x00,
        0x01, // default_sample_flags
      ])
    );
  }

  public static trun(track: MP4Track, offset: number) {
    const samples: MP4Sample[] = track.samples || [];

    const len = samples.length,
      arraylen = 12 + 16 * len,
      array = new Uint8Array(arraylen);
    let i: number, sample: MP4Sample, duration: number, size: number, flags: { [id: string]: any }, cts: number;
    offset += 8 + arraylen;
    array.set(
      [
        0x00, // version 0
        0x00,
        0x0f,
        0x01, // flags
        (len >>> 24) & 0xff,
        (len >>> 16) & 0xff,
        (len >>> 8) & 0xff,
        len & 0xff, // sample_count
        (offset >>> 24) & 0xff,
        (offset >>> 16) & 0xff,
        (offset >>> 8) & 0xff,
        offset & 0xff, // data_offset
      ],
      0
    );

    for (i = 0; i < len; i++) {
      sample = samples[i];
      duration = sample.duration;
      size = sample.size;
      flags = sample.flags;
      cts = sample.cts;
      array.set(
        [
          (duration >>> 24) & 0xff,
          (duration >>> 16) & 0xff,
          (duration >>> 8) & 0xff,
          duration & 0xff, // sample_duration
          (size >>> 24) & 0xff,
          (size >>> 16) & 0xff,
          (size >>> 8) & 0xff,
          size & 0xff, // sample_size
          (flags.isLeading << 2) | flags.dependsOn,
          (flags.isDependedOn << 6) | (flags.hasRedundancy << 4) | (flags.paddingValue << 1) | flags.isNonSync,
          flags.degradPrio & (0xf0 << 8),
          flags.degradPrio & 0x0f, // sample_flags
          (cts >>> 24) & 0xff,
          (cts >>> 16) & 0xff,
          (cts >>> 8) & 0xff,
          cts & 0xff, // sample_composition_time_offset
        ],
        12 + 16 * i
      );
    }

    return MP4.box(MP4.types.trun, array);
  }

  public static initSegment(tracks: MP4Track[], duration: number, timescale: number) {
    if (!MP4.types) {
      MP4.init();
    }
    const movie = MP4.moov(tracks, duration, timescale);
    let result: Uint8Array;
    result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
    result.set(MP4.FTYP);
    result.set(movie, MP4.FTYP.byteLength);
    return result;
  }
}
