import { getTagged } from '../../deps/bp_logger';
import { PayloadType } from '../defs';

const Log = getTagged('parser:sdp');
export interface RtpMap {
  name?: string;
  clock?: string;
  encparams?: string;
}

export interface MediaInformation {
  rtpmap?: Map<number, RtpMap>;
  type?: string;
  port?: string;
  fmt?: number[];
  ptype?: string;
  proto?: string;
  mode?: string;
  range?: any[];
  control?: string;
  fmtp?: Map<string, string>;
}

export class SDPParser {
  public version: number = -1;
  public origin: { [id: string]: string } = null;
  public sessionName: string = null;

  public mediaMap: Map<number, MediaInformation> = new Map<number, MediaInformation>();
  public sessionBlock: MediaInformation = {};
  public media: { [id: string]: MediaInformation } = {};
  public tracks: { [id: string]: string } = {};
  public timing: { [id: string]: string } = null;

  public parse(content: string): Promise<boolean> {
    // Log.debug(content);
    return new Promise((resolve, reject) => {
      const dataString = content;
      let success = true;
      let currentMediaBlock = this.sessionBlock;

      // TODO: multiple audio/video tracks

      for (let line of dataString.split('\n')) {
        line = line.replace(/\r/, '');
        if (0 === line.length) {
          /* Empty row (last row perhaps?), skip to next */
          continue;
        }

        switch (line.charAt(0)) {
          case 'v':
            if (-1 !== this.version) {
              Log.info('Version present multiple times in SDP');
              reject();
              return false;
            }
            success = success && this._parseVersion(line);
            break;

          case 'o':
            if (null !== this.origin) {
              Log.info('Origin present multiple times in SDP');
              reject();
              return false;
            }
            success = success && this._parseOrigin(line);
            break;

          case 's':
            if (null !== this.sessionName) {
              Log.info('Session Name present multiple times in SDP');
              reject();
              return false;
            }
            success = success && this._parseSessionName(line);
            break;

          case 't':
            if (null !== this.timing) {
              Log.info('Timing present multiple times in SDP');
              reject();
              return false;
            }
            success = success && this._parseTiming(line);
            break;

          case 'm':
            if (null !== currentMediaBlock && this.sessionBlock !== currentMediaBlock) {
              /* Complete previous block and store it */
              this.media[currentMediaBlock.type] = currentMediaBlock;
            }

            /* A wild media block appears */
            currentMediaBlock = {};
            currentMediaBlock.rtpmap = new Map<number, RtpMap>();
            this._parseMediaDescription(line, currentMediaBlock);
            break;

          case 'a':
            SDPParser._parseAttribute(line, currentMediaBlock);
            break;

          default:
            Log.info('Ignored unknown SDP directive: ' + line);
            break;
        }

        if (!success) {
          reject();
          return false;
        }
      }

      this.media[currentMediaBlock.type] = currentMediaBlock;

      success ? resolve(success) : reject();
      return success;
    });
  }

  public _parseVersion(line: string) {
    const matches = line.match(/^v=([0-9]+)$/);
    if (!matches || !matches.length) {
      // tslint:disable-next-line: quotemark
      Log.info("'v=' (Version) formatted incorrectly: " + line);
      return false;
    }

    this.version = Number(matches[1]);
    if (0 !== this.version) {
      Log.info('Unsupported SDP version:' + this.version);
      return false;
    }

    return true;
  }

  public _parseOrigin(line: string) {
    const matches = line.match(/^o=([^ ]+) (-?[0-9]+) (-?[0-9]+) (IN) (IP4|IP6) ([^ ]+)$/);
    if (!matches || !matches.length) {
      // tslint:disable-next-line: quotemark
      Log.info("'o=' (Origin) formatted incorrectly: " + line);
      return false;
    }

    this.origin = {};
    this.origin.username = matches[1];
    this.origin.sessionid = matches[2];
    this.origin.sessionversion = matches[3];
    this.origin.nettype = matches[4];
    this.origin.addresstype = matches[5];
    this.origin.unicastaddress = matches[6];

    return true;
  }

  public _parseSessionName(line: string) {
    const matches = line.match(/^s=([^\r\n]+)$/);
    if (!matches || !matches.length) {
      // tslint:disable-next-line: quotemark
      Log.info("'s=' (Session Name) formatted incorrectly: " + line);
      return false;
    }

    this.sessionName = matches[1];

    return true;
  }

  public _parseTiming(line: string) {
    const matches = line.match(/^t=([0-9]+) ([0-9]+)$/);
    if (!matches || !matches.length) {
      // tslint:disable-next-line: quotemark
      Log.info("'t=' (Timing) formatted incorrectly: " + line);
      return false;
    }

    this.timing = {};
    this.timing.start = matches[1];
    this.timing.stop = matches[2];

    return true;
  }

  public _parseMediaDescription(line: string, media: MediaInformation) {
    const matches = line.match(/^m=([^ ]+) ([^ ]+) ([^ ]+)[ ]/);
    if (!matches || !matches.length) {
      // tslint:disable-next-line: quotemark
      Log.info("'m=' (Media) formatted incorrectly: " + line);
      return false;
    }

    media.type = matches[1];
    media.port = matches[2];
    media.proto = matches[3];
    media.fmt = line
      .substr(matches[0].length)
      .split(' ')
      .map((fmt, index, array) => {
        return parseInt(fmt, 10);
      });

    for (const fmt of media.fmt) {
      this.mediaMap[fmt] = media;
    }

    return true;
  }

  public static _parseAttribute(line: string, media: MediaInformation): boolean {
    if (null === media) {
      /* Not in a media block, can't be bothered parsing attributes for session */
      return true;
    }

    let matches: RegExpMatchArray;
    /* Used for some cases of below switch-case */
    const separator = line.indexOf(':');
    const attribute = line.substr(0, -1 === separator ? 0x7fffffff : separator);
    /* 0x7FF.. is default */

    switch (attribute) {
      case 'a=recvonly':
      case 'a=sendrecv':
      case 'a=sendonly':
      case 'a=inactive':
        media.mode = line.substr('a='.length);
        break;
      case 'a=range':
        matches = line.match(/^a=range:\s*([a-zA-Z-]+)=([0-9.]+|now)\s*-\s*([0-9.]*)$/);
        media.range = [Number(matches[2] === 'now' ? -1 : matches[2]), Number(matches[3]), matches[1]];
        break;
      case 'a=control':
        media.control = line.substr('a=control:'.length);
        break;

      case 'a=rtpmap':
        matches = line.match(/^a=rtpmap:(\d+) (.*)$/);
        if (null === matches) {
          // tslint:disable-next-line: quotemark
          Log.info("Could not parse 'rtpmap' of 'a='");
          return false;
        }

        const payload = parseInt(matches[1], 10);
        media.rtpmap[payload] = {};

        const attrs = matches[2].split('/');
        media.rtpmap[payload].name = attrs[0].toUpperCase();
        media.rtpmap[payload].clock = attrs[1];
        if (undefined !== attrs[2]) {
          media.rtpmap[payload].encparams = attrs[2];
        }
        media.ptype = PayloadType.string_map[attrs[0].toUpperCase()];

        break;

      case 'a=fmtp':
        matches = line.match(/^a=fmtp:(\d+) (.*)$/);
        if (0 === matches.length) {
          // tslint:disable-next-line: quotemark
          Log.info("Could not parse 'fmtp'  of 'a='");
          return false;
        }

        media.fmtp = new Map<string, string>();
        for (const param of matches[2].split(';')) {
          const idx = param.indexOf('=');
          media.fmtp[
            param
              .substr(0, idx)
              .toLowerCase()
              .trim()
          ] = param.substr(idx + 1).trim();
        }
        break;
    }

    return true;
  }

  public getSessionBlock(): MediaInformation {
    return this.sessionBlock;
  }

  public hasMedia(mediaType: string): boolean {
    return this.media[mediaType] !== undefined;
  }

  public getMediaBlock(mediaType: string): MediaInformation {
    return this.media[mediaType];
  }

  public getMediaBlockByPayloadType(pt: number): MediaInformation {
    // for (var m in this.media) {
    //     if (-1 !== this.media[m].fmt.indexOf(pt)) {
    //         return this.media[m];
    //     }
    // }
    return this.mediaMap[pt] || null;

    // ErrorManager.dispatchError(826, [pt], true);
    // Log.error(`failed to find media with payload type ${pt}`);
    //
    // return null;
  }

  public getMediaBlockList(): string[] {
    const res: string[] = [];
    for (const m in this.media) {
      if (this.media.hasOwnProperty(m)) res.push(m);
    }

    return res;
  }
}
