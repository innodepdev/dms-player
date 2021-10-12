export class Url {
  public full: string;
  public protocol: string;
  public urlpath: string;
  public basename: string;
  public basepath: string;
  public user: string;
  public pass: string;
  public host: string;
  public port: number | string;
  public auth: string;
  public portDefined: boolean;
  public socket: string;
  public location: string;

  public toString() {
    return Url.full(this);
  }

  public static parse(url: string) {
    const ret = new Url();

    const regex = /^([^:]+):\/\/([^\/]*)(.*)$/; // protocol, login, urlpath
    const result = regex.exec(url);

    if (!result) {
      throw new Error('bad url');
    }

    ret.full = url;
    ret.protocol = result[1];
    ret.urlpath = result[3];

    const parts = ret.urlpath.split('/');
    ret.basename = parts.pop().split(/\?|#/)[0];
    ret.basepath = parts.join('/');

    const path = result[2];
    const idx = path.lastIndexOf('@');

    let hostport = path.split(':');
    let userpass = [null, null];

    if (idx > 2 && path.length > idx) {
      userpass = path.substr(0, idx).split(':');
      hostport = path.substr(idx + 1).split(':');
    }

    ret.user = userpass[0];
    ret.pass = userpass[1];
    ret.host = hostport[0];
    ret.auth = ret.user && ret.pass ? `${ret.user}:${ret.pass}` : '';

    ret.port = null == hostport[1] ? Url.protocolDefaultPort(ret.protocol) : hostport[1];
    ret.portDefined = null != hostport[1];
    ret.location = `${ret.host}:${ret.port}`;

    if (ret.protocol === 'unix' && ret.port != null) {
      ret.socket = ret.port.toString();
      ret.port = undefined;
    }

    return ret;
  }

  public static full(parsed: Url) {
    return `${parsed.protocol}://${parsed.location}${parsed.urlpath}`;
  }

  public static makeFullPathWithAuthenticate(parsed: Url) {
    return `${parsed.protocol}://${parsed.user}:${parsed.pass}@${parsed.location}${parsed.urlpath}`;
  }

  public static isAbsolute(url: string) {
    return /^[^:]+:\/\//.test(url);
  }

  public static protocolDefaultPort(protocol: string) {
    switch (protocol) {
      case 'rtsp':
        return 554;
      case 'http':
        return 80;
      case 'https':
        return 443;
    }

    return 0;
  }
}
