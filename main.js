/**
 * @file main.js
 * @description Iris-Graal 메인 진입점
 * @author Hehee
 * @environment GraalJS / MessengerBot R 0.7.40-alpha
 * @note 일반적으로 channelId는 문자열로 처리하되, 메시지 전송에서는 bigint로 써야 함
 */




/* =================================== 상수/전역 =================================== */


const _SCRIPT_NAME = "main.js";
const { Logger } = require("shared/logger");
const httpServer = require("infra/httpServer");
const ingress = require("infra/ingress");
const router = require("core/router");
const schedule = require("core/schedule");
const queue = require("infra/queue");
const { TICK_INTERVAL_MS, PATH_ROOT, PATH_LOG, PATH_CONFIG } = require("shared/config");
const bot = BotManager.getCurrentBot();


let tickTimer = null;
let tickRunning = false;
let tickBase = 0;
let tickIndex = 0;




/* =================================== 메인 로직 =================================== */


/** @description 주기 스케줄링 */
function scheduleNext() {
    if (!tickRunning) return;
  
    const now = Date.now();
    const nextAt = tickBase + (tickIndex * TICK_INTERVAL_MS);
    const delay = nextAt - now;
  
    if (delay <= 0) {
        tickTimer = setTimeout(() => {
            if (!tickRunning) return;
            try { onTick(); }
            catch (e) { Logger.e(_SCRIPT_NAME, e); }
    
            const after = Date.now();
            tickIndex = Math.floor((after - tickBase) / TICK_INTERVAL_MS) + 1;
            scheduleNext();
        }, 0);
        return;
    }
  
    tickTimer = setTimeout(() => {
        if (!tickRunning) return;
        try { onTick(); }
        catch (e) { Logger.e(_SCRIPT_NAME, e); }
    
        tickIndex += 1;
        scheduleNext();
    }, delay);
}
/** @description onTick 타이머 시작 */
function startTick() {
    if (tickRunning) return; // 중복 시작 방지
    tickRunning = true;
    tickBase = Date.now();
    tickIndex = 1;
    scheduleNext();
}
/** @description onTick 타이머 중단 */
function stopTick() {
    tickRunning = false;
    if (tickTimer) {
        clearTimeout(tickTimer);
        tickTimer = null;
    }
}


/** @description ingress와 httpServer 연결 및 파서/핸들러 주입 */
function wireIngress() {
    ingress.setParser((raw) => {
        const ft =
            (raw?.msg?.feedType) ?
                raw.msg.feedType :
                (raw?.json?.message?.feedType) ?
                    raw.json.message.feedType : null;

        if (ft) {
            return { kind: "feed", data: { ...raw, feedType: ft } };
        }
        return { kind: "message", data: raw };
    });

    ingress.setHandlers({
        onMessage: (raw) => router.routeMessage(raw),
        onNewMember: (feed) => router.routeFeed({ ...feed, feedType: 4 }),
        onLeaveMember: (feed) => router.routeFeed({ ...feed, feedType: 2 }),
        onKickMember: (feed) => router.routeFeed({ ...feed, feedType: 6 }),
        onFeed: (feed) => router.routeFeed(feed)
    });

    httpServer.onPost = ingress.handle;
}


/** @description 부팅 시퀀스 */
function bootstrap() {
    // 경로 보장
    try {
        FileStream.createDir(PATH_ROOT);
        FileStream.createDir(PATH_LOG);
        FileStream.createDir(PATH_CONFIG);
    } catch (e) {
        Logger.e(_SCRIPT_NAME, e);
    }

    Device.acquireWakeLock(1); // 어차피 봇만 돌리는 폰이니 상관 없다고 가정. 상횡에 따라 주석 처리
    router.init();
    wireIngress();
    httpServer.startServer();
    queue.start();
    startTick();
}


/** @description 종료/컴파일 직전 처리 */
function shutdown() {
    httpServer.stopServer();
    stopTick();
    queue.stop();
    schedule.clear();
    Device.releaseWakeLock();
}






/** @description 메시지 수신 시 동작 */
function onMessage() {}
/** @description 매 초마다 동작 */
function onTick() {
    schedule.tick();
}
/** @description 새 멤버 입장 시 동작 */
function onNewMember() {}
/** @description 멤버 퇴장 시 동작 */
function onLeaveMember() {}
/** @description 멤버 강퇴 시 동작 */
function onKickMember() {}

/** @description 컴파일 직전 동작 */
function onStartCompile() {
    shutdown();
}



bot.addListener(Event.START_COMPILE, onStartCompile);
bootstrap();