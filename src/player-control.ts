import StreamClient from './client/stream/stream-client';
import { BaseClient } from './core/base_client';
import { getTagged, LogLevel, setDefaultLogLevel } from './deps/bp_logger';
import * as player from './player';

setDefaultLogLevel(LogLevel.Debug);

interface DmsPlayerOptions {
  url: string;
  srcType: string;
  socket: string;
  protocol?: string;
  vmsId?: number;
  devSerial?: number;
  channel?: number;
  media?: number;
  transcode?: number;
  token?: string;
  flush?: number;
}

export class PlayerControl {
  public logger(tag: string) {
    return getTagged(tag);
  }

  public player(node: HTMLVideoElement, opts: DmsPlayerOptions) {
    if (!opts.socket) {
      throw new Error('socket parameter is not set');
    }

    let clientCreator: (options?: { [key: string]: any }) => BaseClient;

    if (opts.socket.endsWith('/stream')) {
      clientCreator = StreamClient.creator;
    } else {
      throw new Error('unsupported url format');
    }

    const _options: player.WSPlayerOptions = {
      url: opts.url,
      srcType: opts.srcType,
      websocketUrl: opts.socket,
      vmsId: opts.vmsId,
      devSerial: opts.devSerial,
      channel: opts.channel,
      media: opts.media,
      transcode: opts.transcode,
      flush: opts.flush,
      token: opts.token,
      clientCreator,
      errorHandler(e: Error) {
        console.log('Failed to start player: ' + e.message + '\n stack : ' + e.stack);
      },
    };

    return new player.WSPlayer(node, _options);
  }
}
