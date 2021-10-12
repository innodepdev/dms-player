import { getTagged } from '../deps/bp_logger';

const logger = getTagged('client:time');

export class TimestampScaler {

  private timeFrom: number;
  private timeLast: number;
  private timeScale: number;

  private tsScale: number = 90000;
  private tsFrom: number;
  private tsLast: number;
  private currentFrameCount: number;
  private totalFrameCount: number;

  public get lastTimestamp(): number { return this.tsLast; }
  public get lastTime(): number { return this.timeLast; }
  public get totalFrames(): number { return this.totalFrameCount; }

  public get fps(): number {
    if (this.currentFrameCount > 0) {
      return (this.timeLast - this.timeFrom) / this.currentFrameCount;
    }

    return 0;
  }

  public setScale(tsScale: number, timeScale: number = 1000) {
    this.tsScale = tsScale;
    this.timeScale = timeScale;
    logger.info(`timescale: ${tsScale}/${timeScale}`);
    this.totalFrameCount = 0;
  }

  public convert(ts: number): number {
    if (this.tsFrom === undefined) {
      this.reset(ts);
    }

    if (this.tsLast > ts) {
      // abnormal case. timestamp should be reverse
      const tsGap = Math.max(1, this.currentFrameCount > 0 ? (this.tsLast - this.tsFrom) / this.currentFrameCount : this.tsScale / 30);
      this.reset(ts - tsGap);
    }

    if (this.tsLast < ts) {
      // normal case
      const tsGap = ts - this.tsFrom;
      const delta = tsGap * this.timeScale / this.tsScale;
      this.currentFrameCount++;
      this.totalFrameCount++;
      // logger.debug(`TIMESTAMP(${this.totalFrameCount}): ${
      //   ts}/${ts - this.tsLast}: ${this.timeFrom + delta}/${this.timeFrom + delta - this.timeLast}`);
      this.tsLast = ts;
      this.timeLast = Math.floor(this.timeFrom + delta);
    }

    return this.timeLast;
  }

  protected reset(ts: number) {
    this.tsFrom = ts;
    this.timeFrom = Date.now();
    this.timeLast = this.timeFrom;
    this.tsLast = this.tsFrom;
    this.currentFrameCount = 0;
  }

}
