import { getTagged } from '../../deps/bp_logger';
import { NalUnit } from '../elementary/nal-unit';
import { BaseRemuxer, NaluSample } from './base';

const Log = getTagged('remuxer:aac');

export class AACRemuxer extends BaseRemuxer {
  public firstDTS: number;
  public codecstring: string;
  public nextAacPts: number;
  public lastPts: number;
  public initDTS: number;
  public firstPTS: number;
  public duration: number;
  public timescale: number;
  public expectedSampleDuration: number;
  public nextDts: number;
  public units: any[];

  constructor(timescale: number, scaleFactor = 1, params: { [key: string]: any } = {}) {
    super(timescale, scaleFactor);

    this.codecstring = 'mp4a.40.2';
    this.units = [];
    this.initDTS = undefined;
    this.nextAacPts = undefined;
    this.lastPts = 0;
    this.firstDTS = 0;
    this.firstPTS = 0;
    this.duration = params.duration || 1;
    this.initialized = false;

    this.mp4track = {
      id: BaseRemuxer.getTrackID(),
      type: 'audio',
      fragmented: true,
      channelCount: 0,
      audiosamplerate: this.timescale,
      duration: 0,
      timescale: this.timescale,
      volume: 1,
      samples: [],
      config: new Uint8Array(0),
      len: 0,
    };
    if (params.config) {
      this.setConfig(params.config);
    }
  }

  public setConfig(config: { [key: string]: any }) {
    this.mp4track.channelCount = config.channels;
    this.mp4track.audiosamplerate = config.samplerate;
    if (!this.mp4track.duration) {
      this.mp4track.duration = (this.duration ? this.duration : 1) * config.samplerate;
    }
    this.mp4track.timescale = config.samplerate;
    this.mp4track.config = config.config;
    this.mp4track.codec = config.codec;
    this.timescale = config.samplerate;
    this.scaleFactor = BaseRemuxer.MP4_TIMESCALE / config.samplerate;
    this.expectedSampleDuration = 1024 * this.scaleFactor;
    this.readyToDecode = true;
  }

  public remux(aac: NalUnit): boolean {
    if (super.remux.call(this, aac)) {
      this.mp4track.len += aac.size;
      return true;
    }

    return false;
  }

  public getPayload() {
    if (!this.readyToDecode || !this.samples.length) return null;
    this.samples.sort((a: NaluSample, b: NaluSample) => {
      return a.dts - b.dts;
    });

    const payload = new Uint8Array(this.mp4track.len);
    let offset = 0;
    const samples = this.mp4track.samples;
    let mp4Sample, lastDTS: number, pts: number, dts: number;

    while (this.samples.length) {
      const sample = this.samples.shift();
      if (sample === null) {
        // discontinuity
        this.nextDts = undefined;
        break;
      }
      const unit = sample.unit;
      pts = sample.pts - this.initDTS;
      dts = sample.dts - this.initDTS;

      if (lastDTS === undefined) {
        if (this.nextDts) {
          const delta = Math.round(this.scaled(pts - this.nextAacPts));
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (/*contiguous || */ Math.abs(delta) < 600) {
            // log delta
            if (delta) {
              if (delta > 0) {
                Log.log(`${delta} ms hole between AAC samples detected,filling it`);
                // if we have frame overlap, overlapping for more than half a frame duraion
              } else if (delta < -12) {
                // drop overlapping audio frames... browser will deal with it
                Log.log(`${-delta} ms overlapping between AAC samples detected, drop frame`);
                this.mp4track.len -= unit.size;
                continue;
              }
              // set DTS to next DTS
              pts = dts = this.nextAacPts;
            }
          }
        }
        // remember first PTS of our aacSamples, ensure value is positive
        this.firstDTS = Math.max(0, dts);
      }

      mp4Sample = {
        size: unit.size,
        cts: 0,
        duration: 1024,
        flags: {
          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          dependsOn: 1,
        },
      };

      payload.set(unit.data, offset);
      offset += unit.size;
      samples.push(mp4Sample);
      lastDTS = dts;
    }
    if (!samples.length) return null;
    this.nextDts = pts + this.expectedSampleDuration;
    return new Uint8Array(payload.buffer, 0, this.mp4track.len);
  }
}
// test.bundle.js:42 [remuxer:h264] skip frame from the past at DTS=18397972271140676 with expected DTS=18397998040950484
