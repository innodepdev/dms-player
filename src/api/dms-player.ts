import 'babel-polyfill';
import $ from 'jquery';
import { playDateTime } from '../client/stream/ws-stream-client';
import { DateUtil } from '../common/date-util';
import { ErrorCode } from '../common/error-message';
import { dtsTimeList, dtsTimeReset } from '../core/remuxer/h264-remuxer';
import { PlayerControl } from '../player-control';
import '../style/default.css';
import * as dmsPlayerVersion from '../version/version.template.json';

/* global varialbe */
const playerInfo: object = {
  streamUrl: undefined,
  vmsType: undefined
};
let ptzLockInterval: any;
export let playerOption: object = {flush: 200};
const errorMsgCallbackFuncArray: object[] = [];

/**
 * @private
 * @name initLoad
 * @function
 * @description JS 로드시 최초 실행 함수, 플레이어 필요 옵션을 서버에서 받아 둔다.
 * @return {undefined}
 */
/*function initLoad() {
  fetch('/media/api/v1/flush', {
    method: 'GET',
    body: null,
    headers: { 'Content-type': 'application/json', responseType: 'arrayBuffer', 'Access-Control-Origin': '*' }
  }).then((response: Response) => {
    return response.json();
  }).then((data: object) => {
    if (data && Object.keys(data).length > 0) {
      playerOption = data;
    }
  });
}*/

// initLoad();

/**
 * @name getVersion
 * @function
 * @description 현재 dms-gis 모듈의 버전을 확인 한다.
 * @return {undefined}
 * @example
 * console.log(dmsPlayer.getVersion());
 */
export function getVersion() {
  console.log(dmsPlayerVersion['version']);
}

/**
 * @private
 * @name errorMsgFuncCall
 * @description 웹소켓 수신 처리 구간에서 에러 메시지를 전달하기 위한 export function
 * @param {Object} err 에러 메시지 객체
 * @param {number} err.code 에러코드
 * @param {string} err.funcName 에러가 발생한 function
 * @param {string} err.msg 에러 메시지
 * @return {undefined}
 */
export function errorMsgFuncCall(err: object | boolean, options: object | string) {
  if (options) {
    const url = typeof options === 'string' ? options :  options['url'];
    const errFunc = errorMsgCallbackFuncArray.find((errFuncObj: object) => {
      return errFuncObj['url'] === url;
    });

    if (errFunc && typeof errFunc['func'] === 'function') {
      errFunc['func'](err);
    }
  }
}

/**
 * @private
 * @name errorMsgFuncRemove
 * @description close 시 errorMsgFunc 삭제 처리
 * @param {string} playerUrl 플레이어 요청 URL
 * @return {undefined}
 */
function errorMsgFuncRemove(playerUrl: string) {
  const funcIdx = errorMsgCallbackFuncArray.findIndex((errFuncObj: object) => {
    return errFuncObj['url'] === playerUrl;
  });
  if (funcIdx) {
    errorMsgCallbackFuncArray.splice(funcIdx, 1);
  }
}

/**
 * @private
 * @name drawLineWithArrowhead
 * @description Draggable PTZ 사용시 Line Head 화살표 처리
 * @param {number} startX 캔버스 중앙 X 좌표 (고정)
 * @param {number} startY 캔버스 중앙 Y 좌표 (고정)
 * @param {number} mouseX 현재 마우스 위치 X 좌표
 * @param {number} mouseY 현재 마우스 위치 Y 좌표
 * @param {CanvasRenderingContext2D} ctx canvas getContext('2d')
 * @param {string} color Line 색상
 * @return {undefined}
 */
function drawLineWithArrowhead(
  startX: number,
  startY: number,
  mouseX: number,
  mouseY: number,
  ctx: CanvasRenderingContext2D,
  color?: string
) {
  const PI2 = Math.PI * 2;
  const dx = mouseX - startX;
  const dy = mouseY - startY;
  const radians = (Math.atan2(dy, dx) + PI2) % PI2;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.translate(mouseX, mouseY);
  ctx.rotate(radians);
  ctx.moveTo(0, 0);
  ctx.lineTo(-10, 6);
  ctx.lineTo(-10, -6);
  color === undefined ? (ctx.fillStyle = '#FFFFFF') : (ctx.fillStyle = color);
  ctx.fill();
  ctx.restore();
}

/**
 * @private
 * @name drawLineText
 * @description Draggable PTZ 사용시 Line speed 정보 표출
 * @param {number} startX 캔버스 중앙 X 좌표 (고정)
 * @param {number} startY 캔버스 중앙 Y 좌표 (고정)
 * @param {number} mouseX 현재 마우스 위치 X 좌표
 * @param {number} mouseY 현재 마우스 위치 Y 좌표
 * @param {CanvasRenderingContext2D} ctx canvas getContext('2d')
 * @param {string} label text 값
 * @param {string} color text 색상
 * @return {undefined}
 */
function drawLineText(
  startX: number,
  startY: number,
  mouseX: number,
  mouseY: number,
  ctx: CanvasRenderingContext2D,
  label: string,
  color?: string
) {
  const alignment = 'center';
  const padding = 10;

  let p1 = { x: startX, y: startY }; // start
  let p2 = { x: mouseX, y: mouseY }; // mouse

  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const avail = len - 2 * padding;

  if (ctx.measureText && ctx.measureText(label).width > avail) {
    while (label && ctx.measureText(label + '…').width > avail) label = label.slice(0, -1);
    label += '…';
  }

  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2 || angle > Math.PI / 2) {
    const p = p1;
    p1 = p2;
    p2 = p;
    dx *= -1;
    dy *= -1;
    angle -= Math.PI;
  }

  let p, pad;
  if (alignment === 'center') {
    p = p1;
    pad = 1 / 2;
  } else {
    const left = alignment === 'left';
    p = left ? p1 : p2;
    pad = (padding / len) * (left ? 1 : -1);
  }

  ctx.save();
  ctx.textBaseline = 'bottom';
  ctx.textAlign = alignment;
  ctx.font = '1em Arial';
  ctx.translate(p.x + dx * pad, p.y + dy * pad);
  ctx.rotate(angle);
  color === undefined ? (ctx.fillStyle = '#FFFFFF') : (ctx.fillStyle = color);
  ctx.fillText('Speed : ' + label, 0, 0);
  ctx.restore();
}

/**
 * @private
 * @name getPtzMessage
 * @description PTZ Lock 처리 수신 메시지 (success, failed)
 * @param {number} player PTZ Lock 대상 플레이어 객체
 * @param {number} type Lock ,UnLock 구분
 * @return {Object}
 */
function getPtzMessage(player: HTMLVideoElement, type: string) {
  let result;
  return new Promise((resolve, reject) => {
    result = $(player).triggerHandler('ptzModeOn', {
      detail: {
        ptzLock: type,
      },
    });
    resolve(result);
  });
}

/**
 * @private
 * @name getTimeLineMessage
 * @description 타임라인 처리 수신 메시지
 * @param {HTMLVideoElement} player 타임라인 정보를 가져올 대상 플레이어 객체
 * @param {Date} startDate 타임라인 요청 시작시간 (YYYYMMDDHHmmss)
 * @param {Date} endDate 타임라인 요청 종료시간 (YYYYMMDDHHmmss)
 * @return {Object}
 */
function getTimeLineMessage(player: HTMLVideoElement, startDate, endDate) {
  let result;
  return new Promise((resolve, reject) => {
    result = $(player).triggerHandler('getTimeline', {
      detail: {
        startDate,
        endDate,
      },
    });
    resolve(result);
  });
}

/**
 * @private
 * @name getPresetListMessage
 * @description preset List 처리 수신 메시지 (success, failed)
 * @param {HTMLVideoElement} player 타임라인 정보를 가져올 대상 플레이어 객체
 * @return {Object}
 */
function getPresetListMessage(player: HTMLVideoElement) {
  let result;
  return new Promise((resolve) => {
    result = $(player).triggerHandler('getPresetList', {
      detail: {
        ptzCmd: 1052,
      },
    });
    resolve(result);
  });
}

/**
 * @private
 * @name getPtzSpeed
 * @description 현재 Drag 중인 Line 길이에 따른 스피드 값
 * @param {number} dist Draggble 중인 Line 길이
 * @param {Array} speedArr 가로, 세로 길이 중 더 긴 값에 width 분할 값
 * @return {number}
 */
function getPtzSpeed(dist: number, speedArr: number[]) {
  let rtnSpeed = 0;
  for (let i = 0; i < speedArr.length; i++) {
    if (dist < speedArr[i]) {
      rtnSpeed = i + 1;
      break;
    }
  }
  return rtnSpeed;
}

/**
 * @name createVideo
 * @function
 * @description DMS Player 객체 생성
 * @param {Object} options
 * @param {string} options.id 플레이어 객체의 ID (element ID)
 * @param {string} options.url  영상 요청 URL, ex) vurix::///100869/1/0/0
 * @param {string} options.srcType 원본 영상소스 타입 (rtsp, vurix, etc)
 * @param {string} options.stream Media Server URL
 * @param {number} options.transcode 인코딩 요청 값, -1: 인코딩 적용 X, 0: 원본, 최소 32: 인코딩 요청 값
 * @param {function} options.errorMsgFunc 영상 내부에서 발생하는 에러 메시지 수신처리를 하기 위한 callback 함수
 * @param {HTMLVideoElement} videoEl video 태그 엘리먼트, 플레이어가 이미 존재하는지의 대한 여부
 * @return {HTMLVideoElement}
 * @example // DMS Video Player 생성 옵션
 * const videoOptions = {
 *  id: 'test_video',
 *  url: 'vurix:///100869/1/0/0',
 *  srcType: this.playerInfo.vms_type,
 *  stream: `ws://172.16.36.109:8080/media/api/v1/stream`,
 *  transcode: 720,
 *  errorMsgFunc: this.errorMsgCallback
 * };
 *
 * // DMS Video Player 생성 API 호출
 * this.player = dmsPlayer.createVideo(this.videoOptions);
 *
 * // DMS Video Player 가 들어갈 부모 DIV 영역 안으로 APPEND
 * this.videoParent = document.getElementById('video_parent');
 * this.videoParent.append(this.player);
 *
 * // 에러 콜백 함수
 * errorMsgCallback(err) {
 *   // error 메세지 처리
 *   // {
 *   //   code: 10001, (10000 단위의 에러코드)
 *   //   funcName: 'createVideo', (에러 발생 위치의 API 명)
 *   //   msg: 'createVideo Failed' (에러 메세지)
 *   // }
 * }
 *
 */
export function createVideo(options: any, videoEl?: HTMLVideoElement) {
  try {
    let video;
    // vmsIntegratedId 항목 추가 해당 항목은  vmsId_devSerial_channel_media 형태로 언더바로 모든 키가 합쳐져서 들어옴
    if (
      !options.url.startsWith('vurix://') &&
      !options.url.startsWith('realhub://') &&
      !options.url.startsWith('rtsp://')
    ) {
      if (options['vmsIntegratedId']) {
        options.srcType = 'vurix';
        let arr: string[] = String(options['vmsIntegratedId']).split('/');
        if (arr.length === 2) {
          options.url = `realhub:///${arr[0]}/${arr[1]}`;
          options.srcType = 'realhub';
        } else {
          arr = String(options['vmsIntegratedId']).split('_');
          if (arr.length === 4) {
            if (!isNaN(Number(arr[0])) && !isNaN(Number(arr[1])) && !isNaN(Number(arr[2])) && !isNaN(Number(arr[3]))) {
              options.url = options.token != null && options.token.length > 5
                ? `vurix://${options.token}@/${arr[0]}/${arr[1]}/${arr[2]}/${arr[3]}`
                : `vurix:///${arr[0]}/${arr[1]}/${arr[2]}/${arr[3]}`;
            }
          }
        }
      } else {
        options.url = options.token != null && options.token.length > 5
          ? `vurix://${options.token}@/${options.vmsId}/${options.devSerial}/${options.channel}/${options.media}`
          : `vurix:///${options.vmsId}/${options.devSerial}/${options.channel}/${options.media}`;
      }
    }

    if (videoEl) {
      if (videoEl.getAttribute('src')) {
        videoEl.removeAttribute('src');
      }
      video = videoEl;
    } else {
      // 비디오 생성
      video = document.createElement('video');
      video.setAttribute('crossOrigin', 'anonymous');
      video.id = options.id;
      video.setAttribute('srcType', options['srcType']);
      video.setAttribute('controlsList', 'nodownload');
      video.setAttribute('width', '100%');
      video.setAttribute('height', '100%');
      video.style.objectFit = 'fill';
      video.muted = true;
    }

    // 비디오 attribute 추가
    const exceptionAttr = ['muted', 'autoplay', 'controls'];
    for (const key in options.videoAttr) {
      if (options.videoAttr.hasOwnProperty(key)) {
        if (exceptionAttr.indexOf(key) === -1) {
          if (options.videoAttr[key] === true) {
            video[key] = true;
          } else {
            video.setAttribute(key, options.videoAttr[key]);
          }
        }
      }
    }

    // error 및 기타 메시지를 수신 받을 function
    if (options.errorMsgFunc) {
      errorMsgCallbackFuncArray.push({
        'url': options.url,
        'func': options.errorMsgFunc
      });
    }

    // stream url 저장
    playerInfo['streamUrl'] = options.stream;
    playerInfo['vmsType'] = options.srcType;

    new PlayerControl().player(video as HTMLVideoElement, {
      url: options.url,
      srcType: options.srcType,
      socket: options.stream,
      protocol: '',
      vmsId: options.vmsId,
      devSerial: options.devSerial,
      channel: options.channel,
      media: options.media,
      transcode: options.transcode,
      token: options.token,
      flush: playerOption['flush']
    });

    // video tag 우클릭 방지
    video.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    }, false);

    if (!videoEl) {
      return video;
    }

  } catch (e) {
    const err: object = {
      code: ErrorCode.createVideo,
      funcName: 'createVideo',
      msg: 'createVideo Failed : ' + e,
    };
    if (errorMsgCallbackFuncArray.length > 0) {
      errorMsgFuncCall(err, options);
    } else {
      console.log('DMS-Player Error: Error Message Function None');
    }
  }
}

/**
 * @name createCenterPoint
 * @function
 * @description centerPoint Canvas 생성
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} [color=#FFFFFF] point 색상
 * @return {HTMLElement}
 * @example const centerPoint = dmsPlayer.centerPoint(this.player, '#BDFF12');
 * // DMS-Player (Video)가 위치한 동일한 부모 DIV 객체로 Append
 * this.videoParent = document.getElementById('video_parent');
 * this.videoParent.appendChild(centerPoint);
 */
export function createCenterPoint(player: HTMLVideoElement, color?: string) {
  try {
    const point = document.createElement('div');
    point.className = 'center-point';
    const crossBox = document.createElement('div');
    crossBox.className = 'cross-box';
    const crossV = document.createElement('div');
    crossV.className = 'cross-vertical';
    color === undefined ? (crossV.style.backgroundColor = '#FFFFFF') : (crossV.style.backgroundColor = color);
    const crossH = document.createElement('div');
    crossH.className = 'cross-horizontal';
    color === undefined ? (crossH.style.backgroundColor = '#FFFFFF') : (crossH.style.backgroundColor = color);

    crossBox.appendChild(crossV);
    crossBox.appendChild(crossH);
    point.appendChild(crossBox);

    return point;
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Create CenterPoint %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name createAreaZoom
 * @function
 * @description AreaZomm Canvas 생성
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} [color=#FFFFFF] stroke 색상
 * @return {HTMLElement}
 * @example const areaZoom = dmsPlayer.createAreaZoom(this.player, '#BDFF12');
 * // DMS-Player (Video)가 위치한 동일한 부모 DIV 객체로 Append
 * this.videoParent = document.getElementById('video_parent');
 * this.videoParent.appendChild(areaZoom);
 */
export function createAreaZoom(player: HTMLVideoElement, color?: string) {
  try {
    const canvas = document.createElement('canvas');
    const id = player.id.split('/')[0];
    canvas.id = id + '-canvas';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '999';

    const ctx = canvas.getContext('2d');
    const rect = {};
    let drag = false;

    // area x,y info
    let startX;
    let startY;

    canvas.addEventListener('mousedown', (e) => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      rect['startX'] = e.pageX - $('#' + canvas.id).offset().left;
      rect['startY'] = e.pageY - $('#' + canvas.id).offset().top;
      rect['w'] = 0;
      rect['y'] = 0;
      drag = true;

      const cw = e.target['clientWidth'];
      const ch = e.target['clientHeight'];
      startX = (e.offsetX / 100 / cw) * 100;
      startY = (e.offsetY / 100 / ch) * 100;
    });

    canvas.addEventListener('mouseup', (e) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drag = false;

      const cw = e.target['clientWidth'];
      const ch = e.target['clientHeight'];
      const endX = (e.offsetX / 100 / cw) * 100;
      const endY = (e.offsetY / 100 / ch) * 100;

      const rtnInfo = {
        startX,
        startY,
        endX,
        endY,
      };
      this.ptzAreaZoom(player, rtnInfo);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (drag) {
        rect['w'] = e.pageX - $('#' + canvas.id).offset().left - rect['startX'];
        rect['y'] = e.pageY - $('#' + canvas.id).offset().top - rect['startY'];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        color === undefined ? (ctx.strokeStyle = '#FFFFFF') : (ctx.strokeStyle = color);
        ctx.lineWidth = 3;
        ctx.strokeRect(rect['startX'], rect['startY'], rect['w'], rect['y']);
      }
    });

    return canvas;
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Create AreaZoom %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name createPointMove
 * @function
 * @description PointMove 처리 (클릭 지점 중앙)
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {HTMLElement}
 * @example const pointMove = dmsPlayer.createPointMove(this.player, '#BDFF12');
 * // DMS-Player (Video)가 위치한 동일한 부모 DIV 객체로 Append
 * this.videoParent = document.getElementById('video_parent');
 * this.videoParent.appendChild(pointMove);
 */
export function createPointMove(player: HTMLVideoElement) {
  try {
    const canvas = document.createElement('canvas');
    const id = player.id.split('/')[0];
    canvas.id = id + '-canvas-point';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '999';

    const rect = {};
    canvas.addEventListener('click', (e) => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      const canvasOffset = canvas.getBoundingClientRect();
      rect['startX'] = e.pageX - canvasOffset.left;
      rect['startY'] = e.pageY - canvasOffset.top;
      rect['w'] = 0;
      rect['y'] = 0;

      const cw = canvas.width;
      const ch = canvas.height;
      const startX = (e.offsetX / 100 / cw) * 100;
      const startY = (e.offsetY / 100 / ch) * 100;

      const rtnInfo = {
        startX,
        startY,
        endX: startX,
        endY: startY,
      };
      this.ptzAreaZoom(player, rtnInfo, true);
    });

    return canvas;
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Create PointMove %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name createDraggablePTZ
 * @function
 * @description Draggable PTZ 제어 처리
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} [color=#FFFFFF] point 색상
 * @return {HTMLElement}
 * @example const dragPtz = dmsPlayer.createDraggablePTZ(this.player, '#BDFF12');
 * // DMS-Player (Video)가 위치한 동일한 부모 DIV 객체로 Append
 * this.videoParent = document.getElementById('video_parent');
 * this.videoParent.appendChild(dragPtz);
 */
export function createDraggablePTZ(player: HTMLVideoElement, color?: string) {
  try {
    const canvas = document.createElement('canvas');
    const id = player.id.split('/')[0];
    canvas.id = id + '-canvas-draggable';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '999';

    let ptzFlag = 0;
    let speedFlag = 0;

    const ctx = canvas.getContext('2d');
    let startX, startY, offsetX, offsetY;
    let isDown = false;

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDown = true;

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      const canvasOffset = canvas.getBoundingClientRect();
      offsetX = canvasOffset.left;
      offsetY = canvasOffset.top;
      startX = canvas.offsetLeft + canvas.offsetWidth / 2;
      startY = canvas.offsetTop + canvas.offsetHeight / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      $('.center-point').focus();
    });

    canvas.addEventListener('mousemove', (e) => {
      e.preventDefault();
      if (!isDown) {
        return;
      }

      // current mouse location
      const mouseX = e.clientX - offsetX;
      const mouseY = e.clientY - offsetY;

      // drow line
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(mouseX, mouseY);
      color === undefined ? (ctx.strokeStyle = '#FFFFFF') : (ctx.strokeStyle = color);
      ctx.stroke();
      drawLineWithArrowhead(startX, startY, mouseX, mouseY, ctx);

      // ptz 제어 처리
      const mx = mouseX - startX;
      const my = mouseY - startY;
      const dist = ((Math.sqrt(mx * mx + my * my) * 100) >> 0) / 100;

      const dx = mouseX - (canvas.offsetLeft + canvas.offsetWidth / 2);
      const dy = mouseY - (canvas.offsetTop + canvas.offsetHeight / 2);
      const angle = Math.atan2(dy, dx);

      let direction = ((angle - Math.PI / 4) / ((Math.PI * 2) / 8)) % 8;
      direction = Number(direction.toFixed(0));

      const maxSize = Math.max(canvas.width / 2, canvas.height / 2) / 10;
      const speedArr = [];

      for (let i = 0; i <= 9; i++) {
        if (speedArr.length === 0) {
          speedArr.push(maxSize);
        } else {
          speedArr[i] = speedArr[i - 1] + maxSize;
        }
      }

      let speed = 0;
      // TODO: case 에서 -0 인식이 되지 않는 문제..
      if (direction === -0) {
        direction = 1009;
      }
      switch (direction) {
        case -4:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzUpLeft(player, speed);
          }
          break;
        case -3:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzUp(player, speed);
          }
          break;
        case -2:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzUpRight(player, speed);
          }
          break;
        case -1:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzRight(player, speed);
          }
          break;
        case 3:
        case -5:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzLeft(player, speed);
          }
          break;
        case 2:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzDownLeft(player, speed);
          }
          break;
        case 1:
        case 0:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzDown(player, speed);
          }
          break;
        case 1009:
          speed = getPtzSpeed(dist, speedArr);
          if (speedFlag !== speed || ptzFlag !== direction) {
            ptzFlag = direction;
            speedFlag = speed;
            ptzDownRight(player, speed);
          }
          break;
        default:
          speed = 0;
          speedFlag = 0;
          ptzStop(player);
          break;
      }
      drawLineText(startX, startY, mouseX, mouseY, ctx, String(speedFlag));
    });

    canvas.addEventListener('mouseup', (e) => {
      e.preventDefault();
      isDown = false;
      speedFlag = 0;
      ptzStop(player);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    canvas.addEventListener('mouseout', (e) => {
      e.preventDefault();
      if (!isDown) {
        return false;
      }
      isDown = false;
      speedFlag = 0;
      ptzStop(player);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return canvas;
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Create DraggablePTZ %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name streamPlay
 * @function
 * @description 실시간 영상 재생 요청
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {undefined}
 * @example dmsPlayer.streamPlay(this.player);
 */
export function streamPlay(player: HTMLVideoElement) {
  try {
    // time reset
    dtsTimeReset();
    const evt = new CustomEvent('streamPlay');
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Stream Play Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name streamStop
 * @function
 * @description 영상 정지 요청
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {undefined}
 * @example dmsPlayer.videoStop(this.player);
 */
export function streamStop(player: HTMLVideoElement) {
  try {
    // time reset
    dtsTimeReset();
    const evt = new CustomEvent('streamStop');
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Stream Stop Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name playbackPlay
 * @function
 * @description 저장 영상 재생 요청
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} startDate 저장영상 요청 시작시간 (utc, MilleSecond 제외 10자리)
 * @param {number} endDate 저장영상 요청 종료시간 (utc, MilleSecond 제외 10자리)
 * @param {number} speed 요청 배속
 * @return {undefined}
 * @example dmsPlayer.playbackPlay(this.player);
 */
export async function playbackPlay(player: HTMLVideoElement, startDate?: number, endDate?: number, speed?: number) {
  try {
    // time reset
    dtsTimeReset();
    const sourceType = player.getAttribute('srcType');
    // video type 분기 처리
    if (sourceType === 'realhub' || sourceType === 'vurix') {
      // realuub 인 경우 실시간 요청과 같은 형태
      const evt = new CustomEvent('streamPlay', {
        detail: {
          startDate,
          speed: speed ? speed : 10,
        },
      });
      player.dispatchEvent(evt);
    } else {
      if (!startDate && !endDate) {
        console.log('Record Play : Not Dates Record Video Request');
        player.play().catch(() => void 0);
        return false;
      }

      let reqStartDate, reqEndDate;
      reqStartDate = typeof startDate === 'number' ? String(startDate) : startDate;
      reqEndDate = typeof endDate === 'number' ? String(endDate) : endDate;

      // TimeLine 정보 가공 영역
      const timeLine = await getTimeLineMessage(player, reqStartDate, reqEndDate);

      if (timeLine['result'] === 0) {
        let loopFlag = false;
        let tempArr;
        const dates = [];
        const resArr = timeLine['param'].results;

        for (const res of resArr) {
          if (!loopFlag) {
            loopFlag = true;
            tempArr = DateUtil.dateDivide(res.start, res.end, startDate);
          } else {
            tempArr = DateUtil.dateDivide(res.start, res.end);
          }
          for (const date of tempArr) {
            dates.push(date);
          }
        }

        const evt = new CustomEvent('playbackPlay', {
          detail: {
            dates,
            endDt: endDate,
            speed: speed ? speed : 10,
          },
        });
        player.dispatchEvent(evt);
      }
    }
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Playback Video Request Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name playbackPause
 * @function
 * @description 저장 영상 일시정지 요청
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {undefined}
 * @example dmsPlayer.playbackPause(this.player);
 */
export function playbackPause(player: HTMLVideoElement) {
  try {
    const evt = new CustomEvent('pause', {
      detail: {
        flag: true,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Playback Video Paused Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name playerClose
 * @function
 * @description 영상 정지 및 삭제 요청
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} playerUrl 플레이어 요청 URL
 * @return {undefined}
 * @example
 * // 영상 정지 및 소켓 삭제 처리
 * dmsPlayer.playerClose(this.player);
 * // video html 엘리먼트 삭제, video 가 append 되어 있는 부모요소 에서 직접 삭제
 * if (this.videoParent.hasChildNodes()) {
 *  while (this.videoParent.hasChildNodes()) {
 *    this.videoParent.removeChild(this.videoParent.firstChild);
 *  }
 * }
 */
export function playerClose(player: HTMLVideoElement, playerUrl: string) {
  try {
    const vmsType = player.getAttribute('srcType');
    const cctvId = player.getAttribute('id').split('_')[1];
    const playerUrl = `${vmsType}:///${cctvId}`;
    if (playDateTime[playerUrl]) {
      delete playDateTime[playerUrl];
    }

    errorMsgFuncRemove(playerUrl);

    if (ptzLockInterval) {
      clearInterval(ptzLockInterval);
    }
    const evt = new CustomEvent('playerClose');
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Playback Video Close Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name getTimeLine
 * @function
 * @description 요청한 영상의 TIMELINE
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} startDate 영상 요청 시작 시간 (YYYYMMDDHHmmss)
 * @param {string} endDate 영상 요청 종료 시간 (YYYYMMDDHHmmss)
 * @return {Array}
 * @example // 비동기 함수, then() 메서드 처리 필요
 * dmsPlayer.getTimeLine(this.player, this.strStartDate, this.strEndDate).then(dates => {
 *  // dates
 *  // [
 *  //   {startDate: "2019-08-27 13:35:00", endDate: "2019-08-27 13:36:13"},
 *  //   {startDate: "2019-08-27 13:37:16", endDate: "2019-08-27 13:38:59"}
 *  // ]
 * });
 */
export async function getTimeLine(player: HTMLVideoElement, startDate: number, endDate: number) {
  try {
    // TimeLine 정보 가공 영역
    const timeLine = await getTimeLineMessage(player, startDate, endDate);
    if (timeLine['result'] === 0) {
      const dates = [];
      const resArr = timeLine['param'].results;

      for (const res of resArr) {
        const tmpObj = {};
        tmpObj['startDate'] =
          startDate > res.start
            ? DateUtil.utcToString(startDate, 'YYYY-MM-DD HH:mm:ss')
            : DateUtil.utcToString(res.start, 'YYYY-MM-DD HH:mm:ss');
        tmpObj['endDate'] =
          endDate > res.end
            ? DateUtil.utcToString(res.end, 'YYYY-MM-DD HH:mm:ss')
            : DateUtil.utcToString(endDate, 'YYYY-MM-DD HH:mm:ss');
        dates.push(tmpObj);
      }
      return dates;
    }
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => getTimeLine Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name getCurrentPlayDate
 * @function
 * @description 현재 영상의 재생중인 위치의 DateTime (PTS + currentTime)
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} [pattern=YYYYMMDDHHmmss] Date Format
 * @return {Date}
 * @example const dates = dmsPlayer.getCurrentPlayDate(this.player, 'YYYY-MM-DD HH:mm:ss');
 *
 * // return Example
 * // currentDate: 현재 플레이중인 영상 날짜
 * // diffSeconds: 미녹화 구간이 있을 경우 이전 정상 재생 구간과의 시간 차이 (타임라인 draw 시 사용, 단위 : seconds)
 * [
 *  {currentDate: "2019-08-27 13:35:23", diffSeconds: 0}
 * ]
 *
 */
export function getCurrentPlayDate(player: HTMLVideoElement, pattern?: string) {
  try {
    const vmsType = player.getAttribute('srcType');
    const cctvId = player.getAttribute('id').split('_')[1];
    const playerUrl = `${vmsType}:///${cctvId}`;

    if (playDateTime[playerUrl]) {
      return playDateTime[playerUrl];
    }

    /*if (!pattern) {
      pattern = 'YYYYMMDDHHmmss';
    }

    console.log(playDateTime);

    dtsTimeList.sort((a, b) => {
      return a.cTime < b.cTime ? -1 : a.cTime > b.cTime ? 1 : 0;
    });

    if (dtsTimeList.length > 0) {
      for (const date of dtsTimeList) {
        if (player.currentTime > date.cTime) {
          currentDate = date;
        }
      }
    }
    const addCurrentTime = DateUtil.dateAddSeconds(
      new Date(currentDate['cDate']),
      player.currentTime - currentDate['cTime']
    );

    return DateUtil.dateFormat(addCurrentTime, pattern);*/
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Current Play DateTime Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name getCurrentDiffSeconds
 * @function
 * @description 미녹화 구간이 있을 경우 이전 정상 재생 구간과의 시간 차이 (타임라인 draw 시 사용, 단위 : seconds)
 * @param {string} selectDate 타임라인에서 현재 선택한 시간
 * @return {number}
 * @example // using VIS TimeLine Example
 * this.selecteDate = new Date(moment(this.props.time).format('YYYY-MM-DD HH:mm:ss')); // 클릭한 위치의 타임라인의 시간
 * this.currentDiffSec = dmsVideoPlayer.getCurrentDiffSeconds(this.selecteDate);       // return (number : 단위 seconds)
 */
export function getCurrentDiffSeconds(selectDate: string) {
  const selDate = new Date(selectDate);
  let diffTime;

  if (dtsTimeList.length > 0) {
    for (const date of dtsTimeList) {
      if (selDate > new Date(date.cDate)) {
        diffTime = date.cTime;
      }
    }
  }

  return diffTime;
}

/**
 * @name bind
 * @function
 * @description DMS Player 객체 이벤트 등록
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} type 이벤트 타입 (click, mousedown, blur .....)
 * @param {function} callback 콜백 Function
 * @return {undefined}
 * @example dmsPlayer.bind(this.player, 'click' , callbackFunction);
 * ...
 * function callbackFunction(e) {
 *   // do code
 * }
 */
export function bind(player: HTMLVideoElement, type: string, callback: (e) => {}) {
  try {
    player.addEventListener(type, (e: Event) => {
      callback(e);
    });
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Event Bind Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name setFullScreen
 * @function
 * @description 대상 DMS Player 전체화면 전환
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {undefined}
 * @example dmsPlayer.setFullScreen(this.player);
 */
export function setFullScreen(player: any) {
  if (player.requestFullscreen) {
    player.requestFullscreen();
  } else if (player.mozRequestFullScreen) {
    /* Firefox */
    player.mozRequestFullScreen();
  } else if (player.webkitRequestFullscreen) {
    /* Chrome, Safari and Opera */
    player.webkitRequestFullscreen();
  } else if (player.msRequestFullscreen) {
    /* IE/Edge */
    player.msRequestFullscreen();
  }
}

/**
 * @name ptzModeOn
 * @function
 * @description PTZ Mode On
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} playerUrl 플레이어 요청 URL
 * @return {boolean}
 * @example // 비동기 함수, then() 메서드 처리 필요
 * dmsPlayer.ptzModeOn(this.player).then(ptzStatus => {
 *   if (ptzStatus) {
 *     // true, on Success
 *     // false on Failed
 *   }
 * });
 */
export async function ptzModeOn(player: HTMLVideoElement, playerUrl: string) {
  try {
    const ptzStatus = await getPtzMessage(player, 'LOCK');
    if (ptzStatus['command'] === 302) {
      const message = ptzStatus['result']; // 0: 'success', 1: 'failed'
      if (message === 0) {
        player.playbackRate = 1;
        player.currentTime = player.buffered.end(0);

        if (ptzLockInterval) clearInterval(ptzLockInterval);

        // 5초에 한번씩 buffer 를 끝으로 보냄
        ptzLockInterval = setInterval(() => {
          player.playbackRate = 1;
          player.currentTime = player.buffered.end(0);
        }, 5000);

        // mjpeg 플레이어 추가
        let mjpegUrlStr = playerInfo['streamUrl'].replace('ws', 'http');
        mjpegUrlStr = mjpegUrlStr.replace('stream', 'mjpeg');

        // localhost check
        if (window.location.host.indexOf('localhost') > -1) {
          mjpegUrlStr = `/media${mjpegUrlStr.split('/media')[1]}`;
        }

        const img = document.createElement('img');
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.zIndex = '100';
        img.src = `${mjpegUrlStr}/${playerInfo['vmsType']}/${player.id.split('_')[1]}`;
        player.parentElement.append(img);

        return true;
      } else {
        if (ptzLockInterval) clearInterval(ptzLockInterval);

        ptzLockInterval = setInterval(() => {
          player.playbackRate = 1;
          player.currentTime = player.buffered.end(0);
        }, 3000);

        return false;
      }
    }
  } catch (e) {
    const err: object = {
      code: ErrorCode.ptzMode,
      funcName: 'ptzModeOn',
      msg: 'PTZ Mode On Failed : ' + e,
    };
    if (errorMsgCallbackFuncArray.length > 0) {
      errorMsgFuncCall(err, playerUrl);
    } else {
      console.log('DMS-Player Error: Error Message Function None');
    }
  }
}

/**
 * @name ptzModeOff
 * @function
 * @description PTZ Mode Off
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {string} playerUrl 플레이어 요청 URL
 * @return {boolean}
 * @example // 비동기 함수, then() 메서드 처리 필요
 * dmsPlayer.ptzModeOff(this.player).then(ptzStatus => {
 *   if (ptzStatus) {
 *     // true, off Success
 *     // false off Failed
 *   }
 * });
 */
export async function ptzModeOff(player: HTMLVideoElement, playerUrl: string) {
  try {
    const ptzStatus = await getPtzMessage(player, 'UNLOCK');
    if (ptzStatus['command'] === 302) {
      const message = ptzStatus['result']; // 0: 'success', 1: 'failed'
      if (message === 0) {
        if (ptzLockInterval) clearInterval(ptzLockInterval);

        ptzLockInterval = setInterval(() => {
          player.playbackRate = 1;
          player.currentTime = player.buffered.end(0);
        }, 3000);

        // mjpeg 플레이어 삭제
        if (player.parentElement.hasChildNodes()) {
          const children = player.parentElement.childNodes;
          children.forEach((el: HTMLElement) => {
            if (el.tagName === 'IMG') {
              el.remove();
            }
          });
        }

        return true;
      } else {
        return false;
      }
    }
  } catch (e) {
    const err: object = {
      code: ErrorCode.ptzMode,
      funcName: 'ptzModeOn',
      msg: 'PTZ Mode On Failed : ' + e,
    };
    if (errorMsgCallbackFuncArray.length > 0) {
      errorMsgFuncCall(err, playerUrl);
    } else {
      console.log('DMS-Player Error: Error Message Function None');
    }
  }
}

/**
 * @name ptzPresetList
 * @function
 * @description PTZ 프리셋 리스트 조회
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {Object}
 * @example dmsPlayer.ptzPresetList(this.player);
 */
export async function ptzPresetList(player: HTMLVideoElement) {
  try {
    const presetList = await getPresetListMessage(player);
    if (presetList) {
      if (presetList['result'] === 0) {
        return presetList['param'];
      } else {
        return false;
      }
    }
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Get Preset List Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzPresetAdd
 * @function
 * @description PTZ 프리셋 저장
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {undefined}
 * @example dmsPlayer.ptzPresetSave(this.player);
 */
export async function ptzPresetAdd(player: HTMLVideoElement) {
  try {
    console.log('preset ptzPresetSave');
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Preset Save Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzPresetDelete
 * @function
 * @description PTZ 프리셋 삭제
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {undefined}
 * @example dmsPlayer.ptzPresetDelete(this.player);
 */
export async function ptzPresetDelete(player: HTMLVideoElement) {
  try {
    console.log('preset ptzPresetDelete');
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Preset Delete Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzPresetMove
 * @function
 * @description PTZ 선택 프리셋 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} presetNo preset 번호
 * @return {undefined}
 * @example dmsPlayer.ptzPresetMove(this.player, presetNo);
 */
export async function ptzPresetMove(player: HTMLVideoElement, presetNo: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1032,
        ptzPresetNo: presetNo,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => Preset Move Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzUp
 * @function
 * @description PTZ 위로 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzUp(this.player, 1);
 */
export function ptzUp(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1002,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Up Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzUpLeft
 * @function
 * @description PTZ 위, 왼쪽 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzUpLeft(this.player, 1);
 */
export function ptzUpLeft(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1001,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ UpLeft Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzUpRight
 * @function
 * @description PTZ 위, 오른쪽 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzUpRight(this.player, 1);
 */
export function ptzUpRight(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1003,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ UpRight Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzLeft
 * @function
 * @description PTZ 왼쪽 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzLeft(this.player, 1);
 */
export function ptzLeft(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1004,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Left Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzRight
 * @function
 * @description PTZ 오른쪽 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzRight(this.player, 1);
 */
export function ptzRight(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1006,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Right Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzDown
 * @function
 * @description PTZ 아래 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzDown(this.player, 1);
 */
export function ptzDown(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1008,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Down Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzDownLeft
 * @function
 * @description PTZ 아래, 왼쪽 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzDownLeft(this.player, 1);
 */
export function ptzDownLeft(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1007,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ DownLeft Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzDownRight
 * @function
 * @description PTZ 아래, 오른쪽 이동
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzDownRight(this.player, 1);
 */
export function ptzDownRight(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1009,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ DownRight Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzFocusIn
 * @function
 * @description PTZ 포커스 In
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzFocusIn(this.player, 1);
 */
export function ptzFocusIn(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1010,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Focus In Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzFocusOut
 * @function
 * @description PTZ 포커스 Out
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzFocusOut(this.player, 1);
 */
export function ptzFocusOut(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1011,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Focus Out Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzZoomIn
 * @function
 * @description PTZ 줌 In
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzZoomIn(this.player, 1);
 */
export function ptzZoomIn(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1012,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Zoom In Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzZoomOut
 * @function
 * @description PTZ 줌 Out
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {number} speed PTZ 제어 속도
 * @return {undefined}
 * @example dmsPlayer.ptzZoomOut(this.player, 1);
 */
export function ptzZoomOut(player: HTMLVideoElement, speed: number) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1013,
        speed: speed ? speed : 1,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Zoom Out Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzStop
 * @function
 * @description PTZ 정지
 * @param {HTMLVideoElement} player DMS Player 객체
 * @return {undefined}
 * @example dmsPlayer.ptzStop(this.player);
 */
export function ptzStop(player: HTMLVideoElement) {
  try {
    const evt = new CustomEvent('ptzControl', {
      detail: {
        ptzCmd: 1014,
        speed: 0,
      },
    });
    player.dispatchEvent(evt);
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ Stop Control Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}

/**
 * @name ptzAreaZoom
 * @function
 * @description PTZ 영역 줌
 * @param {HTMLVideoElement} player DMS Player 객체
 * @param {Object} options ptz x,y 좌표 정보
 * @param {number} options.startX 영역 시작점 X 좌표 정보 (0~1)
 * @param {number} options.startY 영역 시작점 Y 좌표 정보 (0~1)
 * @param {number} options.endX 영역 시작점 X 좌표 정보 (0~1)
 * @param {number} options.endY 영역 시작점 Y 좌표 정보 (0~1)
 * @param {boolean} point point 여부
 * @return {undefined}
 * @example
 * const ptzOptions = {
 *    'startX': locationInfo.startX,
 *    'startY': locationInfo.startY,
 *    'endX': locationInfo.endX,
 *    'endY': locationInfo.endY
 *  };
 *
 * dmsPlayer.ptzAreaZoom(this.player, ptzOptions);
 */
export function ptzAreaZoom(player: HTMLVideoElement, options: any, point?: boolean) {
  try {
    if (point) {
      const evt = new CustomEvent('ptzControl', {
        detail: {
          ptzCmd: 1048,
          speed: 0,
          startX: options.startX,
          startY: options.startY,
          endX: options.endX,
          endY: options.endY,
        },
      });
      player.dispatchEvent(evt);
    } else {
      if (options.startX !== options.endX && options.startY !== options.endY) {
        const evt = new CustomEvent('ptzControl', {
          detail: {
            ptzCmd: 1048,
            speed: 0,
            startX: options.startX,
            startY: options.startY,
            endX: options.endX,
            endY: options.endY,
          },
        });
        player.dispatchEvent(evt);
      }
    }
  } catch (e) {
    const err: Error = e;
    console.log(
      '%c !! ERROR => PTZ ptzAreaZoom Failed %c ' + err + ' ',
      'background-color:#000000; color:#ffffff; font-size:15px;',
      'background-color:red; color:#ffffff; font-size:15px;'
    );
  }
}
