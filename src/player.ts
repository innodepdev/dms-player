import $ from 'jquery';
import { Url } from './common/url';
import { BaseClient } from './core/base_client';
import { Remuxer } from './core/remuxer/remuxer';
import { PromiseWait } from './core/util/data-util';
import { getTagged } from './deps/bp_logger';

const Log = getTagged('wsp');

export interface WSPlayerOptions {
  url?: string;
  srcType: string;
  websocketUrl: string;
  vmsId?: number;
  devSerial?: number;
  channel?: number;
  media?: number;
  transcode?: number;
  flush?: number;
  token?: string;
  clientCreator: (options?: { [key: string]: any }) => BaseClient;
  errorHandler?: (e: Error) => void;
}

export class WSPlayer {
  private readonly clientCreator: (options?: { [key: string]: any }) => BaseClient;
  public player: HTMLVideoElement;
  public errorHandler: (e: Error) => void;
  public websocketUrl: string;
  public url: string;
  public client: BaseClient;
  public paused: boolean;
  public endpoint: Url;
  public remuxer: Remuxer;
  public pauseFlag: boolean = false;

  constructor(node: string | HTMLElement, opts: WSPlayerOptions) {
    // tslint:disable-next-line:prefer-conditional-expression
    if (typeof node === 'string') {
      this.player = document.getElementById(node) as HTMLVideoElement;
    } else {
      this.player = node as HTMLVideoElement;
    }

    this.errorHandler = opts.errorHandler || null;

    this.websocketUrl = null;
    this.url = null;
    this.clientCreator = opts.clientCreator;

    if (!opts.url) {
      if (opts.websocketUrl) {
        this.setSource(opts.url, opts.websocketUrl, opts).then();
      }
    } else {
      if (opts.url && opts.websocketUrl) {
        this.setSource(opts.url, opts.websocketUrl, opts).then();
      }
    }

    this.player.addEventListener(
      'streamPlay',
      async (e: Event) => {
        if (!this.isPlaying()) {
          e['detail'] !== null ? await this.start(e['detail'].startDate, e['detail'].speed) : await this.start();
          await this.player.play().catch(() => void 0);
        } else {
          Log.debug('already started, reset position');
          this.player.playbackRate = 1;
          this.player.currentTime = this.player.buffered.end(0);
        }
      },
      false
    );

    this.player.addEventListener(
      'streamStop',
      async () => {
        await this.stop();
      },
      false
    );

    this.player.addEventListener(
      'playbackPlay',
      async (e) => {
        if (!this.isPlaying()) {
          await this.startPlayback(false, e['detail'].dates, e['detail'].endDt, e['detail'].speed);
          await this.player.play().catch(() => void 0);
        } else {
          Log.debug('already playback started, reset position');
          this.player.playbackRate = 1;
          this.player.currentTime = this.player.buffered.end(0);
        }
      },
      false
    );

    this.player.addEventListener(
      'pause',
      async (e) => {
        if (e['detail']) {
          this.pauseFlag = true;
          this.player.pause();
        } else {
          if (this.player && !this.pauseFlag) {
            await this.player.play().catch(() => void 0);
          } else {
            this.pauseFlag = false;
          }
        }
      },
      false
    );

    this.player.addEventListener(
      'playerClose',
      async () => {
        await this.destroy();
      },
      false
    );

    $(this.player).on('ptzModeOn', async (e, param) => {
      if (param['detail']) {
        try {
          return await this.ptzModeOn(param['detail']);
        } catch (error) {
          this.errorHandler(error);
        }
      }
    });

    $(this.player).on('getPresetList', async (e, param) => {
      if (param['detail']) {
        try {
          return await this.ptzPresetList(param['detail']);
        } catch (error) {
          this.errorHandler(error);
        }
      }
    });


    this.player.addEventListener(
      'ptzControl',
      async (e) => {
        if (e['detail']) {
          await this.startPtz(e['detail']);
        }
      },
      false
    );

    $(this.player).on('getTimeline', async (e, param) => {
      if (param['detail']) {
        try {
          return await this.startTimeline(param['detail']);
        } catch (error) {
          this.errorHandler(error);
        }
      }
    });
  }

  // TODO: check native support
  public isPlaying() {
    return !(this.player.paused || this.client.paused);
  }

  public async setSource(sourceUrl: string, websocketUrl: string, opts: WSPlayerOptions) {
    try {
      this.endpoint = Url.parse(sourceUrl);
    } catch (e) {
      console.log(e);
      return;
    }
    this.url = sourceUrl;
    if (!websocketUrl) {
      Log.error(`invalid url: websocket`);
      return;
    }

    if (websocketUrl !== this.websocketUrl || !this.client) {
      this.websocketUrl = websocketUrl;
      if (this.client) {
        this.client.destroy();
      }

      this.client = this.clientCreator({
        websocketUrl,
        sourceUrl,
        opts,
        flush: opts.flush,
      });

    } else {
      this.client.reset();
    }

    this.client.setSource(this.endpoint);

    if (this.player.autoplay) {
      await this.start();
    }
    await Promise.resolve();
  }

  public async start(startDate?: number, speed?: number) {
    try {
      if (this.remuxer) {
        this.remuxer.destroy();
        this.remuxer = null;
      }
      this.remuxer = new Remuxer(this.player, this.client);
      this.remuxer.attachClient(this.client);
      await PromiseWait(100);

      if (this.client) {
        startDate ? await this.client.start(startDate, speed) : await this.client.start();
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    }
  }

  public async startPlayback(reReq: boolean, reqDates: string[], endDate: string, speed: number) {
    try {
      if (this.remuxer) {
        this.remuxer.destroy();
        this.remuxer = null;
      }
      this.remuxer = new Remuxer(this.player, this.client);
      this.remuxer.attachClient(this.client);
      await PromiseWait(100);

      if (this.client) {
        await this.client.startPlayback(reReq, reqDates, endDate, speed);
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    }
  }

  public async startPtz(ptzInfo: object) {
    try {
      if (this.client) {
        await this.client.startPtz(ptzInfo);
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    }
  }

  public async ptzModeOn(ptzLock: object) {
    try {
      if (this.client) {
        try {
          return await this.client.ptzModeOn(ptzLock);
        } catch (error) {
          this.errorHandler(error);
        }
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    }
  }

  public async ptzPresetList(command: object) {
    try {
      if (this.client) {
        try {
          return await this.client.ptzPresetList(command);
        } catch (error) {
          this.errorHandler(error);
        }
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    }
  }

  public async startTimeline(timeInfo: object) {
    try {
      if (this.client) {
        try {
          return await this.client.startTimeline(timeInfo);
        } catch (error) {
          this.errorHandler(error);
        }
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    }
  }

  public async stop() {
    if (this.client) {
      this.client.stop();
    }

    await Promise.resolve();
  }

  public async destroy() {
    if (this.player) {
      this.player = undefined;
    }
    if (this.client) {
      this.client.destroy();
    }
    if (this.remuxer) {
      this.remuxer.destroy();
      this.remuxer = null;
    }

    await Promise.resolve();
  }
}
