import moment from 'moment';

export class DateUtil {
  // 10자리 UTC => format 문자열 변환
  public static utcToString(date: number, pattern: string) {
    return moment(moment(Number(String(date + '000'))).toDate()).format(pattern);
  }

  // 10자리 UTC => Date 객체 변환
  public static utcToDate(date: number) {
    return moment(Number(String(date + '000'))).toDate();
  }

  // Date 객체 millieSecond 포함 13자리 UTC 변환
  public static dateToUtcMs(date: Date) {
    return moment.utc(date).valueOf();
  }

  // Date 객체 Seconds Add (시간(초) 더하기)
  public static dateAddSeconds(date: Date, seconds: number) {
    return moment(date)
      .add(seconds, 'seconds')
      .toDate();
  }

  // Date 객체 UTC 10자리 변환
  public static dateToUtc(date: Date) {
    return Number(moment.utc(date).format('X'));
  }

  // DATE Format 변환
  public static dateFormat(date: Date, pattern: string) {
    return moment(date).format(pattern);
  }

  // 저장영상 요청 시 1분 단위 시간 분할 처리
  public static dateDivide(startDt: number, endDt: number, originStartDate?: number) {
    let startDate = startDt;
    const endDate = endDt;
    let ogDate;
    originStartDate !== undefined ? (ogDate = originStartDate) : (ogDate = startDate);

    let first = true;
    const dates = [];

    while (startDate < endDate) {
      const tmpObj: object = {};
      if (first) {
        first = false;
        const diffSec = 59 - this.utcToDate(startDt).getSeconds();
        tmpObj['startDt'] = Number(ogDate);
        tmpObj['endDt'] = this.dateToUtc(this.dateAddSeconds(this.utcToDate(startDt), diffSec));
        dates.push(tmpObj);
        startDate = tmpObj['endDt'];
      } else {
        tmpObj['startDt'] = this.dateToUtc(this.dateAddSeconds(this.utcToDate(startDate), 1));
        tmpObj['endDt'] =
          this.dateToUtc(this.dateAddSeconds(this.utcToDate(startDate), 59)) > endDate
            ? this.dateToUtc(this.dateAddSeconds(this.utcToDate(startDate), this.utcToDate(endDate).getSeconds()))
            : this.dateToUtc(this.dateAddSeconds(this.utcToDate(startDate), 60));
        dates.push(tmpObj);
        startDate = tmpObj['endDt'];
      }
    }
    return dates;
  }
}
