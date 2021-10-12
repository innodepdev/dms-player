// import { getTagged } from '../../deps/bp_logger';

// const LOG_TAG = 'common:cmpl';
// const Log = getTagged(LOG_TAG);

export class WaitComplete<T> {
  private rejectFunction: (reason?: any) => void;
  private resolveFunction: (value?: T) => void;
  private waitTimer: any;
  private refrenceTranId: number;

  constructor(duration: number, resolve: (value?: T) => void, reject: (reason?: any) => void, tranId?: number) {
    this.rejectFunction = reject;
    this.resolveFunction = resolve;
    this.refrenceTranId = tranId;

    this.waitTimer = setTimeout(this.onWait.bind(this), duration);
    // Log.info(`start timer:${this.waitTimer}`);
  }

  public get tranId(): number {
    return this.refrenceTranId;
  }

  public cancel(msg: string) {
    if (this.waitTimer !== undefined ) {
      clearTimeout(this.waitTimer);
      this.waitTimer = undefined;
      this.rejectFunction(msg);
    }
  }

  public complete(param: T) {
    if (this.waitTimer !== undefined) {
      // Log.info(`complete`);
      clearTimeout(this.waitTimer);
      this.waitTimer = undefined;
      this.resolveFunction(param);
    }
  }

  private onWait() {
    this.resolveFunction(null);
    this.waitTimer = undefined;
  }
}
