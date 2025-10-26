# Iris-Graal 개발 문서

> MessengerBot R 0.7.40+ 기반 카카오톡 봇 프레임워크

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [마이그레이션 가이드](#마이그레이션-가이드)
3. [아키텍처](#아키텍처)
4. [Feature 개발 가이드](#feature-개발-가이드)
5. [API 레퍼런스](#api-레퍼런스)
6. [고급 주제](#고급-주제)
7. [문제 해결](#문제-해결)

---

## 프로젝트 개요

### Iris-Graal이란?

Iris-Graal은 MessengerBot R 0.7.40+ 환경에서 동작하는 모던 카카오톡 봇 프레임워크입니다. GraalJS 기반으로 작성되었으며, 다음과 같은 특징을 가집니다:

- **Thread-Safe 아키텍처**: Java Thread Pool과 Script Main Thread 분리
- **Queue 기반 전송 시스템**: Rate Limiting 및 재시도 로직 내장
- **모듈화된 구조**: CommonJS 모듈 시스템 활용
- **Feature 플러그인 시스템**: 기능별 독립적 개발 및 관리
- **Type-Safe**: JSDoc 기반 타입 정의

### 기술 스택

- **Runtime**: GraalJS (MessengerBot R 0.7.40+)
- **Module System**: CommonJS
- **Type System**: JSDoc
- **HTTP Server**: Java ServerSocket
- **Database**: SQLite (Iris 통합)
- **Networking**: Jsoup

---

## 마이그레이션 가이드

### 레거시 API → Iris-Graal

#### 기본 구조 변경

**Before (레거시 API)**
```javascript
function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
    if (msg === "!안녕") {
        replier.reply("안녕하세요!");
    }
}
```

**After (Iris-Graal)**
```javascript
/**
 * @typedef {object} Message
 * @property {Author} author 발신자 정보
 * @property {Room} room 방 정보
 * @property {string} content 전체 메시지 문자열
 * @property {string} id 메시지 id
 * @property {string} type 메시지 타입 번호, 정수형 문자열
 * @property {boolean} isMine 내가(봇이) 보낸 메시지인지 여부
 * @property {Reply|null} reply 답장 정보
 * @property {Mention[]} mention 멘션 정보
 * @property {Attachment[]} attachment 첨부파일 정보
 * @property {(text: string) => boolean} send 텍스트 응답 전송, 항상 true 반환
 * @property {(media: string|string[], timeoutMs?: number, fileName?: string) => boolean} sendMedia 파일 응답 전송, 항상 true 반환
 */
function onMessage(msg) {
    if (msg.content === "!안녕") {
        return msg.send("안녕하세요!");
    }
}

/** @description 기능 등록 */
function register({ registerMessage }) {
    registerMessage(onMessage);
}

/* 또는
function register(context) {
    context.registerMessage((msg) => {
        if (msg.content === "!안녕") {
            return msg.send("안녕하세요!");
        }
    });
}
*/

module.exports = { register };
```

#### 주요 변경 사항

| 레거시 API | Iris-Graal | 비고 |
|-----------|------------|------|
| `msg` | `msg.content` | 메시지 내용 |
| `sender` | `msg.author.name` | 발신자 이름 |
| `room` | `msg.room.name` | 방 이름 |
| `replier.reply(text)` | `msg.send(text)` | 텍스트 전송 |
| `new MediaSender().send(channelId, url)` | `msg.sendMedia(url)` | 미디어 전송 |
| 전역 변수 | 모듈 스코프 | 상태 관리 |

### API2 → Iris-Graal

API2는 레거시 API의 개선판이지만, Iris-Graal과는 구조가 다릅니다.

**Before (API2)**
```javascript
const bot = BotManager.getCurrentBot();

function onMessage(msg) {
    if (msg.content === "!안녕") {
        msg.reply("안녕하세요!");
    }
};

bot.addListener(Event.MESSAGE, onMessage);
```

**After (Iris-Graal)**
```javascript
function onMessage(msg) {
    if (msg.content === "!안녕") {
        return msg.send("안녕하세요!");
    }
}

/** @description 기능 등록 */
function register({ registerMessage }) {
    registerMessage(onMessage);
}

module.exports = { register };
```

#### 주요 차이점

| API2 | Iris-Graal | 차이점 |
|------|------------|--------|
| `msg.reply(text)` | `msg.send(text)` | 메서드 이름 변경 |
| `msg.author` | `msg.author` | 동일 |
| `msg.room` | `msg.room` | 동일 |
| `bot.addListener` | `register(context)` | 등록 방식 변경 |
| 직접 호출 | Queue 기반 | 전송 방식 변경 |

### 실전 예제: 명령어 봇 마이그레이션

**Before (레거시 API)**
```javascript
var userPoints = {}; // 전역 변수

function response(room, msg, sender, isGroupChat, replier) {
    if (msg === "!포인트") {
        var points = userPoints[sender] || 0;
        replier.reply(sender + "님의 포인트: " + points);
    } else if (msg === "!포인트증가") {
        userPoints[sender] = (userPoints[sender] || 0) + 10;
        replier.reply("포인트가 10 증가했습니다!");
    } else if (msg === "!도움말") {
        replier.reply("!포인트, !포인트증가, !도움말");
    }
}
```

**After (Iris-Graal)**
```javascript
const _SCRIPT_NAME = "points.js";
const { Logger } = require("shared/logger");
const { parseCommand } = require("shared/utils"); // shared/config.js에서 PREFIX = "!" 선언

// 모듈 스코프 변수
const userPoints = {};

function onMessage(msg) {
    const { cmd } = parseCommand(msg.content);

    if (cmd === "포인트") {
        const points = userPoints[msg.author.userId] || 0;
        return msg.send(`${msg.author.name}님의 포인트: ${points}`);
    }

    if (cmd === "포인트증가") {
        userPoints[msg.author.userId] = (userPoints[msg.author.userId] || 0) + 10;
        return msg.send("포인트가 10 증가했습니다!");
    }

    if (cmd === "도움말") {
        return msg.send("!포인트, !포인트증가, !도움말");
    }
}

function register(context) {
    context.registerMessage(onMessage);
}

module.exports = { register };
```

#### 변경 포인트

- **파라미터 구조화**: `msg, sender, room` → `msg.content, msg.author, msg.room`
- **명령어 파싱**: 수동 비교 → `parseCommand()` 유틸 사용
- **사용자 식별**: `sender` (이름) → `msg.author.userId` (고유 ID)

---

## 아키텍처

### 전체 구조

```
main.js (엔트리 포인트)
├── node_modules/
│   ├── core/           # 핵심 로직
│   │   ├── router.js       # 메시지 라우팅
│   │   ├── schedule.js     # 주기 작업 스케줄러
│   │   └── featurePolicy.js # 기능 on/off 관리
│   ├── infra/          # 인프라 계층
│   │   ├── httpServer.js   # HTTP 웹훅 수신
│   │   ├── ingress.js      # 이벤트 분배
│   │   ├── queue.js        # 전송 큐 관리
│   │   ├── sender.js       # 실제 전송 담당
│   │   └── roomRegistry.js # 방 정보 캐시
│   ├── adapters/       # 외부 시스템 어댑터
│   │   ├── kakao/
│   │   │   ├── parser.js   # 메시지 파싱
│   │   │   └── hydrator.js # DB 조회 및 데이터 보강
│   │   └── external/
│   │       └── kakaolink.js # 카카오링크 전송
│   ├── shared/         # 공용 유틸리티
│   │   ├── config.js       # 설정 상수
│   │   ├── types.js        # 타입 정의
│   │   ├── logger.js       # 로깅 시스템
│   │   └── utils.js        # 범용 유틸
│   └── features/       # 기능 모듈
│       ├── moderation.js   # 밴/언밴 관리
│       ├── memberFeed.js   # 입퇴장 감지
│       └── ...
```

### 메시지 플로우

```
카카오톡 메시지
    ↓
┌─────────────────────────────────────────┐
│ [httpServer.js]                         │
│ Java Thread Pool에서 HTTP POST 수신      │
│ - ServerSocket.accept()                 │
│ - JSON 파싱 (큰 정수 → 문자열 변환)        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ [ConcurrentLinkedQueue]                 │
│ Thread-safe 큐에 저장                    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ [Pump 메커니즘]                          │
│ 50ms마다 큐 플러시 → 메인 스레드 이동       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ [ingress.js]                            │
│ Raw 데이터 분류                           │
│ - message / feed 구분                    │
│ - Background Thread로 라우팅             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ [router.js]                             │
│ - parser.parseMessage(raw)              │
│ - hydrator.ensureFullContent(raw)       │
│ - featurePolicy 확인                     │
│ - Priority 순으로 핸들러 실행              │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ [Feature 핸들러]                         │
│ - msg.send("텍스트")                     │
│ - msg.sendMedia(url)                    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ [queue.js]                              │
│ - 텍스트 큐 (300ms 간격)                  │
│ - 미디어 큐 (5000ms 간격)                 │
│ - 재시도 로직 (최대 3회)                   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ [sender.js]                             │
│ - sendTextNow: Bot.send()               │
│ - sendFileNow: MediaSender.send()       │
└─────────────────────────────────────────┘
    ↓
카카오톡 응답 전송
```

### 스레딩 모델

#### 1. Java Thread Pool (HTTP Server)
```
[역할]
- ServerSocket.accept() 대기
- HTTP 요청 수신 및 파싱
- ConcurrentQueue에 데이터 추가

[주의사항]
- Bot.* 또는 MediaSender.* 호출 지양
- 메인 스레드 블로킹 주의
```

#### 2. Main Script Thread
```
[역할]
- Pump가 큐를 비워서 처리
- 모든 Bot.send, MediaSender 호출
- Timer, setTimeout 실행
- Queue 처리

[특징]
- 단일 스레드 → 동기화 불필요
- Bot API 안전하게 호출 가능
```

#### 3. Background Thread (ingress)
```
[역할]
- App.runOnBackgroundThread로 파싱 실행
- 핸들러 실행 (CPU 집약적 작업)

[특징]
- 메인 스레드 부하 분산
- Bot API 호출 시 큐 사용 필수
```

### Feature 등록 시스템

```javascript
// router.js의 init() 함수에서 features 배열에 등록
const features = [
    {
        name: "기능명",
        path: "features/example",
        defaultEnabled: true,
        commandList: [
            { command: "명령어", description: "설명" } // 선택
        ]
    }
];

// 각 feature 모듈
function register(context) {
    // 메시지 핸들러 등록
    context.registerMessage(handler, priority);

    // 피드 핸들러 등록
    context.registerFeed(feedType, handler, priority);
}
```

---

## Feature 개발 가이드

### 기본 템플릿

```javascript
/**
 * @file features/example.js
 * @description 예시 기능 모듈
 */

const _SCRIPT_NAME = "example.js";
const { Logger } = require("shared/logger");
const { parseCommand } = require("shared/utils");

// 모듈 스코프 변수 (기능별 상태 저장)
const state = {};

/**
 * @description 메시지 핸들러
 * @param {import("shared/types").Message} msg
 * @returns {boolean|void} true를 반환하면 이후 핸들러 중단
 */
function handleMessage(msg) {
    const { cmd, args } = parseCommand(msg.content);

    if (cmd === "안녕") {
        return msg.send("안녕하세요!");
    }

    // 조건에 맞지 않으면 다음 핸들러로 진행 (return 없음)
}

/**
 * @description 피드 핸들러
 * @param {import("shared/types").Feed} feed
 */
function handleJoin(feed) {
    // 입장 시 환영 메시지
    feed.send("환영합니다!");
}

/**
 * @description Feature 등록
 * @param {object} context
 * @param {(handler: Function, priority?: number) => void} context.registerMessage
 * @param {(feedType: number, handler: Function, priority?: number) => void} context.registerFeed
 */
function register(context) {
    // 메시지 핸들러 등록
    context.registerMessage(handleMessage);

    // 피드 핸들러 등록 (4: 입장, 2: 퇴장, 6: 강퇴)
    context.registerFeed(4, handleJoin);
}

module.exports = { register };
```

### 메시지 핸들러 작성

#### Priority 시스템

핸들러는 **Priority 값이 높을수록 먼저 실행**됩니다.

```javascript
context.registerMessage(adminHandler, 1000);  // 가장 먼저 실행
context.registerMessage(coreHandler, 500);    // 2번째
context.registerMessage(normalHandler, 100);  // 기본
context.registerMessage(fallbackHandler, 20); // 마지막
```

#### 핸들러 중단

```javascript
function handler(msg) {
    const { cmd } = parseCommand(msg.content);

    // ✅ 패턴 1: return true로 중단
    if (cmd === "안녕") {
        msg.send("안녕하세요!");
        return true; // 이후 핸들러 중단
    }

    // ✅ 패턴 2: return msg.send()로 간결하게
    if (cmd === "도움말") {
        return msg.send("도움말 내용...");
    }

    // ✅ 패턴 3: 조건 불만족 시 return 없음 (다음 핸들러 진행)
}
```

#### Message 객체 활용

```javascript
function handler(msg) {
    // 기본 정보
    const content = msg.content;          // 메시지 내용
    const roomName = msg.room.name;       // 방 이름
    const roomId = msg.room.channelId;    // 방 ID (정수형 string)
    const userName = msg.author.name;     // 발신자 이름
    const userId = msg.author.userId;     // 발신자 ID (정수형 string)

    // 메시지 메타데이터
    const msgId = msg.id;                 // 메시지 ID
    const msgType = msg.type;             // 메시지 타입 ("1", "2", ...)
    const isMine = msg.isMine;            // 봇이 보낸 메시지 여부

    // 첨부파일
    if (msg.attachment.length > 0) {
        const file = msg.attachment[0];
        const fileType = file.type;       // "image", "video", ...
        const fileUrl = file.url;         // 다운로드 URL
        const fileName = file.name;       // 파일명
    }

    // 답장
    if (msg.reply) {
        const originalMsgId = msg.reply.srcId;
        const originalUserId = msg.reply.srcUserId;
    }

    // 멘션
    if (msg.mention.length > 0) {
        const mention = msg.mention[0];
        const mentionedUserId = mention.srcUserId;
    }

    // 응답 전송
    msg.send("텍스트 메시지");
    msg.sendMedia("https://example.com/image.jpg");
}
```

### 피드 핸들러 작성

```javascript
function register(context) {
    // feedType별 핸들러 등록
    context.registerFeed(4, onJoin);   // 입장
    context.registerFeed(2, onLeave);  // 퇴장
    context.registerFeed(6, onKick);   // 강퇴
}

function onJoin(feed) {
    // feed.roomId: 방 ID
    // feed.send(): 텍스트 전송
    // feed.sendMedia(): 미디어 전송

    feed.send("환영합니다!");
}
```

### 스케줄 작업 등록

```javascript
const { registerPeriodic } = require("core/schedule");
const { Logger } = require("shared/logger");

function register(context) {
    // 주기 작업 등록 (10초마다 실행)
    registerPeriodic({
        id: "my-task",                // 고유 ID (선택)
        intervalMs: 10000,            // 10초
        handler: onTick,              // 핸들러 함수
        featureName: "기능명",         // Feature Policy 연동
        roomId: "123456789",          // 방별 토글 (선택)
        alignToTick: true             // 등록 시점 기준 정렬
    });
}

function onTick(now) {
    // now: 현재 타임스탬프
    Logger.d("onTick", "10초마다 실행됨: " + now);
}
```

### Feature Policy 활용

```javascript
const featurePolicy = require("core/featurePolicy");

// 방별 기능 활성화 여부 확인
const enabled = featurePolicy.isEnabledForRoom(roomId, "기능명");

// 방별 기능 on/off
featurePolicy.setRoom(roomId, "기능명", true);  // 활성화
featurePolicy.setRoom(roomId, "기능명", false); // 비활성화

// 전역 기본값 설정
featurePolicy.setDefault("기능명", true);

// 오버라이드 제거 (기본값으로 복귀)
featurePolicy.resetRoomFeature(roomId, "기능명");
```

### 명령어 목록 등록

router.js의 `features` 배열에 등록:

```javascript
{
    name: "🎮게임",
    path: "features/games/quiz",
    defaultEnabled: true,
    commandList: [
        { command: "퀴즈", description: "퀴즈 게임 시작" },
        { command: ["퀴즈순위", "퀴즈랭킹"], description: "퀴즈 순위 확인" },
        { command: "퀴즈설정", description: "퀴즈 난이도 설정" }
    ]
}
```

사용자가 `!명령어` 또는 `!도움말`을 입력하면 자동으로 표시됩니다.

---

## API 레퍼런스

### Message 객체

```typescript
interface Message {
    // 기본 정보
    content: string;              // 메시지 내용
    id: string;                   // 메시지 ID, 정수형 문자열
    type: string;                 // 메시지 타입 ("1", "2", ...)
    isMine: boolean;              // 봇이 보낸 메시지 여부

    // 발신자 정보
    author: {
        name: string;             // 발신자 이름
        userId: string;           // 발신자 ID, 정수형 문자열
        isBanned: boolean;        // 차단 여부
    };

    // 방 정보
    room: {
        name: string;             // 방 이름
        channelId: string;        // 방 ID, 정수형 문자열
        isGroupChat: boolean;     // 단체 채팅방 여부
        isOpenChat: boolean;      // 오픈 채팅방 여부
    };

    // 첨부파일
    attachment: Array<{
        type: string;             // "image", "video", "audio", ...
        mime: string;             // MIME 타입
        url: string;              // 다운로드 URL
        size: number;             // 파일 크기 (byte)
        name?: string;            // 파일명
    }>;

    // 답장
    reply: {
        srcId: string;            // 원본 메시지 ID, 정수형 문자열
        srcUserId: string;        // 원본 발신자 ID, 정수형 문자열
        srcType: string;          // 원본 메시지 타입
    } | null;

    // 멘션
    mention: Array<{
        srcUserId: string;        // 멘션된 사용자 ID, 정수형 문자열
        at: number[];             // 멘션 위치 (1부터 시작)
        len: number;              // 멘션 텍스트 길이
    }>;

    // 응답 메서드
    send: (text: string) => boolean;  // 텍스트 전송, 항상 true 반환
    sendMedia: (media: string | string[], timeoutMs?: number, fileName?: string) => boolean;
}
```

### Feed 객체

```typescript
interface Feed {
    feedType: number | string;    // 피드 타입 (2: 퇴장, 4: 입장, 6: 강퇴)
    roomId?: string;              // 방 ID

    // 응답 메서드
    send: (text: string) => boolean;
    sendMedia: (media: string | string[], timeoutMs?: number, fileName?: string) => boolean;
}
```

### Router API

```typescript
// 메시지 핸들러 등록
context.registerMessage(
    handler: (msg: Message) => boolean | void,
    priority?: number  // 기본값: 100
): void

// 피드 핸들러 등록
context.registerFeed(
    feedType: number,  // 2: 퇴장, 4: 입장, 6: 강퇴
    handler: (feed: Feed) => boolean | void,
    priority?: number  // 기본값: 100
): void
```

### Queue & Sender

```typescript
// 텍스트 전송 큐에 추가
enqueueText(target: string | bigint, text: string): void

// 미디어 전송 큐에 추가
enqueueMedia(
    target: string | bigint,
    media: string | string[],  // URL, 경로, base64, byte[]
    timeoutMs?: number,        // 기본값: 30000
    fileName?: string          // 파일명 (선택)
): void

// 즉시 전송 (일반적으로 큐 사용 권장)
sendTextNow(target: string | bigint, content: string): boolean
sendFileNow(target: string | bigint, path: string, timeoutMs?: number, fileName?: string): boolean
```

### Hydrator API

```typescript
// 4000자 이상 메시지 전문 가져오기 (기본 적용됨)
ensureFullContent(raw: RawData): string

// 답장 원본 메시지 조회
resolveReplyOriginal(srcId: string): Message | null

// ID로 유저 이름 조회
getUserNameWithId(userId: string | bigint): string | null

// 프로필 이미지 URL 조회
getProfileImageUrl(userId: string | bigint, channelId: string | bigint): string | null

// 방 내 모든 멤버 ID 조회
getAllMemberIds(channelId: string | bigint): string[]

// 방 타입 조회
getRoomType(channelId: string | bigint): { isOpenChat: boolean, isGroupChat: boolean } | null
```

### Utils

```typescript
// SQLite 쿼리 실행
executeQuery(query: string): object | null

// 관리자 확인
isAdmin(userId: string | bigint): boolean

// 차단 여부 확인
isBanned(userId: string | bigint): boolean

// 명령어 파싱
// 예시:
// !명령어 1 2 3
// - cmd: "명령어"
// - args: ["1", "2", "3"]
// - payload: 명령어 1 2 3
parseCommand(content: string, prefix?: string): {
    cmd: string;      // 소문자 변환된 명령어
    args: string[];   // 인자 배열
    payload: string;  // 전체 payload
}

// 막대 그래프 생성
toBar(now: number, max: number, totalBlocks?: number): string
toVerticalBar(names: string[], values: number[], max?: number, needSort?: boolean): string

// 숫자 포맷팅
splitNum(num: number): string  // 1000 → "1,000"

// 달러 환율 조회
getDollar(): number
```

### KakaoLink (커스텀 모듈)

**개요**

KakaoLink는 카카오 개발자 센터에서 생성한 커스텀 템플릿을 사용하여 리치 메시지(이미지, 버튼 등이 포함된 메시지)를 전송하는 모듈입니다.

- **모듈 경로**: `adapters/external/kakaolink.js`
- **원본 레포지토리**: [kakaolink-py by ye-seola](https://github.com/ye-seola/kakaolink-py) (Python → JavaScript 포팅)
- **인증 방식**: Iris AOT 자동 연동
- **특징**: 세션 자동 관리, 2FA 자동 처리, 쿠키 기반 세션 유지

**초기화 및 사용법**

```typescript
// 1. 모듈 import
const { create } = require("adapters/external/kakaolink");

// 2. 인스턴스 생성
interface KakaoLinkOptions {
    app_key: string;                    // 필수: 카카오 개발자 센터 JavaScript 키
    origin: string;                     // 필수: 카카오 개발자 센터에 등록한 origin
    searchExact?: boolean;              // 정확히 일치하는 방 이름 검색 (기본값: true)
    searchFrom?: "ALL" | "FRIENDS" | "CHATROOMS";  // 검색 범위 (기본값: "ALL")
    searchRoomType?: "ALL" | "OpenMultiChat" | "MultiChat" | "DirectChat";  // 방 타입 (기본값: "ALL")
    getAuthorization?: () => string;    // 커스텀 인증 함수 (기본값: Iris AOT 사용)
    cookiePath?: string;                // 쿠키 저장 경로 (기본값: ${PATH_CONFIG}/kaling_cookies.json)
}

const kaling = create({
    app_key: "YOUR_APP_KEY",
    origin: "YOUR_ORIGIN"
});

// 3. 초기화 (세션 확인 및 로그인)
kaling.init();

// 4. 메시지 전송
const success = kaling.send(
    receiverName: string,       // 카카오톡 방 이름 또는 친구 닉네임
    templateId: number | string,  // 커스텀 템플릿 ID
    templateArgs: object,       // 템플릿 인자 (템플릿에 정의된 변수명과 일치)
    options?: {                 // 선택사항
        searchExact?: boolean,
        searchFrom?: string,
        searchRoomType?: string
    }
): boolean;  // 전송 성공 여부 반환
```

**사용 시 주의사항**

1. **카카오 개발자 센터 설정 필수**
   - 앱 등록 및 JavaScript 키 발급
   - 커스텀 템플릿 생성 (템플릿 ID 확인)
   - Origin 등록 (예: `https://yourdomain.com`)

2. **템플릿 인자 정확히 일치**
   - `templateArgs`의 키는 템플릿에 정의된 변수명과 정확히 일치해야 함
   - 타입도 일치해야 함 (string, number 등)

3. **Iris AOT 서버 필요**
   - 자동 인증을 위해 Iris AOT 서버 연동 필요
   - 커스텀 인증 함수 제공 가능 (`getAuthorization` 옵션)

4. **세션 관리**
   - 초기 로그인 시 2FA(추가 인증) 필요할 수 있음
   - 세션은 쿠키로 저장되며 자동으로 갱신됨
   - 유효 기간이 지나면 자동으로 재로그인 시도

**검색 옵션 활용**

```javascript
// 정확한 방 이름으로 검색
kaling.send("카톡 정보방", templateId, templateArgs, {
    searchExact: true
});

// 방 이름에 포함된 문자열로 검색
kaling.send("정보방", templateId, templateArgs, {
    searchExact: false
});

// 오픈 채팅방만 검색
kaling.send("방 이름", templateId, templateArgs, {
    searchFrom: "CHATROOMS",
    searchRoomType: "OpenMultiChat"
});

// 일반 단체 채팅방만 검색
kaling.send("방 이름", templateId, templateArgs, {
    searchFrom: "CHATROOMS",
    searchRoomType: "MultiChat"
});

// 친구 1:1 채팅만 검색
kaling.send("친구 닉네임", templateId, templateArgs, {
    searchFrom: "FRIENDS",
    searchRoomType: "DirectChat"
});
```

**디버깅 팁**

```javascript
// 1. 초기화 상태 확인
const KL = ensureKaling();
if (!KL) {
    Logger.e(_SCRIPT_NAME, "KakaoLink 초기화 실패");
}

// 2. 전송 결과 확인
const success = KL.send(roomName, templateId, templateArgs);
Logger.d(_SCRIPT_NAME, `KakaoLink 전송: ${success ? "성공" : "실패"}`);

// 3. 템플릿 인자 확인
Logger.d(_SCRIPT_NAME, templateArgs);  // 자동으로 stringify
```

### Logger

```typescript
// 로그 레벨
Logger.i(scriptName: string, log: any, isImportant?: boolean): void  // info
Logger.d(scriptName: string, log: any, isImportant?: boolean): void  // debug
Logger.w(scriptName: string, log: any, isImportant?: boolean): void  // warn
Logger.e(scriptName: string, log: any, isImportant?: boolean): void  // error

// 스크립트별 로거 생성
const logger = Logger.of("myScript.js");
logger.i("정보 로그");
logger.e("에러 발생!");
```

---

## 고급 주제

### Thread Safety 가이드

#### ⚠️ 금지 사항

```javascript
// ❌ Java Thread에서 Bot API 호출 지양
httpServer.onPost = (data) => {
    Bot.send(roomId, "메시지");
};

// ❌ ExecutorService 내에서 Bot API 호출 지양
executorService.execute(() => {
    Bot.send(roomId, "메시지");
});
```

#### ✅ 권장 패턴

```javascript
// ✅ 메인 스레드에서만 Bot API 호출
function handleMessage(msg) {
    msg.send("메시지");  // 내부적으로 큐 사용
}

// ✅ 공유 상태는 ConcurrentQueue 사용
const inbox = new (Java.type("java.util.concurrent.ConcurrentLinkedQueue"))();

// Java Thread에서 추가
inbox.add(data);

// 메인 스레드에서 처리
setInterval(() => {
    while (!inbox.isEmpty()) {
        const item = inbox.poll();
        Bot.send(roomId, item);
    }
}, 100);
```

### 성능 최적화

#### DB 쿼리 최적화

```javascript
// ❌ 나쁜 예: 루프 내 쿼리
for (let userId of userIds) {
    const name = getUserNameWithId(userId);  // N번 쿼리
}

// ✅ 좋은 예: 일괄 쿼리
const query = `SELECT user_id, name FROM users WHERE user_id IN (${userIds.join(",")})`;
const result = executeQuery(query);
```

#### 큐 크기 모니터링

```javascript
const { size, sizeText, sizeMedia } = require("infra/queue");

// 큐 크기 확인
const totalQueueSize = size();
if (totalQueueSize > 100) {
    Logger.w(_SCRIPT_NAME, `큐 과부하: ${totalQueueSize}`);
}
```

---

## 문제 해결

### 자주 발생하는 오류

#### 메시지가 전송되지 않음

**원인**: 큐가 시작되지 않음 또는 중단됨

**해결**:
```javascript
// main.js에서 확인
queue.start();  // 부팅 시 호출 확인

// 디버깅
const { size } = require("infra/queue");
Logger.i(_SCRIPT_NAME, `큐 크기: ${size()}`);
```

#### "Module not found: shared/logger"

**원인**: 상대 경로 사용

**해결**:
```javascript
// ❌ 잘못된 경로
require("../shared/logger");

// ✅ 올바른 경로
require("shared/logger");  // node_modules 기준
```

#### 핸들러가 실행되지 않음

**원인**: Feature가 등록되지 않음 또는 비활성화됨

**해결**:
```javascript
// 1. router.js의 features 배열에 추가 확인
// 2. featurePolicy 확인
const enabled = featurePolicy.isEnabledForRoom(roomId, "기능명");
Logger.d(_SCRIPT_NAME, `기능 활성화 여부: ${enabled}`);
```

### 디버깅 팁

#### 로그 활용

```javascript
// 메시지 내용 확인
Logger.d(_SCRIPT_NAME, `수신: ${msg.content}`);

// 객체 전체 출력
Logger.d(_SCRIPT_NAME, msg); // 자동으로 stringify

// 조건 확인
Logger.d(_SCRIPT_NAME, `cmd: ${cmd}, args: ${args}`);
```

#### 조건부 로깅

```javascript
const DEBUG = true;

if (DEBUG) {
    Logger.d(_SCRIPT_NAME, `디버그: ${value}`);
}
```

---

## 부록

### 메시지 타입 참조

| Type | 설명 |
|------|------|
| 0 | 피드 |
| 1 | 순수 텍스트 메시지 |
| 2 | 사진 |
| 3 | 동영상 |
| 18 | 첨부파일 |
| 26 | 답장 |
| 27 | 사진 여러 장 |
| 71 | 카카오링크 |

### 피드 타입 참조

| Type | 설명 |
|------|------|
| 2 | 퇴장 |
| 4 | 입장 |
| 6 | 강퇴 |

### 설정 파일 경로

```
sdcard/botData/
├── log/                # 로그 파일
├── config/
│   ├── featureFlags    # Feature on/off 설정
│   ├── admin.json      # 관리자 ID 목록
│   ├── ban.json        # 차단 사용자 목록
│   ├── roomCache.json  # 방 정보 캐시
│   └── firstRoom.json  # 첫 채팅 감지
```