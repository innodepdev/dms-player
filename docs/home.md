DMS Vedio Player
======================

# 1. DMS Video Player 란?
VMS Vidoe Player 란 [**이노뎁(주)**](http://www.innodep.com/)의 VURIX DMS Essential 프로젝트 중 CCTV영상에 대한 웹브라우저 재생을 목적으로 개발된, 영상 연동 모듈입니다.

# 2. 특징
* 스트리밍 서버는 Docker base로 제작된 프로그램으로 설치가 간결하다.
* HTTP프로토콜 및 Websocket을 이용하여 통신하크로, 웹서비스 포트외에 별도의 포트를 사용하지 않는다.
* 프런트앤드 개발시, 하나의 Javascript 모듈만들 추가하면 DMS Video Player를 사용할 수 있다.
* [**이노뎁(주)**](http://www.innodep.com/)의 VURIX-VMS 연계하여 영상을 표출할 수 있다.
* VURIX-VMS 연계할 경우, PTZ제어 및 Preset제어를 DMS Video Player 모듈 안에서 처리할 수 있다
* 기본적인 RTSP 프로토콜을 지원한다.

# 3. 설치
* 설치 명령
  <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> docker run -d --restart=unless-stopped -p 8080:8080 --name dms-video-service innodepcloud.azurecr.io/dms-video-player-service:latest </PRE>

* 서비스 80 포트를 변경을 원할 경우, 아래 굵은색 부분을 변경해 해 주시면 됩니다.
  <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> docker run -d --restart=unless-stopped -p <B><U>80</U></B>:8080 --name dms-video-service innodepcloud.azurecr.io/dms-video-player-service:latest </PRE>

* 해당 소프트웨어는 [**이노뎁(주)**](http://www.innodep.com/)의 프라이빗 도커 레지스트에 등록이 되어 있으므로 다운로드를 원하신다면, [**이노뎁(주)**](http://www.innodep.com/)에 연락하여 주십시오.

# 4. 사용법
* 소프트웨어를 설치하신 서버에 아래와 같은 경로로 웹브라우저로 접속하실 경우, 라이브러리 모듈의 레퍼런스 문서를 확인할 수 있습니다.
  <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> http://[설치된서버주소]:8080/help/ </PRE>

* DMS Video Player 모듈을 프로젝트에 적용하는 법
  <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;">&lt;script src="https://[설치된서버주소]:8080/js/dms-video-player.min.js" crossorigin="anonymous"&gt;&lt;/script&gt;
  &lt;script&gt;
  dmsVideoPlayer.createvideo(this.videoOptions);
          ....
  dmsVideoPlayer.streamPlay(this.player);
  &lt;/script&gt;</PRE>

# 5. DEMO 프로그램 사용법
* 소프트웨어를 설치하신 서버에 아래와 같은 경로로 웹브라우저로 접속하실 경우, DEMO 프로그램을 다운로드 할 수 있습니다.
  <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> http://[설치된서버주소]:8080/help/demo.zip </PRE>

* 데모 프로그램 실행방법
  * 다운로드 받은 데모 프로그램의 압축을 해제한다.
    <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> $ unzip demo.zip </PRE>
  * node package 를 설치한다.
    <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> $ npm install </PRE>
  * 스트림 서버 및 VURIX-VMS서버 주소등 아이피 주소를 변경한다. 
    * proxy.conf.json 파일의 VURIX의 WebAPI 주소와 포트를 입력한다
      <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;">
      {
        "/api/*": {
          "target": "http://172.16.36.105:8080",
          "secure": false,
          "changeOrigin": true
        }
      }</PRE>
    * src/app/views/player/vurix.component.ts 파일과 src/app/views/player/playback.component.ts 파일의 createDMSVideo 함수에 VURIX WebAPI 서버 주소 및 dms-video-player 서버의 주소와 연결할 카메라 자산정보를 수정한다
      <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;">
      this.videoOptions = {
        'id': 'test_video',
        'url': 'vurix://172.16.36.105:8080',
        'stream': 'ws://172.16.36.106:8080/ws/stream',
        'vmsId': 100503,
        'devSerial': 3,
        'channel': 0,
        'media': 0,
        'token': this.token
      }; </PRE>
  * 프로그램을 실행한다.
    <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> $ npm start </PRE>
  * 프로그램이 실행된 서버에 8000 포트로 웹 접속한다.
    <PRE style="padding: 16px;overflow: auto;font-size: 85%;line-height: 1.45;background-color: #e2e2e2;border-radius: 3px;"> http://[설치된서버주소]:8000/help/ </PRE>

