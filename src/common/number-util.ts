export class NumberUtil {
  private static readonly zeroPaddingString = '00000000000000000000000000000000';
  private static readonly spacePaddingString = '                                ';

  public static numberToBuffer(buffer: DataView, pos: number, len: number, value: number) {
    const to = Math.min(buffer.byteLength, pos + len);

    value = Math.floor(value);
    while (pos < to) {
      const digit = value & 0xff;
      buffer.setUint8(pos, digit);
      value = (value - digit) / 256;
      pos++;
    }
  }

  public static numberFromBuffer(buffer: DataView, pos: number, len: number): number {
    let value = 0;
    const to = Math.min(buffer.byteLength, pos + len);

    for (let i = to - 1; i >= pos; i--) {
      value = value * 256 + buffer.getUint8(i);
    }

    return value;
  }

  public static integerToBuffer(val: number, size: number = 8): ArrayBuffer {
    const rslt = new DataView(new Uint8Array(size));

    NumberUtil.numberToBuffer(rslt, 0, size, val);
    return rslt.buffer;
  }

  public static integerFromBuffer(buffer: DataView, size: number = 8): number {
    return NumberUtil.numberFromBuffer(buffer, 0, size);
  }

  private static paddingNumber(value: number, radix: number, len: number, padding: string) {
    len = Math.min(32, len);
    return (padding + value.toString(radix)).slice(-len);
  }

  public static padSpace(value: number, len: number, radix: number = 10) {
    return NumberUtil.paddingNumber(value, radix, len, NumberUtil.spacePaddingString);
  }

  public static padZero(value: number, len: number, radix: number = 10) {
    return NumberUtil.paddingNumber(value, radix, len, NumberUtil.zeroPaddingString);
  }

  public static decimalString(value: number, len: number, digit: number = 0, fillZero: boolean = false) {
    const [up, dn] = value.toString(10).split('.');
    const padding = fillZero ? NumberUtil.zeroPaddingString : NumberUtil.spacePaddingString;
    if (digit > 0) {
      digit = Math.min(32, digit);
      const dnVal = (dn ? dn + NumberUtil.zeroPaddingString : NumberUtil.zeroPaddingString).substring(0, digit);
      const upCnt = Math.min(32, Math.max(len - 1 - digit, up.length));
      return (padding + up).slice(-upCnt) + '.' + dnVal;
    } else {
      const upCnt = Math.min(32, Math.max(len, up.length));
      return (padding + up).slice(-upCnt);
    }
  }

  public static readBEUInt(arr: Uint8Array, p: number, s: number) {
    let r = 0;
    for (let i = 0; i < s; i++) {
      r |= arr[p + i] << ((s - i - 1) * 8);
    }
    return r >>> 0;
  }

  public static readLEUInt(arr: Uint8Array, p: number, s: number) {
    let r = 0;
    for (let i = 0; i < s; i++) {
      r |= arr[p + i] << (i * 8);
    }
    return r >>> 0;
  }

  public static intValue(data: string, defaultValue: number = 0) {
    let rslt: number = defaultValue;
    try {
      if (data) {
        rslt = Number(data);
      }
    } catch (error) {
      // unused
    }

    return rslt;
  }
}
