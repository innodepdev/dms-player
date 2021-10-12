import { Url } from '../common/url';
import { EventEmitter } from '../deps/bp_event';
import { getTagged } from '../deps/bp_logger';
import { BaseTransport } from './base_transport';
import { NalUnit } from './elementary/nal-unit';

const Log = getTagged('client:base');

export interface ClientOptions {
  [key: string]: any;
  flush: number;
}

export abstract class BaseClient {
  public options: { [key: string]: any };
  public eventSource: EventEmitter;
  public connected: boolean;
  public _transport: BaseTransport;
  public paused: boolean;
  public flushInterval: any;
  public seekable: boolean;
  public endpoint: Url;
  public sourceUrl: string;
  public sampleQueues: { [key: string]: NalUnit[][] };

  public _onData: () => void;
  public _onConnect: () => void;
  public _onDisconnect: () => void;

  // 저장영상 요청 portocol 옵션 (date, speed)
  public playbackOpt: string[];
  public requestFlag: boolean;

  constructor(options: ClientOptions = { flush: 100 }) {
    this.options = options;
    this.eventSource = new EventEmitter();
    this.requestFlag = false;

    Object.defineProperties(this, {
      sourceUrl: { value: null, writable: true }, // TODO: getter with validator
      paused: { value: true, writable: true },
      seekable: { value: false, writable: true },
      connected: { value: false, writable: true },
    });

    this._onData = () => {
      if (this.connected) {
        while (this.transport.dataQueue.length) {
          this.onData(this.transport.dataQueue.pop());
        }
      }
    };
    this._onConnect = this.onConnected.bind(this);
    this._onDisconnect = this.onDisconnected.bind(this);
  }

  public static streamType(): string {
    return null;
  }

  public get transport(): BaseTransport {
    return this._transport;
  }

  public destroy() {
    this.detachTransport();
  }

  public attachTransport(transport: BaseTransport) {
    if (this.transport) {
      this.detachTransport();
    }
    this._transport = transport;
    this.transport.eventSource.addEventListener('data', this._onData);
    this.transport.eventSource.addEventListener('connected', this._onConnect);
    this.transport.eventSource.addEventListener('disconnected', this._onDisconnect);
  }

  public detachTransport() {
    if (this.sampleQueues) {
      this.sampleQueues = undefined;
    }
    if (this.flushInterval) {
      this.stopStreamFlush();
    }
    if (this.playbackOpt) {
      this.resetPlaybackOpt();
    }
    if (this.transport) {
      this.transport.eventSource.removeEventListener('data', this._onData);
      this.transport.eventSource.removeEventListener('connected', this._onConnect);
      this.transport.eventSource.removeEventListener('disconnected', this._onDisconnect);
      this._transport = null;
    }
  }

  public abstract reset(): void;

  // Stream
  public async start(startDate?: number, speed?: number) {
    this.paused = false;
    await Promise.resolve();
  }

  public stop() {
    this.paused = true;
    this.stopStreamFlush();
  }

  // PlayBack
  public async startPlayback(reReq: boolean, reqDates?: string[], endDate?: string, speed?: number) {
    this.paused = false;
    await Promise.resolve();
  }

  public setPlaybackOpt(playbackOpt: string[]) {
    this.playbackOpt = playbackOpt;
  }

  public getPlaybackOpt() {
    return this.playbackOpt;
  }

  public resetPlaybackOpt() {
    this.playbackOpt = undefined;
  }

  // PTZ Control
  public async startPtz(ptzInfo: object) {
    await Promise.resolve();
  }

  public async ptzModeOn(ptzLock: object) {
    Log.log(`PTZ Mode On/Off started >>> ${ptzLock['ptzLock']}`);
    await Promise.resolve();
  }

  public async ptzPresetList(ptzLock: object) {
    await Promise.resolve();
  }

  public async startTimeline(timeInfo: object) {
    await Promise.resolve();
  }

  // tslint:disable-next-line:no-empty
  public seek(timeOffset: number) {}

  public setSource(source: Url) {
    this.stop();
    this.endpoint = source;
    this.sourceUrl = source.urlpath;
  }

  public startStreamFlush() {
    if (!this.paused) {
      this.flushInterval = setInterval(() => {
        if (!this.paused) {
          this.eventSource.dispatchEvent('flush');
        }
      }, this.options.flush);
    }
  }

  public startPlayBackStreamFlush() {
    if (!this.paused) {
      clearInterval(this.flushInterval);
      this.eventSource.dispatchEvent('flush');
    }
  }

  public stopStreamFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
  }

  public abstract onData(data: Uint8Array): void;

  public onConnected() {
    this.connected = true;
  }

  public onDisconnected() {
    this.connected = false;
  }
  public setCredentials(user: string, password: string) {
    this.endpoint.user = user;
    this.endpoint.pass = password;
    this.endpoint.auth = `${user}:${password}`;
  }
}
