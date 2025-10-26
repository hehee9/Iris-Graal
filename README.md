# Iris-Graal

> MessengerBot R 0.7.40+ 기반 카카오톡 봇 프레임워크

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Iris-Graal은 MessengerBot R 0.7.40+ 환경에서 동작하는 모던 카카오톡 봇 프레임워크입니다. GraalJS 기반으로 작성되었으며, Thread-Safe 아키텍처와 Queue 기반 전송 시스템을 제공합니다.

## 주요 특징

- **Thread-Safe 아키텍처**: Java Thread Pool과 Script Main Thread 분리
- **Queue 기반 전송 시스템**: Rate Limiting 및 재시도 로직 내장
- **모듈화된 구조**: CommonJS 모듈 시스템 활용
- **Feature 플러그인 시스템**: 기능별 독립적 개발 및 관리
- **Type-Safe**: JSDoc 기반 타입 정의
- **중앙화된 에러 핸들링**: Logger 시스템 통합

## 기술 스택

- **Runtime**: GraalJS (MessengerBot R 0.7.40+)
- **Module System**: CommonJS
- **Type System**: JSDoc
- **HTTP Server**: Java ServerSocket
- **Database**: SQLite (Iris 통합)
- **Networking**: Jsoup

## 시작하기

### 필수 요구사항

- [MessengerBot R](https://github.com/MessengerBotTeam/msgbot-old-release/releases) 0.7.40 이상
- [Iris](https://github.com/dolidolih/Iris) (HTTP 웹훅 서버)

### 설치

1. 메신저봇R에서 `main` 스크립트를 생성합니다.

1. 이 저장소를 MessengerBot R의 스크립트 디렉토리에 클론합니다:
   ```bash
   cd /sdcard/msgbot/Bots/main/
   git clone https://github.com/hehee9/Iris-Graal.git main
   ```

2. Iris Dashboard (`{IRIS_URL}/dashboard`)에서 설정을 구성합니다:
   - **IRIS_PORT**: HTTP 서버 포트 (기본값: 12345)
   - **IRIS_ENDPOINT**: 웹훅 엔드포인트 (기본값: `/message`)

3. `node_modules/shared/config.js`를 열어 환경에 맞게 설정을 조정합니다:
   ```javascript
   const IRIS_PORT = 12345; // Iris Dashboard의 설정과 일치
   const IRIS_URL = "http://127.0.0.1:3000"; // Iris 서버 URL
   ```

4. MessengerBot R 앱에서 스크립트를 활성화합니다.

### 첫 번째 Feature 만들기

`node_modules/features/` 디렉토리에 새 파일을 생성합니다:

```javascript
/**
 * @file features/hello.js
 * @description 간단한 인사 봇
 */

const _SCRIPT_NAME = "hello.js";
const { parseCommand } = require("shared/utils");

function onMessage(msg) {
    const { cmd } = parseCommand(msg.content);

    if (cmd === "안녕") {
        return msg.send("안녕하세요!");
    }
}

function register(context) {
    context.registerMessage(onMessage);
}

module.exports = { register };
```

그리고 `node_modules/core/router.js`의 `features` 배열에 등록합니다:

```javascript
const features = [
    {
        name: "👋인사",
        path: "features/hello",
        defaultEnabled: true,
        commandList: [
            { command: "안녕", description: "봇에게 인사하기" }
        ]
    },
    // ... 기존 features
];
```

## 프로젝트 구조

```
main.js                 # 엔트리 포인트
node_modules/
├── core/              # 핵심 로직
│   ├── router.js          # 메시지 라우팅
│   ├── schedule.js        # 주기 작업 스케줄러
│   └── featurePolicy.js   # 기능 on/off 관리
├── infra/             # 인프라 계층
│   ├── httpServer.js      # HTTP 웹훅 수신
│   ├── ingress.js         # 이벤트 분배
│   ├── queue.js           # 전송 큐 관리
│   ├── sender.js          # 실제 전송 담당
│   └── roomRegistry.js    # 방 정보 캐시
├── adapters/          # 외부 시스템 어댑터
│   ├── kakao/
│   │   ├── parser.js      # 메시지 파싱
│   │   └── hydrator.js    # DB 조회 및 데이터 보강
│   └── external/
│       └── kakaolink.js   # 카카오링크 전송
├── shared/            # 공용 유틸리티
│   ├── config.js          # 설정 상수
│   ├── types.js           # 타입 정의
│   ├── logger.js          # 로깅 시스템
│   └── utils.js           # 범용 유틸
└── features/          # 기능 모듈
    ├── moderation.js      # 밴/언밴 관리
    ├── memberFeed.js      # 입퇴장 감지
    └── ...
```

## 문서

- **[개발 가이드](DEVELOPMENT.md)**: Feature 개발, API 레퍼런스, 마이그레이션 가이드
- **[CLAUDE.md](CLAUDE.md)**: Claude Code를 위한 프로젝트 가이드

## 기여

모든 종류의 기여를 환영합니다! 이슈를 열거나 Pull Request를 제출해 주세요.

## 라이센스

이 프로젝트는 [CC BY-NC-SA 4.0](LICENSE.md) 라이센스 하에 배포됩니다.

- **BY (Attribution)**: 저작자를 명시해야 합니다.
- **NC (NonCommercial)**: 비영리 목적으로만 사용할 수 있습니다.
- **SA (ShareAlike)**: 동일 조건으로 배포해야 합니다.

## 저작자

**Hehee** - [GitHub](https://github.com/hehee9)

## 감사의 글

- [MessengerBot R](https://github.com/MessengerBotTeam/msgbot-old-release/releases) - Graal JS 기반 카카오톡 봇 플랫폼
  * *아직 v0.7.40+은 정식 릴리즈 되지 않았을 수 있음.*
- [Iris](https://github.com/dolidolih/Iris) - 안드로이드 네이티브 DB기반 봇 프레임워크
- [kakaolink-py](https://github.com/ye-seola/kakaolink-py) - KakaoLink 모듈의 원본 (Python → JavaScript 포팅)

## 문제 해결

문제가 발생하면 [Issues](https://github.com/hehee9/Iris-Graal/issues)에 보고해 주세요.