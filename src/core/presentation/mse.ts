import { EventEmitter } from '../../deps/bp_event';
import { getTagged } from '../../deps/bp_logger';
import { BaseClient } from '../base_client';

const LOG_TAG = 'mse';
const Log = getTagged(LOG_TAG);

export class MSEBuffer {
  private mediaSource: any;
  private players: any[];
  private cleaning = false;
  private parent: MSE;
  private queue: Uint8Array[];
  private cleanResolvers: any[];
  private codec: string;
  private cleanRanges: any[];
  private sourceBuffer: any;
  private eventSource: EventEmitter;
  private timeEvent: any;

  public is_live: boolean;

  constructor(parent: MSE, codec: string) {
    this.mediaSource = parent.mediaSource;
    this.players = parent.players;
    this.cleaning = false;
    this.parent = parent;
    this.queue = [];
    this.cleanResolvers = [];
    this.codec = codec;
    this.cleanRanges = [];
    this.timeEvent = undefined;

    // Log.debug(`Use codec: ${codec}`);
    this.sourceBuffer = this.mediaSource.addSourceBuffer(codec);
    this.eventSource = new EventEmitter(this.sourceBuffer);

    this.eventSource.addEventListener('updatestart', (e: Event) => {
      // this.updating = true;
      // Log.debug('update start');
      if (this.cleaning) {
        // TODO 롤백
        // Log.debug(`${this.codec} cleaning start`);
      }
    });

    this.timeEvent = (() => {
      // buffer update 중이거나, 더이상 요청 할 시간이 없는 경우 return false;
      if (this.sourceBuffer.updating ||
        !parent.client.playbackOpt ||
        parent.client.playbackOpt.length === 0
      ) {
        return false;
      }
      if (this.mediaSource.readyState !== 'ended') {
        const currentDiff = Math.floor(this.sourceBuffer.buffered.end(0)) - Math.floor(this.players[0].currentTime);
        if (currentDiff < 20 && parent.client.requestFlag) {
          parent.client.requestFlag = false;
          parent.client.startPlayback(true);
        }
      }
    });

    this.players[0].addEventListener('timeupdate', this.timeEvent);

    this.eventSource.addEventListener('update', (e: Event) => {
      if (this.cleaning) {
        Log.debug(`${this.codec} cleaning update`);
      }
    });

    this.eventSource.addEventListener('updateend', (e: Event) => {
      // Log.debug('update end');
      // this.updating = false;
      if (this.cleaning) {
        // Log.debug(`${this.codec} cleaning end`);
        try {
          if (this.sourceBuffer.buffered.length && this.players[0].currentTime < this.sourceBuffer.buffered.start(0)) {
            this.players[0].currentTime = this.sourceBuffer.buffered.start(0);
          }
        } catch (e) {
          // TODO: do something?
        }
        while (this.cleanResolvers.length) {
          const resolver = this.cleanResolvers.shift();
          resolver();
        }
        this.cleaning = false;

        if (this.cleanRanges.length) {
          this.doCleanup();
          return;
        }
      } else {
        // Log.debug(`buffered: ${this.sourceBuffer.buffered.end(0)}, current ${this.players[0].currentTime}`);
      }
        this.feedNext();
    });

    this.eventSource.addEventListener('error', (e: Event) => {
      Log.debug(`Source buffer error: ${this.mediaSource.readyState}`);
      if (this.mediaSource.sourceBuffers.length) {
        this.mediaSource.removeSourceBuffer(this.sourceBuffer);
      }
      this.parent.eventSource.dispatchEvent('error');
    });

    this.eventSource.addEventListener('abort', (e: Event) => {
      // Log.debug(`Source buffer aborted: ${this.mediaSource.readyState}`);
      if (this.mediaSource.sourceBuffers.length) {
        this.mediaSource.removeSourceBuffer(this.sourceBuffer);
      }
      if (this.parent && this.parent.eventSource) {
        this.parent.eventSource.dispatchEvent('error');
      }
    });

    if (!this.sourceBuffer.updating) {
      this.feedNext();
    }
    // TODO: cleanup every hour for live streams
  }

  public destroy() {
    this.players[0].removeEventListener('timeupdate', this.timeEvent);
    this.eventSource.destroy();
    this.clear();
    this.queue = [];
    this.mediaSource.removeSourceBuffer(this.sourceBuffer);
  }

  public clear() {
    this.queue = [];
    const promises = [];
    for (let i = 0; i < this.sourceBuffer.buffered.length; ++i) {
      // TODO: await remove
      this.cleaning = true;
      promises.push(
        new Promise((resolve, reject) => {
          this.cleanResolvers.push(resolve);
          if (!this.sourceBuffer.updating) {
            this.sourceBuffer.remove(this.sourceBuffer.buffered.start(i), this.sourceBuffer.buffered.end(i));
            resolve();
          } else {
            this.sourceBuffer.onupdateend = () => {
              if (this.sourceBuffer) {
                if (this.mediaSource.readyState !== 'ended') {
                  this.sourceBuffer.remove(this.sourceBuffer.buffered.start(i), this.sourceBuffer.buffered.end(i));
                }
              }
              resolve();
            };
          }
        })
      );
    }
    return Promise.all(promises);
  }

  public setLive(is_live: boolean) {
    this.is_live = is_live;
  }

  public feedNext() {
    // Log.debug("feed next ", this.sourceBuffer.updating);
    if (!this.sourceBuffer.updating && !this.cleaning && this.queue.length) {
      this.doAppend(this.queue.shift());
      // TODO: if is live and current position > 1hr => clean all and restart
    }
  }

  public doCleanup() {
    if (!this.cleanRanges.length) {
      this.cleaning = false;
      this.feedNext();
      return;
    }
    const range = this.cleanRanges.shift();
    Log.debug(`${this.codec} remove range [${range[0]} - ${range[1]}).
                    \nUpdating: ${this.sourceBuffer.updating}
                    `);
    this.cleaning = true;
    this.sourceBuffer.remove(range[0], range[1]);
    // 0924수정
    // this.sourceBuffer.abort();
    // this.sourceBuffer.remove(0, this.players[0].currentTime - 10);
  }

  public initCleanup() {
    if (this.sourceBuffer.buffered.length && !this.sourceBuffer.updating && !this.cleaning) {
      Log.debug(`${this.codec} cleanup`);
      const removeBound = this.sourceBuffer.buffered.end(this.sourceBuffer.buffered.length - 1) - 2;

      for (let i = 0; i < this.sourceBuffer.buffered.length; ++i) {
        const removeStart = this.sourceBuffer.buffered.start(i);
        let removeEnd = this.sourceBuffer.buffered.end(i);
        if (this.players[0].currentTime <= removeStart || removeBound <= removeStart) continue;

        if (removeBound <= removeEnd && removeBound >= removeStart) {
          Log.debug(`Clear [${removeStart}, ${removeBound}), leave [${removeBound}, ${removeEnd}]`);
          removeEnd = removeBound;
          if (removeEnd !== removeStart) {
            this.cleanRanges.push([removeStart, removeEnd]);
          }
          continue; // Do not cleanup buffered range after current position
        }
        this.cleanRanges.push([removeStart, removeEnd]);
      }

      this.doCleanup();

      // let bufferStart = this.sourceBuffer.buffered.start(0);
      // let removeEnd = this.sourceBuffer.buffered.start(0) + (this.sourceBuffer.buffered.end(0) - this.sourceBuffer.buffered.start(0))/2;
      // if (this.players[0].currentTime < removeEnd) {
      //     this.players[0].currentTime = removeEnd;
      // }
      // let removeEnd = Math.max(this.players[0].currentTime - 3, this.sourceBuffer.buffered.end(0) - 3);
      //
      // if (removeEnd < bufferStart) {
      //     removeEnd = this.sourceBuffer.buffered.start(0) + (this.sourceBuffer.buffered.end(0) - this.sourceBuffer.buffered.start(0))/2;
      //     if (this.players[0].currentTime < removeEnd) {
      //         this.players[0].currentTime = removeEnd;
      //     }
      // }

      // if (removeEnd > bufferStart && (removeEnd - bufferStart > 0.5 )) {
      //     // try {
      //         Log.debug(`${this.codec} remove range [${bufferStart} - ${removeEnd}).
      //         \nBuffered end: ${this.sourceBuffer.buffered.end(0)}
      //         \nUpdating: ${this.sourceBuffer.updating}
      //         `);
      //         this.cleaning = true;
      //         this.sourceBuffer.remove(bufferStart, removeEnd);
      //     // } catch (e) {
      //     //     // TODO: implement
      //     //     Log.error(e);
      //     // }
      // } else {
      //     this.feedNext();
      // }
    } else {
      this.feedNext();
    }
  }

  public doAppend(data: Uint8Array) {
    // Log.log(MP4Inspect.mp4toJSON(data));
    const err = this.players[0].error;
    if (err) {
      Log.error(`Error occured: ${MSE.ErrorNotes[err.code]}`);
      try {
        this.players.forEach((video) => {
          video.stop();
        });
        this.mediaSource.endOfStream();
      } catch (e) {
        // error
      }
      this.parent.eventSource.dispatchEvent('error');
    } else {
      try {
        this.sourceBuffer.appendBuffer(data);
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          Log.debug(`${this.codec} quota fail`);
          this.queue.unshift(data);
          this.initCleanup();
          return;
        }
        // reconnect on fail
        Log.error(`Error occured while appending buffer. ${e.name}: ${e.message}`);
        this.parent.eventSource.dispatchEvent('error');
      }
    }
  }

  public feed(data: Uint8Array[]) {
    this.queue = this.queue.concat(data);
    // Log.debug(this.sourceBuffer.updating, this.updating, this.queue.length);
    if (this.sourceBuffer && !this.sourceBuffer.updating && !this.cleaning) {
      // Log.debug('enq feed');
      this.feedNext();
    }
  }
}

export class MSE {
  // static CODEC_AVC_BASELINE = "avc1.42E01E";
  // static CODEC_AVC_MAIN = "avc1.4D401E";
  // static CODEC_AVC_HIGH = "avc1.64001E";
  // static CODEC_VP8 = "vp8";
  // static CODEC_AAC = "mp4a.40.2";
  // static CODEC_VORBIS = "vorbis";
  // static CODEC_THEORA = "theora";

  private playing: boolean[];
  private is_live: boolean;
  private resolved: boolean;
  private mediaReady: Promise<void>;
  private _sourceOpen: () => void;
  private _sourceClose: () => void;
  private _sourceEnded: () => void;

  public players: HTMLVideoElement[];
  public ready: boolean;
  public updating: boolean;
  public mediaSource: MediaSource;
  public buffers: { [key: string]: MSEBuffer };
  public eventSource: EventEmitter;

  public client: BaseClient;

  static get ErrorNotes() {
    return {
      [MediaError.MEDIA_ERR_ABORTED]: 'fetching process aborted by user',
      [MediaError.MEDIA_ERR_NETWORK]: 'error occurred when downloading',
      [MediaError.MEDIA_ERR_DECODE]: 'error occurred when decoding',
      [MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED]: 'audio/video not supported',
    };
  }

  public static isSupported(codecs: string[]) {
    return (
      (window as any).MediaSource &&
      (window as any).MediaSource.isTypeSupported(`video/mp4; codecs="${codecs.join(',')}"`)
    );
  }

  constructor(players: HTMLVideoElement[], client: BaseClient) {
    this.client = client;
    this.players = players;
    const playing = this.players.map((video, idx) => {
      video.onplaying = () => {
        playing[idx] = true;
      };
      video.onpause = () => {
        playing[idx] = false;
      };
      return !video.paused;
    });
    this.playing = playing;
    this.mediaSource = new MediaSource();
    this.eventSource = new EventEmitter(this.mediaSource);
    this.reset();
  }

  public destroy() {
    this.reset();
    this.eventSource.destroy();
    this.mediaSource = null;
    this.eventSource = null;
  }

  public play() {
    this.players.forEach((video, idx) => {
      if (video.paused && !this.playing[idx]) {
        Log.debug(`player ${idx}: play`);
        video.play().catch(() => void 0);
      }
    });
  }

  public setLive(is_live: boolean) {
    for (const idx in this.buffers) {
      if (this.buffers.hasOwnProperty(idx)) this.buffers[idx].setLive(is_live);
    }
    this.is_live = is_live;
  }

  public async resetBuffers() {
    this.players.forEach((video, idx) => {
      if (!video.paused && this.playing[idx]) {
        video.pause();
        video.currentTime = 0;
      }
    });

    const promises = [];
    for (const bufferId in this.buffers) {
      if (this.buffers.hasOwnProperty(bufferId)) {
        const buffer = this.buffers[bufferId];
        promises.push(buffer.clear());
      }
    }
    await Promise.all(promises);
    this.mediaSource.endOfStream();
    this.mediaSource.duration = 0;
    this.mediaSource.clearLiveSeekableRange();
    this.play();
  }

  public clear() {
    this.reset();
    this.players.forEach((video) => {
      video.src = URL.createObjectURL(this.mediaSource);
    });

    return this.setupEvents();
  }

  public setupEvents() {
    this.eventSource.clear();
    this.resolved = false;
    this.mediaReady = new Promise((resolve, reject) => {
      this._sourceOpen = () => {
        // Log.debug(`Media source opened: ${this.mediaSource.readyState}`);
        if (!this.resolved) {
          this.resolved = true;
          resolve();
        }
      };
      this._sourceEnded = () => {
        if (this.mediaSource) {
          Log.debug(`Media source ended: ${this.mediaSource.readyState}`);
        }
      };
      this._sourceClose = () => {
        if (this.mediaSource) {
          Log.debug(`Media source closed: ${this.mediaSource.readyState}`);
        }
        if (this.resolved) {
          this.eventSource.dispatchEvent('sourceclosed');
        }
      };
      this.eventSource.addEventListener('sourceopen', this._sourceOpen);
      this.eventSource.addEventListener('sourceended', this._sourceEnded);
      this.eventSource.addEventListener('sourceclose', this._sourceClose);
    });
    return this.mediaReady;
  }

  public reset() {
    this.ready = false;
    for (const track in this.buffers) {
      if (this.buffers.hasOwnProperty(track)) {
        this.buffers[track].destroy();
        delete this.buffers[track];
      }
    }

    if (this.mediaSource.readyState === 'open') {
      this.mediaSource.duration = 0;
      this.mediaSource.endOfStream();
    }
    this.updating = false;
    this.resolved = false;
    this.buffers = {};
    // this.players.forEach((video)=>{video.src = URL.createObjectURL(this.mediaSource)});
    // TODO: remove event listeners for existing media source
    // this.setupEvents();
    // this.clear();
  }

  public async setCodec(track: string, mimeCodec: string) {
    await this.mediaReady;
    this.buffers[track] = new MSEBuffer(this, mimeCodec);
    this.buffers[track].setLive(this.is_live);
  }

  public feed(track: string, data: Uint8Array[]) {
    if (this.buffers[track]) {
      this.buffers[track].feed(data);
    }
  }
}
