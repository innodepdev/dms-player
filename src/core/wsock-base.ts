import { getTagged } from '../deps/bp_logger';
import { WaitComplete } from './util/wait-complete';

const Log = getTagged('transport:ws');

export abstract class WSocketBase {
  protected url: string;

  protected transaction: WaitComplete<any>;

  public get sequence(): number {
    return ++this.sequenceNumber;
  }

  public get connected(): boolean {
    return this.socketClient && this.socketClient.readyState === this.socketClient.OPEN;
  }

  public get protocol(): string {
    return this.protocolName;
  }

  private sequenceNumber: number = 0;
  private socketClient: WebSocket;
  private protocolName: string;
  private closeTran: WaitComplete<boolean>;

  constructor(url: string, protocol?: string) {
    this.url = url;
    this.protocolName = protocol ? protocol : '';

    this.onClose = this.onClose.bind(this);
    this.onOpen = this.onOpen.bind(this);
  }

  public start(duration: number = 3000): Promise<boolean> {
    this.socketClient = new WebSocket(this.url);
    this.socketClient.binaryType = 'arraybuffer';

    this.socketClient.onopen = this.onOpen.bind(this);
    this.socketClient.onmessage = this.onMessage.bind(this);
    this.socketClient.onclose = this.onClose.bind(this);
    this.socketClient.onerror = this.onError.bind(this);

    return new Promise<boolean>((resolve, reject) => {
      if (!this.socketClient) {
        resolve(false);
      } else {
        this.transaction = new WaitComplete<boolean>(duration, resolve, reject);
      }
    });
  }

  public send(data: string | Uint8Array) {
    if (!this.connected) {
      Log.info('connection failed');
    }

    this.socketClient.send(data);
  }

  public close() {
    if (this.connected) {
      return new Promise<boolean>((resolve, reject) => {
        this.closeTran = new WaitComplete<boolean>(3000, resolve, reject);
        this.socketClient.close(1000, 'normal close');
      });
    } else {
      return Promise.resolve(true);
    }
  }

  protected complete<T>(param: T) {
    if (this.transaction) {
      const wait: WaitComplete<T> = this.transaction;
      this.transaction = undefined;
      wait.complete(param);
    }
  }

  protected abstract onError(event: Event): void;

  protected abstract onMessage(event: MessageEvent): void;

  protected onClose(event: CloseEvent): void {
    // TODO: log 필요할 시 롤백
    // Log.info(`${this.url} on-close: ${event.code}, ${event.reason}`);
    if (this.closeTran) {
      this.closeTran.complete(this.connected);
      this.closeTran = undefined;
      this.socketClient = undefined;
    }
  }

  private onOpen(event: Event) {
    Log.info(`${this.protocolName} onOpen: ${JSON.stringify(event)}`);
    this.complete<boolean>(this.connected);
  }
}
