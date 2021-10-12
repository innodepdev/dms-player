import { Url } from '../common/url';
import { EventEmitter } from '../deps/bp_event';

export class BaseRequest {
  public data: string | Uint8Array;

  constructor(data: string | Uint8Array) {
    this.data = data;
    this.before = (data) => {
      return Promise.resolve(data);
    };
  }

  public send() {
    return this.before(this.data);
  }

  public before: (param?: any) => void = (fn) => {
    return Promise.resolve();
  };
}

export class BaseTransport {
  public endpoint: Url;
  public stream_type: string;
  public eventSource: EventEmitter;
  public dataQueue: Uint8Array[];

  constructor(endpoint: Url, stream_type: string, config: { [key: string]: any } = {}) {
    this.stream_type = stream_type;
    this.endpoint = endpoint;
    this.eventSource = new EventEmitter();
    this.dataQueue = [];
  }

  public static canTransfer(stream_type: string) {
    return BaseTransport.streamTypes().includes(stream_type);
  }

  public static streamTypes() {
    return [];
  }

  public destroy() {
    this.eventSource.destroy();
  }

  public connect(): Promise<any> {
    return Promise.resolve();
  }

  public disconnect(): Promise<any> {
    // TO be impemented
    return Promise.resolve();
  }

  public async reconnect() {
    return this.disconnect().then(() => {
      return this.connect();
    });
  }

  public setEndpoint(endpoint: Url) {
    this.endpoint = endpoint;
    return this.reconnect();
  }

  public send(data: string | Uint8Array, callback?: (seq) => void) {
    // TO be impemented
    // return this.prepare(data).send();
  }

  public prepare(data: string | Uint8Array) {
    // TO be impemented
    // return new Request(data);
  }

  // onData(type, data) {
  //     this.eventSource.dispatchEvent(type, data);
  // }
}
