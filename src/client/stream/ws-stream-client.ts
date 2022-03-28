import moment from 'moment';
import { errorMsgFuncCall } from '../../api/dms-player';
import { DateUtil } from '../../common/date-util';
import { NalUnit } from '../../core/elementary/nal-unit';
import { TrackInformation } from '../../core/remuxer/base';
import { base64ToArrayBuffer } from '../../core/util/binary';
import { WaitComplete } from '../../core/util/wait-complete';
import { WSocketBase } from '../../core/wsock-base';
import { getTagged } from '../../deps/bp_logger';
import { WSPlayerOptions } from '../../player';
import StreamClient from './stream-client';
import {
  CommandCode,
  parseStreamMessage,
  PtzCommand,
  ResultCode,
  StreamCommand,
  StreamCommandVersionValue,
  StreamInformation,
  StreamMessage,
} from './stream-define';

const Log = getTagged('ws:client:stream');

export let endDateTime: any;
export let firstFlag: boolean = true;
export let streamFlag: boolean = false;
export let playDateTime: object = {};

export class WsStreamClient extends WSocketBase {
  protected parent: StreamClient;
  private readonly streamUrl: string;
  private readonly srcType: string;
  private readonly options: WSPlayerOptions;
  private lastTranId: number = 0;
  private transactedCommands: { [id: number]: WaitComplete<StreamCommand> } = {};
  private previousTimestamp: number = 0;
  private startDate: number = 0;
  private timer: NodeJS.Timer;
  private customTimestamp = {
    reqFlag: false,
    playSpeed: 10,
    msgTimestamp: undefined
  };

  public ontracks: (tracks: TrackInformation[]) => void;

  constructor(parent: StreamClient, websocketUrl: string, streamUrl: string, options: any) {
    super(websocketUrl, 'stream');
    this.parent = parent;
    this.streamUrl = streamUrl;
    this.options = options.opts;
    this.srcType = this.options.srcType;
  }

  public get tranId(): number {
    return ++this.lastTranId;
  }

  // Request Command 정보
  public getCommand(command: CommandCode) {
    // vurix:// 프로토콜에 대한 대응 처리로 srcType이 vurix임에도 url이 vurix://가 아닌 경우 강제 처리 하도록 변경
    let url = this.streamUrl;
    if (this.srcType === 'vurix' && !url.startsWith('vurix://')) {
      url = `vurix://${this.options.token}@/${this.options.vmsId}/${this.options.devSerial}/${this.options.channel}/${this.options.media}`;
    }

    const cmd: StreamCommand = {
      version: StreamCommandVersionValue,
      command,
      tranId: this.tranId,
      cmdType: 'req',
      result: ResultCode.Success,
      url,
      param: {},
    };
    return cmd;
  }

  // DMS-Player 실시간 영상 Request
  public async requestStart(startDate?: number, speed?: number) {
    // 재생 배속 설정
    this.customTimestamp.playSpeed = speed;

    let cmd: StreamCommand;
    cmd = this.getCommand(CommandCode.LiveStart);
    if (startDate) {
      cmd.param['startDate'] = Number(startDate);
      cmd.param['speed'] = speed;
      this.startDate = startDate;
    } else {
      this.startDate = 0;
    }

    cmd.param['video'] = 1;
    cmd.param['audio'] = 2;
    cmd.param['transcode'] = this.options.transcode;

    const res: StreamCommand = await this.sendCommand(cmd);
    if (!res || !res.param) {
      return;
    }

    const resCode = Number(res.param.code);
    if (resCode >= 200) {
      // if error
      const errObj: object = {};
      errObj['code'] = res.param.code;
      errObj['funcName'] = 'Not Function';
      errObj['msg'] = res.param.message;
      errorMsgFuncCall(errObj, this.options);
    } else {
      this.parent.sampleQueues = {};
      const tracks: TrackInformation[] = [];
      for (const name in res.param) {
        if (!res.param.hasOwnProperty(name)) continue;
        const streamInfos = res.param[name] as StreamInformation;
        tracks.push({
          duration: 0,
          type: streamInfos.type,
          sps: base64ToArrayBuffer(streamInfos.sps),
          pps: base64ToArrayBuffer(streamInfos.pps),
        });

        this.parent.sampleQueues[streamInfos.type] = [];
      }

      if (this.ontracks) {
        this.ontracks(tracks);
      }
      streamFlag = true;
    }
  }

  // DMS-Player 저장 영상 Request
  public async requestPlaybackStart(reReq: boolean, reqDates: object, endDate?: number, speed?: number) {
    if (endDate) {
      // 웹소켓 수신 데이터 timestamp 비교를 위해 13자리 변환
      // endDateTime 이후 수신 되는 메세지는 무시.
      endDateTime = DateUtil.dateToUtcMs(DateUtil.utcToDate(endDate));
    }

    const cmd = this.getCommand(CommandCode.PlayBackStart);

    cmd.param['video'] = 1;
    cmd.param['audio'] = 2;
    cmd.param['transcode'] = this.options.transcode;
    cmd.param['startDate'] = reqDates['startDt'];
    cmd.param['endDate'] = reqDates['endDt'];
    cmd.param['speed'] = speed || 10;

    const res: StreamCommand = await this.sendCommand(cmd);
    if (!res || !res.param) {
      return;
    }

    const resCode = Number(res.param.code);
    if (resCode >= 200) {
      // if error
      const errObj: object = {};
      errObj['code'] = res.param.code;
      errObj['funcName'] = 'Not Function';
      errObj['msg'] = res.param.message;
      errorMsgFuncCall(errObj, this.options);
    } else {
      if (!reReq) {
        this.parent.sampleQueues = {};
        const tracks: TrackInformation[] = [];
        for (const name in res.param) {
          if (!res.param.hasOwnProperty(name)) continue;
          const streamInfos = res.param[name] as StreamInformation;
          tracks.push({
            duration: 0,
            type: streamInfos.type,
            sps: base64ToArrayBuffer(streamInfos.sps),
            pps: base64ToArrayBuffer(streamInfos.pps),
          });
          this.parent.sampleQueues[streamInfos.type] = [];
        }
        if (this.ontracks) {
          this.ontracks(tracks);
        }
      }
    }
  }

  // DMS-Player PTZ 동작 관련 Request
  public async requestPtzStart(ptzInfo: object) {
    const cmd = this.getCommand(CommandCode.PtzStart);

    const param: PtzCommand = {
      cmd: ptzInfo['ptzCmd'],
      preset_no: ptzInfo['ptzPresetNo'],
      pan_spd: ptzInfo['speed'],
      tilt_spd: ptzInfo['speed'],
      x1: ptzInfo['startX'],
      y1: ptzInfo['startY'],
      x2: ptzInfo['endX'],
      y2: ptzInfo['endY'],
    };
    cmd.param['ptz'] = param;

    const res: StreamCommand = await this.sendCommand(cmd);
    if (!res || !res.param) {
      return;
    }
  }

  // DMS-Player Preset 관련 Request
  public async requestPtzPresetList(command: object) {

    const cmd = this.getCommand(CommandCode.PtzStart);

    cmd.param['ptz'] = {
      cmd: command['ptzCmd'],
    };

    const res: StreamCommand = await this.sendCommand(cmd);
    if (!res || !res.param) {
      return;
    } else {
      return res;
    }
  }

  // DMS-Player PTZ Lock, UnLock Request
  public async requestPtzLockOn(ptzLock: object) {
    const cmd = this.getCommand(CommandCode.PtzLock);

    cmd.param['ptzLock'] = ptzLock['ptzLock'];

    const res: StreamCommand = await this.sendCommand(cmd);

    return res;
  }

  // DMS-Player TimeLine 정보 Request
  public async requestTimeline(timeInfo: object) {
    const cmd = this.getCommand(CommandCode.Timeline);

    cmd.param['startDate'] = Number(timeInfo['startDate']);
    cmd.param['endDate'] = Number(timeInfo['endDate']);

    const res: StreamCommand = await this.sendCommand(cmd);
    if (!res || !res.param) {
      return;
    } else {
      return res;
    }
  }

  // DMS-Player 수신 정지
  public async requestStop() {
    // stop
    if (!this.connected) {
      await Promise.resolve();
      return;
    }

    clearTimeout(this.timer);

    const cmd: StreamCommand = {
      version: StreamCommandVersionValue,
      command: CommandCode.LiveStop,
      tranId: this.tranId,
      cmdType: 'req',
      result: ResultCode.Success,
      url: this.streamUrl,
      srcType: this.srcType,
      param: {
        video: 1,
        audio: 2,
      },
    };

    if (this.startDate > 0) {
      cmd.param['startDate'] = this.startDate;
    }

    const res: StreamCommand = await this.sendCommand(cmd);
    if (!res || !res.param) {
      return;
    }
    this.parent.sampleQueues = {};
    this.previousTimestamp = 0;
    await Promise.resolve();
  }

  public async reset() {
    endDateTime = undefined;
    firstFlag = true;
    streamFlag = false;
    await this.close();
    await Promise.resolve();
  }

  protected onError(event: Event): void {
    Log.info(`${this.url} have error`);
  }

  protected convertTimestamp(): void {
    const virtualOrigin = this.customTimestamp.msgTimestamp;
    const realOrigin = Date.now();
    const factor = this.customTimestamp.playSpeed / 10;
    const getVirtual = (time) => {
      return new Date(virtualOrigin + (time - realOrigin) * factor);
    };

    const startTime = () => {
      const now = new Date();
      playDateTime[this.options.url] = moment(getVirtual(now));
      // playDateTime = moment(getVirtual(now));
      this.timer = setTimeout(startTime, 1000 / factor - (now.getMilliseconds() % (1000 / factor)));
    };

    startTime();
  }

  protected onMessage(event: MessageEvent): void {
    try {
      if (typeof event.data === 'string') {
        const command: StreamCommand = JSON.parse(event.data);
        if (command.param.msg !== 'stream closed') {
          // Log.debug(`onMessage recv:${JSON.stringify(event.data)}`);
          if (command.cmdType === 'res' && this.transactedCommands.hasOwnProperty(command.tranId)) {
            if (command['result'] === 0 && command['command'] === 201) {
              this.parent.requestFlag = true;
            }
            this.transactedCommands[command.tranId].complete(command);
            delete this.transactedCommands[command.tranId];
          } else {
            this.onCommandReceived(command);
          }
        } else {
          errorMsgFuncCall(false, this.options);
        }
      } else if (event.data instanceof ArrayBuffer) {
        const msg = parseStreamMessage(event.data);

        if (!this.customTimestamp.reqFlag) {
          this.customTimestamp.reqFlag = true;
          this.customTimestamp.msgTimestamp = msg.timestamp;
          this.convertTimestamp();
        }

        if (msg.channel === 1) {
          this.splitVideoNAL(msg);
        }
      }
    } catch (error) {
      Log.error(`${this.url} error while onMessage: ${error}`);
    }
  }

  private splitVideoNAL(msg: StreamMessage) {
    const data = msg.data;
    if (!data) {
      return;
    }
    try {
      let totalLen = data.byteLength;
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      let pos = 0;
      const nals: NalUnit[] = [];

      while (totalLen > 0) {
        const nalLen = view.getUint32(pos, false) + 4;
        // Log.info(`totalLen:${totalLen}, nalLen:${nalLen}`);
        if (nalLen === 5) {
          const nalu = new NalUnit();
          nalu.setRawData(data, msg.timestamp, msg.metaInfo);
          nals.push(nalu);
          pos = totalLen;
          totalLen = 0;
        } else if (nalLen > totalLen) {
          break;
        } else {
          const nalu = new NalUnit();
          nalu.setRawData(data.slice(pos, pos + nalLen), msg.timestamp, msg.metaInfo);
          nals.push(nalu);
          totalLen -= nalLen;
          pos += nalLen;
        }
      }

      if (nals.length > 0) {
        if (this.previousTimestamp === 0) {
          console.log('%d: %d NAL %d, first', new Date().getTime(), msg.timestamp, nals.length);
        }
        //  else {
        //   console.log(
        //     '%d: %d NAL %d, %d',
        //     new Date().getTime(),
        //     msg.timestamp,
        //     nals.length,
        //     msg.timestamp - this.previousTimestamp
        //   );
        // }
        this.previousTimestamp = msg.timestamp;
      }

      nals.forEach((nalu) => {
        // 실시간 영상
        if (streamFlag) {
          if (this.parent.sampleQueues[msg.channel]) {
            this.parent.sampleQueues[msg.channel].push([nalu]);
          }
        } else if (nalu.gs === 1 && endDateTime > msg.timestamp) {
          // IFrame 체크 및 영상 요청 종료 시간 이후 메시지 수신 방지
          if (this.parent.sampleQueues[msg.channel]) {
            firstFlag = false;
            if (this.parent.sampleQueues[msg.channel].length > 0) {
              this.parent.startPlayBackStreamFlush();
            }
            this.parent.sampleQueues[msg.channel].push([nalu]);
          }
        } else {
          if (!firstFlag) {
            if (this.parent.sampleQueues[msg.channel]) {
              this.parent.sampleQueues[msg.channel].push([nalu]);
            }
          }
        }
      });
    } catch (error) {
      Log.error(`${this.url} error while splitVideoNAL: ${error}`);
    }
  }

  private sendCommand(command: StreamCommand): Promise<StreamCommand> {
    const self = this;
    // console.log(JSON.stringify(command, null, 4));
    try {
      return new Promise<StreamCommand>((resolve, reject) => {
        const compl = new WaitComplete<StreamCommand>(5000, resolve, reject, command.tranId);
        self.transactedCommands[command.tranId] = compl;
        const encoded = JSON.stringify(command);
        self.send(encoded);
      });
    } catch (error) {
      Log.info(`${self.url} command send failed`);
    }
    return Promise.resolve(null);
  }

  private onCommandReceived(command: StreamCommand) {
    // playback Re Request
    if (command['result'] === 0 && command['command'] === 201) {
      this.parent.requestFlag = true;
    }
    // do
    // Log.debug(`${this.url} recv:${JSON.stringify(command)}`);
  }
}
