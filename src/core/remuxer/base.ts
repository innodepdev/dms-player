// import { getTagged } from '../../deps/bp_logger';
import { DtsUnit } from '../elementary/dts-unit';
import { NalUnit } from '../elementary/nal-unit';
import { AACConfig } from '../parsers/aac';
// import { getTagged } from '../../deps/bp_logger';

// const Log = getTagged('remuxer:base');
let track_id = 1;
// const LOG_TAG = 'base-remuxer';
// const Log = getTagged(LOG_TAG);

export interface MP4SampleFlag {
  isLeading: number;
  isDependedOn: number;
  hasRedundancy: number;
  degradPrio: number;
  dependsOn: number;
  isNonSync: number;
}
export interface MP4Sample {
  size: number;
  duration: number;
  cts: number;
  flags: MP4SampleFlag;
}

export interface MP4Track {
  id: number;
  type: string;
  len: number;
  fragmented: boolean;
  channelCount?: number;
  config?: Uint8Array;
  audiosamplerate?: number;
  sps?: string | Uint8Array[];
  pps?: string | Uint8Array[];
  width?: number;
  height?: number;
  timescale?: number;
  volume?: number;
  duration?: number;
  samples?: MP4Sample[];
  codec?: string;
}

export interface TrackInformation {
  duration?: number;
  timescale?: number;
  scaleFactor?: number;
  sps?: ArrayBuffer;
  pps?: ArrayBuffer;
  config?: AACConfig;
  type: number;
}

export class NaluSample extends DtsUnit {
  public unit: NalUnit;
}

export abstract class BaseRemuxer {
  static get MP4_TIMESCALE() {
    return 90000;
  }

  // TODO: move to ts parser
  // static PTSNormalize(value, reference) {
  //
  //     let offset;
  //     if (reference === undefined) {
  //         return value;
  //     }
  //     if (reference < value) {
  //         // - 2^33
  //         offset = -8589934592;
  //     } else {
  //         // + 2^33
  //         offset = 8589934592;
  //     }
  //     /* PTS is 33bit (from 0 to 2^33 -1)
  //      if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
  //      PTS looping occured. fill the gap */
  //     while (Math.abs(value - reference) > 4294967296) {
  //         value += offset;
  //     }
  //     return value;
  // }

  public static getTrackID() {
    return track_id++;
  }
  public duration: number;
  public initPTS: number;
  public initDTS: number;
  public firstDTS: number;
  public timeOffset: number;
  public timescale: number;
  public scaleFactor: number;
  public readyToDecode: boolean;
  public seq: number;
  public tsAlign: number;
  public samples: NaluSample[];
  public initialized: boolean;
  public mp4track: MP4Track;

  constructor(timescale: number, scaleFactor: number, params?: any) {
    this.timeOffset = 0;
    this.timescale = timescale;
    this.scaleFactor = scaleFactor;
    this.readyToDecode = false;
    this.samples = [];
    this.seq = 1;
    this.tsAlign = 1;
  }

  public getQueueSize(): number {
    return this.samples.length;
  }
  public scaled(timestamp: number) {
    return timestamp / this.scaleFactor;
  }

  public unscaled(timestamp: number) {
    return timestamp * this.scaleFactor;
  }

  public remux(unit: NalUnit): boolean {
    if (unit) {
      this.samples.push({
        unit,
        pts: unit.pts,
        dts: unit.dts,
        gs: unit.gs,
      });
      return true;
    }
    return false;
  }

  public static toMS(timestamp: number) {
    return timestamp / 90;
  }

  // tslint:disable-next-line:no-empty
  public setConfig(config) {}

  public abstract getPayload(): Uint8Array;

  public insertDscontinuity() {
    this.samples.push(null);
  }

  public init(initPTS: number, initDTS: number, shouldInitialize = true) {
    // Log.info(`init pts:${initPTS}, dts:${initDTS}, initialize:${shouldInitialize}`);
    this.initPTS = Math.min(initPTS, this.samples[0].dts /*- this.unscaled(this.timeOffset)*/);
    this.initDTS = Math.min(initDTS, this.samples[0].dts /*- this.unscaled(this.timeOffset)*/);
    // Log.debug(`Initial pts=${this.initPTS} dts=${this.initDTS} offset=${this.unscaled(this.timeOffset)}`);
    this.initialized = shouldInitialize;
  }

  public flush() {
    this.seq++;
    this.mp4track.len = 0;
    this.mp4track.samples = [];
  }

  public static dtsSortFunc(a: DtsUnit, b: DtsUnit) {
    return a.dts - b.dts;
  }

  public static groupByDts(gop: NalUnit[]) {
    const groupBy = (xs: NalUnit[], key: string) => {
      return xs.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, []);
    };
    return groupBy(gop, 'dts');
  }

  public getPayloadBase(sampleFunction?: any, setupSample?: any) {
    if (!this.readyToDecode || !this.initialized || !this.samples.length) return null;
    this.samples.sort(BaseRemuxer.dtsSortFunc);
    return true;
    //
    // let payload = new Uint8Array(this.mp4track.len);
    // let offset = 0;
    // let samples=this.mp4track.samples;
    // let mp4Sample, lastDTS, pts, dts;
    //
    // while (this.samples.length) {
    //     let sample = this.samples.shift();
    //     if (sample === null) {
    //         // discontinuity
    //         this.nextDts = undefined;
    //         break;
    //     }
    //
    //     let unit = sample.unit;
    //
    //     pts = Math.round((sample.pts - this.initDTS)/this.tsAlign)*this.tsAlign;
    //     dts = Math.round((sample.dts - this.initDTS)/this.tsAlign)*this.tsAlign;
    //     // ensure DTS is not bigger than PTS
    //     dts = Math.min(pts, dts);
    //
    //     // sampleFunction(pts, dts);   // TODO:
    //
    //     // mp4Sample = setupSample(unit, pts, dts);    // TODO:
    //
    //     payload.set(unit.getData(), offset);
    //     offset += unit.getSize();
    //
    //     samples.push(mp4Sample);
    //     lastDTS = dts;
    // }
    // if (!samples.length) return null;
    //
    // // samplesPostFunction(samples); // TODO:
    //
    // return new Uint8Array(payload.buffer, 0, this.mp4track.len);
  }
}
