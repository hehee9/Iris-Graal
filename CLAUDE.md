# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Always Resond in Korean.

## Project Overview

This is Iris-Graal, a KakaoTalk chatbot built for MessengerBot R 0.7.40-alpha running on GraalJS. This project provides communication and parsing between Iris and Messenger Bot R, with the /features directory containing files that implement practical functionality.

## Architecture

### Core Components

- **main.js**: Entry point that bootstraps the system, manages lifecycle, and coordinates all components
- **infra/httpServer**: HTTP server that receives KakaoTalk webhook messages via POST /message
- **infra/ingress**: Message dispatcher that routes parsed messages/feeds to appropriate handlers
- **core/router**: Feature router that distributes messages to registered handlers based on priority and type
- **infra/queue**: Message sending queue with rate limiting (200ms text, 5000ms media)
- **core/schedule**: Timer-based task scheduler with drift correction

### Message Flow

1. External KakaoTalk → HTTP POST /message (Iris) → httpServer
2. httpServer → ingress.handle(raw) → parser transforms to { kind, data }
3. Router dispatches to feature modules based on message/feed type
4. Features enqueue responses through queue system
5. Queue worker sends messages with rate limiting via Bot.send/mediaSender

### Directory Structure

```
main.js
node_modules/
├─ adapters/
│    ├─ external/
│    │    └─ kakaolink.js // 카카오링크 전송 모듈
│    └─ kakao/
│         ├─ hydrator.js // 로컬/카카오 서버 DB 질의
│         └─ parser.js // 메시지 raw 데이터 파싱
├─ core/
│    ├─ featurePolicy.js // 방별 기능 관리 설정
│    ├─ router.js // 파싱한 메시지를 기능 모듈로 분배
│    └─ schedule.js // 중앙 tick 기반 주기 작업 레지스트리
├─ features/
│    ├─ moderation.js // 답장으로 밴/언밴 관리.
│    ├─ memberFeed.js // 입장/퇴장/강퇴 시 반응.
│    ├─ example.js // 예시 파일
│    └─ ...
├─ infra/
│    ├─ httpServer.js // Iris에서 HTTP 수신
│    ├─ ingress.js // HTTP 수신(raw) → 내부 이벤트 분배 브릿지
│    ├─ queue.js // 메시지/파일 전송 큐 관리
│    ├─ roomRegistry.js // 채팅방 별 특이사항 등 정보 기록
│    └─ sender.js // 실제 송신 담당
└─ shared/
     ├─ config.js // 각종 상수 설정
     ├─ logger.js // 로그 래핑
     ├─ types.js // 공용 typedef
     └─ utils.js // 자주 쓰는 기능 모음
```

## Development Guidelines

### Threading Model
- **HTTP Server**: Runs on Java thread pool - NEVER call Bot.* or MediaSender.* from server threads
- **Main Thread**: All Bot.send, queue processing, and timer operations must run on script main thread
- Use minimal shared state between threads; prefer immutable objects or single-consumer queues

### Message Sending
- All outgoing messages must go through the queue system (infra/queue)
- Text messages: minimum 200ms interval
- Media messages: minimum 5000ms interval

### Data Types
- channelId: Handle as string in logic, convert to BigInt only for Bot.send operations
- Prefer String type even at runtime, but Bigint is also allowed
- Use documented field types without unnecessary validation (trust the contracts)

### File Paths and Configuration
- Data root: `sdcard/botData/`
- Logs: `sdcard/botData/log/`
- Config: `sdcard/botData/config/`
- location: `sdcard/msgbot/Bots/{script}/node_modules/...` (script = main)

### Error Handling
- Always use try-catch for: JSON.parse, network I/O, file operations
- Log errors with full stack: Logger.e(scriptOrFunctionName: string, message: string|object)
- Avoid defensive programming for documented APIs

### Command Handler Style

- The `onMessage` function should only contain simple operations like the following.
```example
/**
 * @description Message handler
 * @param {import(“shared/types”).Message} msg
 * @returns {boolean|void}
 */
function onMessage(msg) {
    const userId = msg.author.userId;
    const roomId = msg.room.channelId;
    const { cmd, args } = parseCommand(msg.content);

    // Good example - Call the handler and return the result
    // Command validation is allowed but not recommended
    if (cmd === “command1”) {
        const result1 = handler1(userId, roomId, args);
        msg.send(result1);
        return true;
    }

    // Bad example - Complex handling within onMessage
    if (cmd === “command2”) {
        const a = 123;
        const b = 456;
        // ...
        msg.send(result2);
        return true;
    }
}
```

Translated with DeepL.com (free version)

### Time and Utilities
- KST dates: `new Date(Date.now() + 32400000).toISOString().slice(0, 10)` (YYYY-MM-DD)
- View More marker: `const VIEW_MORE = "\u200b".repeat(500);` for long outputs
- Use modern string methods: includes(), startsWith() instead of indexOf patterns

## Module System

### CommonJS Only
- Use require/module.exports (no ESM import/export)
- Script-local node_modules only
- Java interop via Java.type() only (no importPackage)

### Feature Registration
Features register with router using:
- Message handlers with priority system
- Command registration for help system
- Feed handlers for member events (join/leave/kick)

### Testing Areas
- HTTP endpoint message reception and parsing
- Message routing and feature dispatch
- Queue rate limiting and sending
- Lifecycle management (startup/shutdown)
- Error handling and recovery

## Key Files Referenced
- kakaoTalkBot.md: Restrictions and Supported Built-in Methods in the Messenger Bot R Environment
- node_modules/shared/config.js: Configuration constants and paths
- node_modules/core/router.js: Message routing and handler registration
- node_modules/shared/types.js: Structure of the parsed message object