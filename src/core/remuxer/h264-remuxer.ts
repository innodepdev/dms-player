import { getTagged } from '../../deps/bp_logger';
import { NalUnit } from '../elementary/nal-unit';
import { H264Parser } from '../parsers/h264';
import { BaseRemuxer, MP4Sample, MP4Track } from './base';

const Log = getTagged('remuxer:h264');

// iframe dts check
export let dtsTimeList: any[] = [];
export function dtsTimeReset() {
  dtsTimeList = [];
}

export class H264Remuxer extends BaseRemuxer {

  public beforeSampleDTS: number;
  public beforeSamplePTS: number;
  public beforeFDTS: number;

  public firstDTS: number;
  public firstPTS: number;
  public lastGopDTS: number;
  public lastSampleDuration: number;
  public lastDurations: number[];
  public mp4track: MP4Track;
  public firstUnit: boolean;
  public h264: H264Parser;
  public gop: NalUnit[];
  public nextDts: number;
  public lastDTS: number;
  public compareDTS: number;

  constructor(timescale: number, scaleFactor = 1, params: { [key: string]: any } = {}) {
    super(timescale, scaleFactor, params);

    this.nextDts = undefined;
    this.readyToDecode = false;
    this.initialized = false;

    this.firstDTS = 0;
    this.firstPTS = 0;
    this.lastDTS = undefined;
    this.lastSampleDuration = 0;
    this.lastDurations = [];
    // this.timescale = 90000;
    this.tsAlign = Math.round(this.timescale / 60);

    this.mp4track = {
      id: BaseRemuxer.getTrackID(),
      type: 'video',
      len: 0,
      fragmented: true,
      sps: '',
      pps: '',
      width: 0,
      height: 0,
      timescale,
      duration: timescale,
      samples: [],
    };

    this.samples = [];
    this.lastGopDTS = -99999999999999;
    this.gop = [];
    this.firstUnit = true;

    this.h264 = new H264Parser(this);

    if (params.sps) {
      const arr = new Uint8Array(params.sps);
      if ((arr[0] & 0x1f) === 7) {
        this.setSPS(arr);
      } else {
        Log.warn('bad SPS in SDP');
      }
    }
    if (params.pps) {
      const arr = new Uint8Array(params.pps);
      if ((arr[0] & 0x1f) === 8) {
        this.setPPS(arr);
      } else {
        Log.warn('bad PPS in SDP');
      }
    }

    if (this.mp4track.pps && this.mp4track.sps) {
      this.readyToDecode = true;
    }
  }

  public _scaled(timestamp: number) {
    return timestamp >>> this.scaleFactor;
  }

  public _unscaled(timestamp: number) {
    return timestamp << this.scaleFactor;
  }

  public setSPS(sps: Uint8Array) {
    this.h264.parseSPS(sps);
  }

  public setPPS(pps: Uint8Array) {
    this.h264.parsePPS(pps);
  }

  public remux(nalu: NalUnit): boolean {
    if (this.lastGopDTS < nalu.dts) {
      this.gop.sort(BaseRemuxer.dtsSortFunc);

      if (this.gop.length > 1) {
        // Aggregate multi-slices which belong to one frame
        const groupedGop = BaseRemuxer.groupByDts(this.gop);

        this.gop = groupedGop.map((group) => {
          return group.reduce((preUnit: NalUnit, curUnit: NalUnit) => {
            const naluData = curUnit.data;
            naluData.set([0, 0, 0, 1]);
            preUnit.appendData(naluData);
            return preUnit;
          });
        });
      }

      for (const unit of this.gop) {
        // if (this.firstUnit) {
        //     unit.ntype = 5;//NALU.IDR;
        //     this.firstUnit = false;
        // }
        if (super.remux.call(this, unit)) {
          this.mp4track.len += unit.size;
        }
      }
      this.gop = [];
      this.lastGopDTS = nalu.dts;
    }
    if (this.h264.parseNAL(nalu)) { // *
      this.gop.push(nalu);
    }
    return true;
  }

  public getPayload() {
    if (!this.getPayloadBase()) {
      return null;
    }

    const payload = new Uint8Array(this.mp4track.len);
    let offset = 0;
    const samples = this.mp4track.samples;
    let mp4Sample: MP4Sample, lastDTS: number, pts: number, dts: number;

    // Log.debug(this.samples.map((e)=>{
    //     return Math.round((e.dts - this.initDTS));
    // }));

    // let minDuration = Number.MAX_SAFE_INTEGER;

    while (this.samples.length) {
      const sample = this.samples.shift();
      if (sample === null) {
        // discontinuity
        this.nextDts = undefined;
        break;
      }

      /*if (this.beforeSampleDTS) {
        if (sample.dts - this.beforeSampleDTS > 35) { // 녹화구간 빠짐
          pts = (this.beforeSamplePTS + 33) - this.initDTS; // /!*Math.round(*!/(sample.pts - this.initDTS)/!*!/this.tsAlign)*this.tsAlign*!/;
          dts = (this.beforeSampleDTS + 33) - this.initDTS; // /!*Math.round(*!/(sample.pts - this.initDTS)/!*!/this.tsAlign)*this.tsAlign*!/;

          // before ts info save
          this.beforeSamplePTS = (this.beforeSamplePTS + 33);
          this.beforeSampleDTS = (this.beforeSampleDTS + 33);

          dtsTimeList.push({
            cDate: Math.max(0, sample.dts),
            cTime: Math.max(0, dts) / 1000
          });

        } else {
          pts = sample.pts - this.initDTS;
          dts = sample.dts - this.initDTS;

          this.beforeSamplePTS = sample.pts;
          this.beforeSampleDTS = sample.dts;
        }
      } else {
        pts = sample.pts - this.initDTS;
        dts = sample.dts - this.initDTS;

        this.beforeSamplePTS = sample.pts;
        this.beforeSampleDTS = sample.dts;

        dtsTimeList.push({
         cDate: Math.max(0, sample.dts),
         cTime: Math.max(0, dts) / 1000
        });

        const unit = sample.unit;
      }*/

      // TODO 저장 로직 처리 이후, 아래 7line 삭제
      const unit = sample.unit;
      pts = sample.pts - this.initDTS; // /*Math.round(*/(sample.pts - this.initDTS)/*/this.tsAlign)*this.tsAlign*/;
      dts = sample.dts - this.initDTS; // /*Math.round(*/(sample.pts - this.initDTS)/*/this.tsAlign)*this.tsAlign*/;

      dtsTimeList.push({
        cDate: Math.max(0, sample.dts),
        cTime: Math.max(0, dts) / 1000
      });

      // ensure DTS is not bigger than PTS
      dts = Math.min(pts, dts);

      // if not first AVC sample of video track, normalize PTS/DTS with previous sample value
      // and ensure that sample duration is positive
      if (lastDTS !== undefined) {
        const sampleDuration = this.scaled(dts - lastDTS);
        // Log.debug(`Sample duration: ${sampleDuration}`);
        if (sampleDuration < 0) {
          // Log.log(`invalid AVC sample duration at PTS/DTS: ${pts}/${dts}|lastDTS: ${lastDTS}:${sampleDuration}`);
          this.mp4track.len -= unit.size;
          continue;
        }
        // minDuration = Math.min(sampleDuration, minDuration);
        this.lastDurations.push(sampleDuration);
        if (this.lastDurations.length > 100) {
          this.lastDurations.shift();
        }
        mp4Sample.duration = sampleDuration;
      } else {
        if (this.nextDts) {
          const delta = dts - this.nextDts;
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (/*contiguous ||*/ Math.abs(Math.round(BaseRemuxer.toMS(delta))) < 600) {
            if (delta) {

              // set DTS to next DTS
              // Log.debug(`Video/PTS/DTS adjusted: ${pts}->${Math.max(pts - delta, this.nextDts)}/${dts}->${this.nextDts},delta:${delta}`);

              dts = this.nextDts;

              // offset PTS as well, ensure that PTS is smaller or equal than new DTS

              pts = Math.max(pts - delta, dts);
            }
          } else {
            if (delta < 0) {
              Log.log(`skip frame from the past at DTS=${dts} with expected DTS=${this.nextDts}`);
              this.mp4track.len -= unit.size;
              continue;
            }
          }
        }

        this.firstDTS = Math.max(0, dts);

      }

      mp4Sample = {
        size: unit.size,
        duration: 0,
        cts: this.scaled(pts - dts),
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          dependsOn: 0,
          isNonSync: 0,
        },
      };
      const flags = mp4Sample.flags;
      if (sample.unit.isKeyframe === true) {
        // the current sample is a key frame
        flags.dependsOn = 2;
        flags.isNonSync = 0;
      } else {
        flags.dependsOn = 1;
        flags.isNonSync = 1;
      }

      payload.set(unit.data, offset);
      offset += unit.size;

      samples.push(mp4Sample);
      lastDTS = dts;
    }

    if (!samples.length) return null;

    const avgDuration =
      (this.lastDurations.reduce((a, b) => {
        return (a | 0) + (b | 0);
      }, 0) /
        (this.lastDurations.length || 1)) |
      0;
    if (samples.length >= 2) {
      this.lastSampleDuration = avgDuration;
      mp4Sample.duration = avgDuration;
    } else {
      mp4Sample.duration = this.lastSampleDuration;
    }

    if (samples.length && (!this.nextDts || navigator.userAgent.toLowerCase().indexOf('chrome') > -1)) {
      const flags = samples[0].flags;
      // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
      // https://code.google.com/p/chromium/issues/detail?id=229412
      flags.dependsOn = 2;
      flags.isNonSync = 0;
    }

    // next AVC sample DTS should be equal to last sample DTS + last sample duration
    this.nextDts = dts + this.unscaled(this.lastSampleDuration);
    // Log.debug(`next dts: ${this.nextDts}, last duration: ${this.lastSampleDuration}, last dts: ${dts}`);

    return new Uint8Array(payload.buffer, 0, this.mp4track.len);
  }
}
