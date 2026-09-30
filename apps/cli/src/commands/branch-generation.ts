// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-632 分支代际计数器 —— 异步解算期间分支被切换 ⇒ 本轮结果必须作废而非落地。
//
// 窗口:REPL 的 runToolLoop 在飞时,用户 /fork、/branch、/sessions resume 切换了分支;
// 旧轮结果回来后若不设防,会把旧分支的 assistant 答复写进新分支的会话(state.history +
// saveSession)。设计三步:
//   1. 分支装配出口(装配/切换成功处)调 bumpBranchGeneration —— 代数 +1;
//   2. 异步解算启动(runToolLoop 入口)调 captureBranchGeneration —— 捕获当下代数;
//   3. 结果落地前(调用方收尾处)用 isBranchGenerationCurrent 比对 —— 不等 ⇒
//      recordSupersededBranchResult 记作废并取日志行,结果绝不落地到错误分支。
// 作废必须可观测:superseded 计数 + 事件流水(有界)+ 落地调用方打印日志行,不许静默丢。
//
// 本模块零依赖(无 import),保证 node --test 类型剥离直读时无外部解析面。

/** 单条代数事件(装配/切换 bump 与结果作废 superseded 共用一表) */
export interface BranchGenerationEvent {
  /** 进程内单调流水号(与 generation 无关,事件本身可观测排序用) */
  readonly seq: number;
  readonly kind: 'bump' | 'superseded';
  /** bump 后的新代数 / 作废判定时的当前代数 */
  readonly generation: number;
  /** bump:装配出口名(fork / branch / sessions-resume);superseded:缺省 'branch-switched' */
  readonly reason?: string;
  /** superseded 专用:结果携带的陈旧代数 */
  readonly staleGeneration?: number;
  /** superseded 专用:会话 id(落地目标,便于对账) */
  readonly sessionId?: string;
  readonly at: string;
}

export interface BranchGenerationStats {
  /** 当前代数(进程级单调递增) */
  generation: number;
  /** 分支装配/切换累计次数 */
  bumps: number;
  /** 异步解算捕获累计次数 */
  captures: number;
  /** 旧轮结果被判作废累计次数(每一条都对应一次日志行,不许静默丢) */
  superseded: number;
}

const EVENT_LOG_LIMIT = 100;

let generation = 0;
let bumps = 0;
let captures = 0;
let superseded = 0;
let seq = 0;
const events: BranchGenerationEvent[] = [];

function pushEvent(event: BranchGenerationEvent): void {
  events.push(event);
  if (events.length > EVENT_LOG_LIMIT) events.shift();
}

/** 当下代数(只读) */
export function currentBranchGeneration(): number {
  return generation;
}

/**
 * 分支装配出口专用:一次装配/切换成功 ⇒ 代数 +1。
 * reason 是装配出口名(如 'fork' / 'branch' / 'sessions-resume'),进事件流水供对账。
 */
export function bumpBranchGeneration(reason: string): number {
  generation += 1;
  bumps += 1;
  pushEvent({ seq: ++seq, kind: 'bump', generation, reason, at: new Date().toISOString() });
  return generation;
}

/** 异步解算启动时捕获当下代数(返回值即结果携带的代际令牌) */
export function captureBranchGeneration(): number {
  captures += 1;
  return generation;
}

/** 结果落地前比对:结果携带的代数仍等于当下代数 ⇒ 可落地 */
export function isBranchGenerationCurrent(token: number): boolean {
  return token === generation;
}

/**
 * 结果代数过期 ⇒ 记一次作废(计数 + 事件流水),并返回人读日志行。
 * 调用方必须把该行打出去(可观测红线:不许静默丢),同时**不得**把本轮结果
 * 写进会话/账本 —— 作废的语义是"整轮丢弃",不是"换个地方存"。
 */
export function recordSupersededBranchResult(
  staleToken: number,
  detail?: { sessionId?: string },
): string {
  superseded += 1;
  const event: BranchGenerationEvent = {
    seq: ++seq,
    kind: 'superseded',
    generation,
    staleGeneration: staleToken,
    ...(detail?.sessionId !== undefined ? { sessionId: detail.sessionId } : {}),
    at: new Date().toISOString(),
  };
  pushEvent(event);
  const sessionTail = detail?.sessionId !== undefined ? ` (session ${detail.sessionId})` : '';
  return (
    `[branch-generation] 本轮结果已作废(代际 ${staleToken} ≠ 当前 ${generation},` +
    `分支在解算期间切换);不写入会话/账本${sessionTail}`
  );
}

/** 只读快照(供 /status 类观测口与测试断言) */
export function branchGenerationStats(): BranchGenerationStats {
  return { generation, bumps, captures, superseded };
}

/** 最近的事件流水(有界,新的在后) */
export function recentBranchGenerationEvents(): readonly BranchGenerationEvent[] {
  return events;
}

/** 测试专用:进程级计数器与流水整体归零 */
export function __resetBranchGenerationForTest(): void {
  generation = 0;
  bumps = 0;
  captures = 0;
  superseded = 0;
  seq = 0;
  events.length = 0;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
