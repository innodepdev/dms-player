import { EventEmitter, EventSourceWrapper } from '../../deps/bp_event';
import { getTagged } from '../../deps/bp_logger';
import { BaseClient } from '../base_client';
import { PayloadType } from '../defs';
import { MP4 } from '../iso-bmff/mp4-generator';
import { MSE } from '../presentation/mse';
import { AACRemuxer } from './aac-remuxer';
import { BaseRemuxer, TrackInformation } from './base';
import { H264Remuxer } from './h264-remuxer';

const LOG_TAG = 'remuxer';
const Log = getTagged(LOG_TAG);

export class Remuxer {
  static get TrackConverters() {
    return {
      [PayloadType.H264]: H264Remuxer,
      [PayloadType.AAC]: AACRemuxer,
    };
  }

  static get TrackScaleFactor() {
    return {
      [PayloadType.H264]: 1.01, // 4,
      [PayloadType.AAC]: 0,
    };
  }

  static get TrackTimescale() {
    return {
      [PayloadType.H264]: 1000, // 22500,
      [PayloadType.AAC]: 0,
    };
  }

  private mse: MSE;
  private eventSource: EventEmitter;
  private mseEventSource: EventSourceWrapper;
  private errorListener: any;
  private closeListener: any;
  private errorDecodeListener: any;
  private tracks: { [key: number]: BaseRemuxer } = {};
  private initialized = false;
  private initSegments = {};
  private codecs = [];
  private client: BaseClient;
  private clientEventSource: EventSourceWrapper;
  private samplesListener: any;
  private audioConfigListener: any;
  private _onTracks: () => void;
  private _flush: () => void;
  private _clear: () => void;
  public enabled: boolean = false;

  constructor(mediaElement: HTMLVideoElement, client: BaseClient) {
    this.mse = new MSE([mediaElement], client);
    this.eventSource = new EventEmitter();
    this.mseEventSource = new EventSourceWrapper(this.mse.eventSource);

    this.reset();

    this.errorListener = this.mseClose.bind(this);
    this.closeListener = this.mseClose.bind(this);
    this.errorDecodeListener = this.mseErrorDecode.bind(this);

    this.eventSource.addEventListener('ready', this.init.bind(this));
  }

  public initMSEHandlers() {
    this.mseEventSource.on('error', this.errorListener);
    this.mseEventSource.on('sourceclosed', this.closeListener);
    this.mseEventSource.on('errordecode', this.errorDecodeListener);
  }

  public async reset() {
    this.tracks = {};
    this.initialized = false;
    this.initSegments = {};
    this.codecs = [];
    this.enabled = false;
    await this.mse.clear.call(this.mse);
    this.initMSEHandlers();
  }

  public destroy() {
    this.mseEventSource.destroy();
    this.mse.destroy();
    this.mse = null;
    this.detachClient();
    this.eventSource.destroy();
  }

  public onTracks(tracks: CustomEvent<TrackInformation[]>) {
    // Log.debug(`ontracks: `, tracks.detail);
    // store available track types
    for (const track of tracks.detail) {
      this.tracks[track.type] = new Remuxer.TrackConverters[track.type](
        Remuxer.TrackTimescale[track.type],
        Remuxer.TrackScaleFactor[track.type]
      );

      this.tracks[track.type].timeOffset = 0;
      // if (track.duration) {
      //   this.tracks[track.type].mp4track.duration =
      //     track.duration * (this.tracks[track.type].timescale || Remuxer.TrackTimescale[track.type]);
      //   this.tracks[track.type].duration = track.duration;
      // } else {
      this.tracks[track.type].duration = 1;
      // }

      // this.tracks[track.type].duration
    }
    this.mse.setLive(!this.client.seekable);
    console.log('%d: on-tracks: %o', new Date().getTime(), tracks);
  }

  public setTimeOffset(timeOffset: number, track: TrackInformation) {
    if (this.tracks[track.type]) {
      this.tracks[track.type].timeOffset = timeOffset; // this.tracks[track.type].scaleFactor;
    }
  }

  public async init() {
    const tracks = [];
    this.codecs = [];
    const initmse: Array<Promise<void>> = [];
    const initPts: number = Infinity;
    const initDts: number = Infinity;

    for (const track_type in this.tracks) {
      if (this.tracks.hasOwnProperty(track_type)) {
        const track = this.tracks[track_type];
        if (!MSE.isSupported([track.mp4track.codec])) {
          throw new Error(`${track.mp4track.type} codec ${track.mp4track.codec} is not supported`);
        }
        tracks.push(track.mp4track);
        this.codecs.push(track.mp4track.codec);
        track.init(initPts, initDts /*, false*/);
        // initPts = Math.min(track.initPTS, initPts);
        // initDts = Math.min(track.initDTS, initDts);
      }
    }

    for (const track_type in this.tracks) {
      if (this.tracks.hasOwnProperty(track_type)) {
        const track = this.tracks[track_type];
        // track.init(initPts, initDts);
        this.initSegments[track_type] = MP4.initSegment(
          [track.mp4track],
          track.duration * track.timescale,
          track.timescale
        );
        initmse.push(this.initMSE(track_type, track.mp4track.codec));
      }
    }

    await Promise.all(initmse);
    this.initialized = true;
    this.enabled = true;
  }

  public async initMSE(track_type: string, codec: string) {
    if (MSE.isSupported(this.codecs)) {
      await this.mse.setCodec(track_type, `${PayloadType.map[track_type]}/mp4; codecs="${codec}"`);
      this.mse.feed(track_type, this.initSegments[track_type]);
    } else {
      throw new Error('Codecs are not supported');
    }
  }

  public mseClose() {
    // this.mse.clear();
    this.client.stop();
    this.eventSource.dispatchEvent('stopped');
  }

  public mseErrorDecode() {
    if (this.tracks[2]) {
      Log.warn(this.tracks[2].mp4track.type);
      this.mse.buffers[2].destroy();
      delete this.tracks[2];
    }
  }

  public flush() {
    const processCount = this.onSamples();
    // Log.info(`enter flush: ${processCount}`);

    if (!this.initialized) {
      // Log.info(`Initialize...`);
      if (processCount > 0) {
        if (Object.keys(this.tracks).length) {
          for (const track_type in this.tracks) {
            if (this.tracks.hasOwnProperty(track_type)) {
              if (!this.tracks[track_type].readyToDecode || !this.tracks[track_type].samples.length) return;
              // Log.debug(`Init MSE for track ${this.tracks[track_type].mp4track.type}`);
            }
          }
          this.eventSource.dispatchEvent('ready');
        }
      }
    } else {
      // console.log(`queued count ${processCount}`);
      for (const track_type in this.tracks) {
        if (this.tracks.hasOwnProperty(track_type)) {
          const track = this.tracks[track_type];
          const pay = track.getPayload();
          if (pay && pay.byteLength) {
            this.mse.feed(track_type, [
              MP4.moof(track.seq, track.scaled(track.firstDTS), track.mp4track),
              MP4.mdat(pay),
            ]);
            track.flush();
          }
        }
      }
    }
    // console.log('%d: after flush', new Date().getTime());
  }

  public onSamples(): number {
    let processNalunit = 0;
    try {
      for (const qidx in this.client.sampleQueues) {
        if (this.client.sampleQueues.hasOwnProperty(qidx)) {
          const queue = this.client.sampleQueues[qidx];
          if (this.tracks[qidx].getQueueSize() === 0) {
            while (queue.length) {
              const units = queue.shift();

              if (units) {
                for (const chunk of units) {
                  if (this.tracks[qidx]) {
                    processNalunit++;
                    this.tracks[qidx].remux(chunk);
                  }
                }
              } else {
                if (!this.initialized) {
                  delete this.tracks[qidx];
                }
              }
              if (queue[0] !== undefined) {
                if (queue[0][0] !== undefined) {
                  if (queue[0][0]['gs'] !== undefined) {
                    if (queue[0][0]['gs'] === 1) {
                      // 다음 프레임이 GOP의 시작이므로, 일단 셈플링을 중지
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      throw error;
    }

    return processNalunit;
  }

  public onAudioConfig(ev: any) {
    if (this.tracks[ev.detail.pay]) {
      this.tracks[ev.detail.pay].setConfig(ev.detail.config);
    }
  }
  public attachClient(client: BaseClient) {
    this._onTracks = this.onTracks.bind(this);
    this._flush = this.flush.bind(this);
    this._clear = this.clear.bind(this);
    this.detachClient();
    this.client = client;
    this.clientEventSource = new EventSourceWrapper(this.client.eventSource);
    this.clientEventSource.on('samples', this.samplesListener);
    this.clientEventSource.on('audio_config', this.audioConfigListener);
    this.clientEventSource.on('tracks', this._onTracks);
    this.clientEventSource.on('flush', this._flush);
    this.clientEventSource.on('clear', this._clear);
  }

  public clear() {
    this.reset();
    this.mse.clear().then(() => {
      this.initMSEHandlers();
    });
  }

  public detachClient() {
    if (this.client) {
      this.clientEventSource.off('samples', this.samplesListener);
      this.clientEventSource.off('audio_config', this.audioConfigListener);
      this.clientEventSource.off('tracks', this._onTracks);
      this.clientEventSource.off('flush', this._flush);
      this.clientEventSource.off('clear', this._clear);
      this.clientEventSource.destroy();

      this.client = null;
    }
  }
}
