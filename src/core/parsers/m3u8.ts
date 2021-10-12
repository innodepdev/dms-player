// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js
class AttrList {
  public attrs: string | { [key: string]: any };

  constructor(attrs: string | { [key: string]: any }) {
    if (typeof attrs === 'string') {
      attrs = AttrList.parseAttrList(attrs);
    }
    for (const attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        this[attr] = attrs[attr];
      }
    }
    this.attrs = attrs;
  }

  public decimalInteger(attrName: string) {
    const intValue = parseInt(this[attrName], 10);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      return Infinity;
    }
    return intValue;
  }

  public hexadecimalInteger(attrName: string) {
    if (this[attrName]) {
      let stringValue = (this[attrName] || '0x').slice(2);
      stringValue = (stringValue.length & 1 ? '0' : '') + stringValue;

      const value = new Uint8Array(stringValue.length / 2);
      for (let i = 0; i < stringValue.length / 2; i++) {
        value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
      }
      return value;
    } else {
      return null;
    }
  }

  public hexadecimalIntegerAsNumber(attrName: string) {
    const intValue = parseInt(this[attrName], 16);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      return Infinity;
    }
    return intValue;
  }

  public decimalFloatingPoint(attrName: string) {
    return parseFloat(this[attrName]);
  }

  public enumeratedString(attrName: string) {
    return this[attrName];
  }

  public decimalResolution(attrName: string) {
    const res = /^(\d+)x(\d+)$/.exec(this[attrName]);
    if (res === null) {
      return undefined;
    }
    return {
      width: parseInt(res[1], 10),
      height: parseInt(res[2], 10),
    };
  }

  public static parseAttrList(input: string) {
    const re = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g;
    let match: RegExpExecArray;
    const attrs: { [key: string]: any } = {};
    match = re.exec(input);
    while (match !== null) {
      let value = match[2];
      const quote = '"';

      if (value.indexOf(quote) === 0 && value.lastIndexOf(quote) === value.length - 1) {
        value = value.slice(1, -1);
      }
      attrs[match[1]] = value;

      match = re.exec(input);
    }
    return attrs;
  }
}

export class M3U8Parser {
  static get TYPE_CHUNK() {
    return 0;
  }
  static get TYPE_PLAYLIST() {
    return 1;
  }
  // TODO: parse master playlists
  public static parse(playlist, baseUrl = '') {
    playlist = playlist.replace(/\r/, '').split('\n');
    if (playlist.shift().indexOf('#EXTM3U') < 0) {
      throw new Error('Bad playlist');
    }
    const chunkList = [];
    const playlistList = [];
    let expectedUrl = false;
    let cont: { [key: string]: any } = {};
    let urlType = null;
    while (playlist.length) {
      const entry = playlist.shift().replace(/\r/, '');
      if (expectedUrl) {
        if (entry) {
          cont.url = entry.startsWith('http') ? entry : `${baseUrl}/${entry}`;
          switch (urlType) {
            case M3U8Parser.TYPE_CHUNK:
              chunkList.push(cont);
              break;
            case M3U8Parser.TYPE_PLAYLIST:
              playlistList.push(cont);
              break;
          }
          cont = {};
          expectedUrl = false;
        }
      } else {
        if (entry.startsWith('#EXTINF')) {
          // TODO: it's unsafe
          cont.duration = Number(entry.split(':')[1].split(',')[0]);
          urlType = M3U8Parser.TYPE_CHUNK;
          expectedUrl = true;
        } else if (entry.startsWith('#EXT-X-STREAM-INF')) {
          const props = entry.split(':')[1];
          const al = new AttrList(props);
          if (typeof al.attrs !== 'string') {
            for (const prop in al.attrs) {
              if (al.attrs.hasOwnProperty(prop)) cont[prop.toLowerCase()] = al.attrs[prop];
            }
          }
          urlType = M3U8Parser.TYPE_PLAYLIST;
          expectedUrl = true;
        }
      }
    }
    return { chunks: chunkList, playlists: playlistList };
  }
}
