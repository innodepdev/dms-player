import { playerOption } from '../../api/dms-player';
import { Url } from '../../common/url';
import { BaseClient, ClientOptions } from '../../core/base_client';
import { TrackInformation } from '../../core/remuxer/base';
import { getTagged } from '../../deps/bp_logger';
import { WsStreamClient } from './ws-stream-client';

const LOG_TAG = 'client:stream';
const Log = getTagged(LOG_TAG);

export default class StreamClient extends BaseClient {
  public static creator(options?: ClientOptions): StreamClient {
    return new StreamClient(options);
  }

  public static streamType(): string {
    return 'stream';
  }

  public streamClient: WsStreamClient;

  constructor(
    options: ClientOptions = {
      flush: playerOption['flush'],
    }
  ) {
    super(options);
    this.streamClient = new WsStreamClient(this, options.websocketUrl, options.sourceUrl, options);
    this.streamClient.ontracks = (tracks: TrackInformation[]) => {
      this.eventSource.dispatchEvent('tracks', tracks);
      this.startStreamFlush();
    };
    this.sampleQueues = {};
  }
  public onData(data: Uint8Array): void {
    // throw new Error("Method not implemented.");
  }

  public setSource(url: Url) {
    super.setSource(url);
  }

  public reset() {
    this.sampleQueues = {};
  }

  public destroy() {
    Log.info('WebSocket Destroy');
    this.streamClient.close();
    return super.destroy();
  }

  public async start(startDate?: number, speed?: number) {
    try {
      startDate ? await super.start(startDate, speed) : await super.start();
      if (!this.streamClient.connected) {
        if (await this.streamClient.start.call(this.streamClient)) {
          this.onConnected();
        } else {
          throw new Error('connection failed to service');
        }
      }
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }

    try {
      // do service
      await super.resetPlaybackOpt();
      startDate
        ? this.streamClient.requestStart.call(this.streamClient, startDate, speed)
        : this.streamClient.requestStart.call(this.streamClient);
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
  }

  public async startPlayback(reReq: boolean, reqDates?: string[], endDate?: string, speed?: number) {
    try {
      await super.startPlayback(reReq, reqDates, endDate, speed);
      if (!this.streamClient.connected) {
        if (await this.streamClient.start.call(this.streamClient)) {
          this.onConnected();
        } else {
          throw new Error('connection failed to service');
        }
      }
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
    try {
      let reqDate;
      if (!(await super.getPlaybackOpt())) {
        // 저장되어 있는 요청시간이 없는 경우
        reqDate = reqDates.shift();
        await super.setPlaybackOpt(reqDates);
      } else {
        reqDate = await super.getPlaybackOpt().shift();
        await super.setPlaybackOpt(await super.getPlaybackOpt());
      }
      await this.streamClient.requestPlaybackStart.call(this.streamClient, reReq, reqDate, endDate, speed); // 분할 요청 시간 첫번째 요청.
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
  }

  public async startPtz(ptzInfo: object) {
    try {
      await super.startPtz(ptzInfo);
      if (this.streamClient.connected) {
        await this.streamClient.requestPtzStart.call(this.streamClient, ptzInfo);
      }
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
  }

  public async ptzModeOn(ptzLock: object) {
    try {
      await super.ptzModeOn(ptzLock);
      if (this.streamClient.connected) {
        try {
          return await this.streamClient.requestPtzLockOn.call(this.streamClient, ptzLock);
        } catch (error) {
          Log.error(`error while start: ${error}`);
        }
      }
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
  }

  public async ptzPresetList(command: object) {
    try {
      await super.ptzPresetList(command);
      if (this.streamClient.connected) {
        try {
          return await this.streamClient.requestPtzPresetList.call(this.streamClient, command);
        } catch (error) {
          Log.error(`error while start: ${error}`);
        }
      }
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
  }

  public async startTimeline(timeInfo: object) {
    try {
      await super.startTimeline(timeInfo);
      if (!this.streamClient.connected) {
        if (await this.streamClient.start.call(this.streamClient)) {
          this.onConnected();
        } else {
          throw new Error('connection failed to service');
        }
      }
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
    try {
      if (this.streamClient.connected) {
        try {
          return await this.streamClient.requestTimeline.call(this.streamClient, timeInfo);
        } catch (error) {
          Log.error(`error while start: ${error}`);
        }
      }
    } catch (error) {
      Log.error(`error while start: ${error}`);
      throw error;
    }
  }

  public stop() {
    super.stop();
    this.eventSource.dispatchEvent('');
    this.streamClient.requestStop.call(this.streamClient);
    this.onDisconnected();
  }

  public onConnected() {
    super.onConnected();
  }

  public onDisconnected() {
    super.onDisconnected();
  }
}
