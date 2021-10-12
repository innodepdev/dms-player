export class AACFrame {
  public dts: number;
  public pts: number;
  public data: Uint8Array;

  constructor(data: Uint8Array, dts: number, pts: number = 0) {
    this.dts = dts;
    this.pts = pts ? pts : this.dts;

    this.data = data; // .subarray(offset);
  }

  public getData() {
    return this.data;
  }

  public getSize() {
    return this.data.byteLength;
  }
}
