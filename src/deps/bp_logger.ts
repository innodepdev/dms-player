// ERROR=0, WARN=1, LOG=2, DEBUG=3
export const LogLevel = {
  Error: 0,
  Warn: 1,
  Info: 2,
  Debug: 3,
};

let DEFAULT_LOG_LEVEL = LogLevel.Debug;

export function setDefaultLogLevel(level: number) {
  DEFAULT_LOG_LEVEL = level;
}
export class Logger {
  public tag: string;
  public level: number = 0;
  constructor(level = DEFAULT_LOG_LEVEL, tag: string = '') {
    this.tag = tag;
    this.setLevel(level);
  }

  public setLevel(level: number) {
    this.level = level;
  }

  static get level_map() {
    return {
      [LogLevel.Debug]: 'debug',
      [LogLevel.Info]: 'info',
      [LogLevel.Warn]: 'warn',
      [LogLevel.Error]: 'error',
    };
  }

  public _log(lvl: number, args: any) {
    args = Array.prototype.slice.call(args);
    if (this.tag) {
      args.unshift(`[${this.tag}]`);
    }
    console[Logger.level_map[lvl]].apply(console, args);
  }
  public log(...args: any[]) {
    this._log(LogLevel.Info, args);
  }
  public info(...args: any[]) {
    this._log(LogLevel.Info, args);
  }
  public debug(...args: any[]) {
    this._log(LogLevel.Debug, args);
  }
  public error(...args: any[]) {
    this._log(LogLevel.Error, args);
  }
  public warn(...args: any[]) {
    this._log(LogLevel.Warn, args);
  }
}

const taggedLoggers = new Map<string, Logger>();
export function getTagged(tag: string): Logger {
  if (!taggedLoggers.has(tag)) {
    taggedLoggers.set(tag, new Logger(DEFAULT_LOG_LEVEL, tag));
  }
  return taggedLoggers.get(tag);
}
export const Log = new Logger();
