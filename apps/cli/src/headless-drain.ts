// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814406 — 无头模式(--json / 非 TTY)退出前的有界排水出口。
 *
 * 立论:一次性进程在 `runAgent` 返回后即走退出路径,而此刻注册表里可能仍有 running 的
 * 后台任务、以及任务落定后才排的钩子尾巴("进程退了活还没干完")。交互 REPL 早在
 * `commands/repl.ts` 用 `waitForTask` 等过这一格,无头面此前**没有任何等待出口**。
 *
 * 上游同族机制(`headless-workflow.ts:300-349` 一带)的形态是:窄触发(有没有在活动)+
 * 宽谓词(两个 busy 布尔)+ 轮询等待,abort 即刻返回并记 `stopped(interrupted)`。
 * 本模块实现同等语义,但按本仓纪律改两处(方向都是"更安全且更少静默"):
 *  ① **总预算有限**(默认 60s,钳制在 [1s, 30min])—— 上游"不设超时"在有界性要求下
 *     不照抄;到点必须带着**逐名报名**的未结算清单收场,而不是无限挂着或静默退场。
 *  ② **结论可分辨**(`idle | drained | timed-out | interrupted | interactive-skipped`)——
 *     与 `WaitForTaskState` 四态、`SettleAllInFlightResult` 三档是同一条"一个计数不许
 *     同时表达两件事"的禁令;`timed-out`/`interrupted` 都点名 unsettledTaskIds,绝不折成 0。
 *
 * 判读边界(如实登记,别误以为这里有门):
 *  - 每轮复用注入的 `settleWindow`(生产接线给 `settleAllInFlight`)—— 它是**入口时刻快照**
 *    的有界等待;"在飞派生在飞"由每轮结束后重评 `hasInFlightWork` 覆盖,不是 settleWindow 自己。
 *  - abort 的响应粒度 = 一轮窗口(`roundMs`,默认 5s):settleWindow 自身不看 signal,
 *    所以不做"即刻"承诺,只做"有界内即刻"—— 比上游的静默返回多一层可问责的窗口上界。
 *  - `hasInFlightWork` 的"通知回合"一维由调用方注入:当前 HEAD 在无头退出点可达的
 *    在飞事实只有后台任务注册表;钩子尾巴(`handle.result.then`)不可从端外枚举,
 *    归 tools/** 持有人接线后并入同一谓词(见交付报告未闭环清单)。
 *
 * 文案说明:本模块**不产任何面向用户的句子** —— 结论以结构化字段返回,播报由调用点
 * 用 NDJSON/ASCII 串落(守门 70 新文件中文字基线为 0;注释中文不受检)。
 */

/** 排水结论五档,互相可分辨(判读禁令:不得把"没等到"折进"等到了")。 */
export type HeadlessDrainConclusion =
  /** 非无头模式 —— 逐字不走等待,交互面行为一字不变(反向 guard)。 */
  | 'interactive-skipped'
  /** 窄触发未命中:入口时刻就没有在飞工作,零轮零等待。 */
  | 'idle'
  /** 在飞工作在本预算内全部收敛。 */
  | 'drained'
  /** 预算耗尽仍有在飞工作 —— 带着逐名清单收场,不静默。 */
  | 'timed-out'
  /** abort 信号命中 —— 即刻收场并记 interrupted(上游 stopped(interrupted) 的我方可分辨版)。 */
  | 'interrupted';

/** 一轮有界等待的结论形状(与 `SettleAllInFlightResult` 同形,便于生产直接接 `settleAllInFlight`)。 */
export interface HeadlessDrainWindowResult {
  readonly settled: number;
  readonly unknown: readonly string[];
  readonly gone: readonly string[];
}

export interface HeadlessDrainDeps {
  /** 无头开关(`--json` 或非 TTY stdout)。false ⇒ 立即 interactive-skipped,不调任何谓词。 */
  readonly isHeadless: boolean;
  /** 宽谓词:此刻还有没有在飞工作(后台任务/通知回合)。每轮结束后重评,覆盖"在飞派生在飞"。 */
  readonly hasInFlightWork: () => boolean;
  /** 单轮有界收敛出口;生产接 `settleAllInFlight(windowMs)`。 */
  readonly settleWindow: (windowMs: number) => Promise<HeadlessDrainWindowResult>;
  /** 未结算任务逐名出口(仅 timed-out/interrupted 结论时用于报名;drained 路径不调用)。 */
  readonly listInFlightTaskIds?: () => readonly string[];
  /** 中断信号(无头运行持有的同一个 AbortController)。 */
  readonly signal?: AbortSignal;
  /** 总预算(ms)。缺省 = HEADLESS_DRAIN_DEFAULT_TOTAL_MS;钳制在 [MIN, MAX],**必有界**。 */
  readonly totalBudgetMs?: number;
  /** 单轮窗口(ms)。缺省 = HEADLESS_DRAIN_ROUND_MS。 */
  readonly roundMs?: number;
  /** 时钟与睡眠注入(测试用假时钟;生产走 Date.now/setTimeout)。 */
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface HeadlessDrainReport {
  readonly conclusion: HeadlessDrainConclusion;
  /** 实际执行的 settleWindow 轮数。 */
  readonly rounds: number;
  /** 各轮观察到终态的任务数之和。 */
  readonly settledTotal: number;
  /** timed-out/interrupted 时逐名点名的未结算 id;drained/idle/interactive-skipped 恒为空。 */
  readonly unsettledTaskIds: readonly string[];
  /** 实际等待时长(ms)。 */
  readonly waitedMs: number;
}

/** 默认总预算:60 秒 —— 有界(任务约束"等待超时要有限"),不是上游的无限等待。 */
export const HEADLESS_DRAIN_DEFAULT_TOTAL_MS = 60_000;
/** 下限 1 秒:预算被配成 0/负数不许退化成"不等直接退"(那会把等待维洗掉)。 */
export const HEADLESS_DRAIN_MIN_TOTAL_MS = 1_000;
/** 硬上限 30 分钟:钳制调用方传入的超大值,保持"必有界"。 */
export const HEADLESS_DRAIN_MAX_TOTAL_MS = 30 * 60_000;
/** 单轮窗口:5 秒(abort 响应粒度 = 该值;同时是每轮重评谓词的节拍)。 */
export const HEADLESS_DRAIN_ROUND_MS = 5_000;

/** 预算钳制(唯一实现,调用点不得各钳各的)。 */
export function clampDrainBudgetMs(totalMs: number | undefined): number {
  const raw = totalMs === undefined ? HEADLESS_DRAIN_DEFAULT_TOTAL_MS : totalMs;
  if (!Number.isFinite(raw) || raw <= 0) return HEADLESS_DRAIN_DEFAULT_TOTAL_MS;
  return Math.min(Math.max(raw, HEADLESS_DRAIN_MIN_TOTAL_MS), HEADLESS_DRAIN_MAX_TOTAL_MS);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 无头退出前排空在飞工作。
 *
 * 判序(每一步都有对应用例钉住,改动判序=翻测试):
 *  ① !isHeadless ⇒ 'interactive-skipped'(零谓词调用、零 settle 调用 —— 交互面零影响);
 *  ② 已 abort ⇒ 'interrupted'(带名单,若注入了 listInFlightTaskIds);
 *  ③ 窄触发 !hasInFlightWork() ⇒ 'idle'(零轮 —— 不空转);
 *  ④ 循环:settleWindow(min(roundMs, 剩余预算)) → 轮间检查 abort(检查点一)→
 *     重评 hasInFlightWork(检查点二;"在飞派生在飞"在这一维覆盖)→ 预算耗尽检查(检查点三);
 *  ⑤ 出口:谓词转 false ⇒ 'drained';signal aborted ⇒ 'interrupted';预算耗尽 ⇒ 'timed-out'。
 *  后两档都点名 unsettledTaskIds(未注入名单出口时如实给 settleWindow 最后一轮的 unknown 集,
 *  绝不用空数组冒充"没有未结算")。
 */
export async function drainHeadlessBeforeExit(deps: HeadlessDrainDeps): Promise<HeadlessDrainReport> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const startedAt = now();

  const finish = (
    conclusion: HeadlessDrainConclusion,
    rounds: number,
    settledTotal: number,
    unsettled: readonly string[],
  ): HeadlessDrainReport => ({
    conclusion,
    rounds,
    settledTotal,
    unsettledTaskIds: conclusion === 'drained' || conclusion === 'idle' || conclusion === 'interactive-skipped'
      ? []
      : unsettled,
    waitedMs: Math.max(0, now() - startedAt),
  });

  // ① 反向 guard:交互模式(非无头)逐字不受影响 —— 谓词都不问,免得给 REPL 路径引入任何调用面。
  if (!deps.isHeadless) {
    return finish('interactive-skipped', 0, 0, []);
  }

  const currentNames = (): readonly string[] => {
    if (deps.listInFlightTaskIds) {
      try {
        return [...deps.listInFlightTaskIds()];
      } catch {
        // 名单出口坏了 ≠ 没有未结算:落 unknown-unspecced 的保守形态,由调用点播报。
        return ['<unsettled-ids-unenumerable>'];
      }
    }
    return [];
  };

  // ② 进来就已 abort:没有等待的必要,直接给 interrupted(上游 abort 即刻返回的同款语义)。
  if (deps.signal?.aborted) {
    return finish('interrupted', 0, 0, currentNames());
  }

  // ③ 窄触发:没有在飞工作就不开任何一轮(idle 与 drained 分档 —— "什么都没等"不许写成"等到了")。
  if (!deps.hasInFlightWork()) {
    return finish('idle', 0, 0, []);
  }

  const budget = clampDrainBudgetMs(deps.totalBudgetMs);
  const roundMs = deps.roundMs && deps.roundMs > 0 ? deps.roundMs : HEADLESS_DRAIN_ROUND_MS;

  let rounds = 0;
  let settledTotal = 0;
  let lastUnknown: readonly string[] = [];
  for (;;) {
    const waited = now() - startedAt;
    const remaining = budget - waited;
    if (remaining <= 0) {
      // 检查点三:预算耗尽 —— timed-out 必须点名,绝不静默。
      const names = deps.listInFlightTaskIds ? currentNames() : lastUnknown;
      return finish('timed-out', rounds, settledTotal, names.length > 0 ? names : ['<unknown-count-unknown>']);
    }
    const window = Math.min(roundMs, remaining);
    const r = await deps.settleWindow(window);
    rounds += 1;
    settledTotal += r.settled;
    lastUnknown = r.unknown;

    // 检查点一:轮间 abort —— 有界窗口内即刻(响应粒度 = 剩余窗口)。
    if (deps.signal?.aborted) {
      const names = deps.listInFlightTaskIds ? currentNames() : lastUnknown;
      return finish('interrupted', rounds, settledTotal, names);
    }

    // 检查点二:重评宽谓词(在飞派生在飞在这一维被覆盖;settleWindow 只结快照)。
    if (!deps.hasInFlightWork()) {
      return finish('drained', rounds, settledTotal, []);
    }
    // 轮间让出(极短):避免谓词为真但 settleWindow 立即返回时的忙轮询;让出粒度不计入预算判定
    // (预算以 now() 实测,睡眠自然消耗预算)。
    await sleep(0);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
