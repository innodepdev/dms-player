## 💬 DMS Video Player?

DMS Video Player 란 [**이노뎁(주)**](http://www.innodep.com/)의 VURIX DMS Essential 프로젝트 중 CCTV영상에 대한 웹브라우저 재생을 목적으로 개발된, 영상 연동 모듈입니다.

## 💬 특징

- 스트리밍 서버는 Docker base로 제작된 프로그램으로 설치가 간결하다.
- HTTP프로토콜 및 Websocket을 이용하여 통신하크로, 웹서비스 포트외에 별도의 포트를 사용하지 않는다.
- 프런트앤드 개발시, 하나의 Javascript 모듈만들 추가하면 DMS Video Player를 사용할 수 있다.
- [**이노뎁(주)**](http://www.innodep.com/)의 VURIX-VMS 연계하여 영상을 표출할 수 있다.
- VURIX-VMS 연계할 경우, PTZ제어 및 Preset제어를 DMS Video Player 모듈 안에서 처리할 수 있다
- 기본적인 RTSP 프로토콜을 지원한다.

## Setup

<PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;">
$ npm install --save dms-player # Latest Version
$ npm install --save dms-player@<version> # Specific Version
</PRE>

## Usage

- ES6 Modules
<PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;">
import dmsPlayer from 'dms-player';
</PRE>
- CommonJS
<PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;">
const dmsPlayer = require('dmsPlayer');
</PRE>
