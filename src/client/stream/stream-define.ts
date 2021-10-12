import { TextDecoder } from 'text-encoding';
import { NumberUtil } from '../../common/number-util';
import { getTagged } from '../../deps/bp_logger';

const logger = getTagged('client:stream');

export type COMMAND_TYPE =
  | 'req' // request mode need response
  | 'res' // only response by request
  | 'msg'; // only message

export type PARAM_TYPE =
  | 'none'
  // stream related param type
  | 'rtsp'
  | 'live'
  | 'record'
  // ptz related param type
  | 'start'
  | 'stop'
  // event related param type
  | 'event'
  | 'enter'
  | 'leave';

export enum CommandCode {
  None = 0,
  SystemTest,
  SystemLast = 100,
  LiveStart,
  LivePause,
  LiveResume,
  LiveStop,
  LiveLast = 200,
  PlayBackStart,
  PlayBackLast = 300,
  PtzStart,
  PtzLock,
  PtzLast = 400,
  EventStart,
  EventLast = 500,
  Timeline,
  TImelineLast = 600,
}

export enum ResultCode {
  Success = 0,
  Failed = 1,
}

export enum PayloadType {
  None = 0,
  H264 = 1,
  AAC = 2,
}

export const StreamCommandVersionValue = 1.0;

export interface StreamCommandParam {
  [key: string]: any;
}

export interface StreamCommand {
  version: number;
  command: CommandCode;
  tranId: number;
  cmdType: COMMAND_TYPE;
  url: string;
  srcType?: string;
  result: ResultCode;
  param?: StreamCommandParam;
}

export interface StreamInformation {
  timescale?: number;
  sps?: string;
  pps?: string;
  config?: string;
  type: PayloadType;
  channel: number;
}

export interface PtzCommand {
  cmd: number;
  preset_no?: string;
  pan_spd?: number;
  tilt_spd?: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface StreamReceiveInterface {
  streamReceived(data: Uint8Array): void;
}

export interface StreamMessage {
  channel: number;
  timestamp: number;
  metaInfo?: string;
  data?: Uint8Array;
}

export function parseStreamMessage(buffer: ArrayBuffer): StreamMessage {
  let rslt: StreamMessage;
  do {
    if (!buffer || buffer.byteLength < 16) {
      logger.info(`invalid message to parse`);
      break;
    }

    const view = new DataView(buffer);
    if (view.getUint8(0) !== 0x24) {
      logger.info(`invalid message to parse: magic`);
      break;
    }

    let pos = 1;

    const channel = view.getUint8(pos);
    pos++;
    const length = view.getUint32(pos, true) + 6; // added size magic(1)/channel(1)/length(4)
    pos += 4;
    if (length > buffer.byteLength) {
      logger.info(`invalid message length: ${length} but ${buffer.byteLength - 6}`);
      break;
    }

    const timestamp = NumberUtil.numberFromBuffer(view, pos, 8);
    pos += 8;
    const metaLen = view.getUint16(pos, true);
    pos += 2;

    if (metaLen > length - pos) {
      logger.info(`invalid meta length ${metaLen} but remain ${buffer.byteLength - pos}`);
      break;
    }
    // MS Edge Supported
    if (!window['TextDecoder']) {
      window['TextDecoder'] = TextDecoder;
    }
    const metaInfo = metaLen > 0 ? new TextDecoder('utf8').decode(buffer.slice(pos, pos + metaLen)) : undefined;
    pos += metaLen;
    const dataLen = length - 10 - metaLen;
    const data = dataLen > 0 ? new Uint8Array(buffer.slice(pos, length)) : undefined;

    rslt = {
      channel,
      timestamp,
      metaInfo,
      data,
    };
  } while (false);
  // console.log(rslt.channel + ':' + rslt.timestamp + ' : ' + rslt.metaInfo + ' : ' + rslt.data.length);
  return rslt;
}

export function makeStreamMessage(ch: number, ts: number, meta: string, data: Uint8Array): Uint8Array {
  const dataLen = data ? data.byteLength : 0;
  const metaBuffer = meta.length > 0 ? new TextEncoder().encode(meta) : undefined;
  const metaLen = metaBuffer ? metaBuffer.byteLength : 0;

  const bufferLen =
    2 + // magic/channel
    4 + // data length
    8 + // timestamp
    2 + // meta data related length
    metaLen +
    dataLen;
  const buffer = new Uint8Array(bufferLen);

  if (buffer) {
    const view = new DataView(buffer);
    let pos = 0;

    view.setUint8(pos, 0x24); // magic
    pos++;
    view.setUint8(pos, ch & 0xff); // channel
    pos++;

    view.setUint32(pos, bufferLen - 6, true); // payload length
    pos += 4;
    NumberUtil.numberToBuffer(view, pos, 8, ts); // timestamp
    pos += 8;
    view.setUint16(pos, metaLen, true); // meta information length
    pos += 2;
    buffer.set(metaBuffer, pos); // meta information
    pos += metaLen;
    buffer.set(data, pos); // data
  }

  return buffer;
}
