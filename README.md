## ๐ฌ DMS Video Player?

DMS Player ๋ [**์ด๋ธ๋(์ฃผ)**](http://www.innodep.com/)์ VURIX DMS Essential ํ๋ก์ ํธ ์ค CCTV์์์ ๋ํ ์น๋ธ๋ผ์ฐ์  ์ฌ์์ ๋ชฉ์ ์ผ๋ก ๊ฐ๋ฐ๋, ์์ ์ฐ๋ ๋ชจ๋์๋๋ค.

## ๐ฌ ํน์ง

- ์คํธ๋ฆฌ๋ฐ ์๋ฒ๋ Docker base๋ก ์ ์๋ ํ๋ก๊ทธ๋จ์ผ๋ก ์ค์น๊ฐ ๊ฐ๊ฒฐํ๋ค.
- HTTPํ๋กํ ์ฝ ๋ฐ Websocket์ ์ด์ฉํ์ฌ ํต์ ํํฌ๋ก, ์น์๋น์ค ํฌํธ์ธ์ ๋ณ๋์ ํฌํธ๋ฅผ ์ฌ์ฉํ์ง ์๋๋ค.
- ํ๋ฐํธ์ค๋ ๊ฐ๋ฐ์, ํ๋์ Javascript ๋ชจ๋๋ง๋ค ์ถ๊ฐํ๋ฉด DMS Video Player๋ฅผ ์ฌ์ฉํ  ์ ์๋ค.
- [**์ด๋ธ๋(์ฃผ)**](http://www.innodep.com/)์ VURIX-VMS ์ฐ๊ณํ์ฌ ์์์ ํ์ถํ  ์ ์๋ค.
- VURIX-VMS ์ฐ๊ณํ  ๊ฒฝ์ฐ, PTZ์ ์ด ๋ฐ Preset์ ์ด๋ฅผ DMS Video Player ๋ชจ๋ ์์์ ์ฒ๋ฆฌํ  ์ ์๋ค
- ๊ธฐ๋ณธ์ ์ธ RTSP ํ๋กํ ์ฝ์ ์ง์ํ๋ค.

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
