// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814406 验收 —— 无头退出前的有界排水(headless-drain.ts)。
 *
 * 成对判据(任务书"每条判据要有正例 + 反例"):
 *  · 正例:仍有 running 任务时**确实等待**且不提前收工(drained 分两轮 / 在飞派生在飞);
 *  · 反例:交互模式(isHeadless=false)零等待零调用,一个谓词都不问;
 *  · 结论可分辨:idle ≠ drained(没等 vs 等到了)、timed-out/interrupted 必须逐名报名;
 *  · 有界性:预算钳制 [1s, 30min],abort 后不再开新轮。
 *
 * 时钟全假(不真睡觉),每轮推进由 settleWindow 夹具自己 advance —— 判的是循环/判序,
 * 不是真实计时器。
 */
import { describe, it, expect } from 'vitest';

import {
  drainHeadlessBeforeExit,
  clampDrainBudgetMs,
  HEADLESS_DRAIN_DEFAULT_TOTAL_MS,
  HEADLESS_DRAIN_MIN_TOTAL_MS,
  HEADLESS_DRAIN_MAX_TOTAL_MS,
  type HeadlessDrainWindowResult,
} from '../src/headless-drain.js';

function makeFakeClock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    sleep: async () => {
      // 假睡眠:轮间让出不消耗假时钟(settleWindow 自己推进),保持每轮步长可控。
    },
  };
}

const WINDOW_SETTLED = (ids: string[]): HeadlessDrainWindowResult => ({
  settled: ids.length,
  unknown: [],
  gone: [],
});

describe('G-814406 headless exit drain', () => {
  it('正例:有在飞任务时确实等待,并在收敛后记 drained(退出发生在等待之后)', async () => {
    const clock = makeFakeClock();
    let running = 2;
    const settleCalls: number[] = [];
    const report = await drainHeadlessBeforeExit({
      isHeadless: true,
      hasInFlightWork: () => running > 0,
      settleWindow: async (windowMs) => {
        settleCalls.push(windowMs);
        clock.advance(windowMs);
        const settledNow = running;
        running = 0;
        return WINDOW_SETTLED(new Array(settledNow).fill('x').map((_, i) => `t${i}`));
      },
      totalBudgetMs: 10_000,
      roundMs: 2_000,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(settleCalls.length).toBeGreaterThanOrEqual(1); // 等待确实发生
    expect(report.conclusion).toBe('drained');
    expect(report.settledTotal).toBe(2);
    expect(report.unsettledTaskIds).toEqual([]);
    expect(report.waitedMs).toBeGreaterThan(0);
  });

  it('正例:在飞派生在飞 —— 谓词每轮重评,不因首轮快照空转而提前判 drained', async () => {
    const clock = makeFakeClock();
    // 第 1 轮快照空(unknown=[]),但谓词仍真(新任务在飞派生);第 2 轮才结算。
    let predicateTrueRounds = 2;
    let roundsSeen = 0;
    const report = await drainHeadlessBeforeExit({
      isHeadless: true,
      hasInFlightWork: () => predicateTrueRounds > 0,
      settleWindow: async (windowMs) => {
        clock.advance(windowMs);
        roundsSeen += 1;
        predicateTrueRounds -= 1;
        if (roundsSeen < 2) {
          return { settled: 0, unknown: ['orphan-early'], gone: [] };
        }
        return WINDOW_SETTLED(['late-child']);
      },
      totalBudgetMs: 10_000,
      roundMs: 1_000,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(report.rounds).toBe(2);
    expect(report.conclusion).toBe('drained');
  });

  it('反例:交互模式(isHeadless=false)逐字不受影响 —— 不睡、不问谓词、不调 settleWindow', async () => {
    let predicateCalls = 0;
    let settleCalls = 0;
    const report = await drainHeadlessBeforeExit({
      isHeadless: false,
      hasInFlightWork: () => {
        predicateCalls += 1;
        return true;
      },
      settleWindow: async () => {
        settleCalls += 1;
        return WINDOW_SETTLED(['x']);
      },
    });
    expect(report.conclusion).toBe('interactive-skipped');
    expect(predicateCalls).toBe(0);
    expect(settleCalls).toBe(0);
    expect(report.waitedMs).toBe(0);
    expect(report.unsettledTaskIds).toEqual([]);
  });

  it('窄触发:没有在飞工作 ⇒ idle,零轮(不得把"什么都没等"写成"等到了")', async () => {
    let settleCalls = 0;
    const report = await drainHeadlessBeforeExit({
      isHeadless: true,
      hasInFlightWork: () => false,
      settleWindow: async () => {
        settleCalls += 1;
        return WINDOW_SETTLED([]);
      },
    });
    expect(report.conclusion).toBe('idle');
    expect(report.rounds).toBe(0);
    expect(settleCalls).toBe(0);
  });

  it('预算耗尽 ⇒ timed-out 且逐名报名未结算清单(不静默、不无限)', async () => {
    const clock = makeFakeClock();
    const names = ['bg-1', 'bg-2'];
    let rounds = 0;
    const report = await drainHeadlessBeforeExit({
      isHeadless: true,
      hasInFlightWork: () => true, // 永不收敛
      settleWindow: async (windowMs) => {
        clock.advance(windowMs);
        rounds += 1;
        return { settled: 0, unknown: names, gone: [] };
      },
      listInFlightTaskIds: () => names,
      totalBudgetMs: 3_000,
      roundMs: 1_000,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(report.conclusion).toBe('timed-out');
    expect(report.rounds).toBe(3); // 1000ms×3 恰好耗尽 3000ms 预算,第四轮不得开出
    expect([...report.unsettledTaskIds]).toEqual(names);
  });

  it('abort ⇒ interrupted:进入前已中止即刻收场(不开任何轮);轮间中止不再开新轮', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    let settleCalls = 0;
    const pre = await drainHeadlessBeforeExit({
      isHeadless: true,
      signal: ctrl.signal,
      hasInFlightWork: () => true,
      settleWindow: async () => {
        settleCalls += 1;
        return WINDOW_SETTLED([]);
      },
      listInFlightTaskIds: () => ['t9'],
    });
    expect(pre.conclusion).toBe('interrupted');
    expect(pre.rounds).toBe(0);
    expect(settleCalls).toBe(0);
    expect([...pre.unsettledTaskIds]).toEqual(['t9']);

    const clock = makeFakeClock();
    const ctrl2 = new AbortController();
    const post = await drainHeadlessBeforeExit({
      isHeadless: true,
      signal: ctrl2.signal,
      hasInFlightWork: () => true,
      settleWindow: async (windowMs) => {
        clock.advance(windowMs);
        ctrl2.abort(); // 第一轮执行中到达中止
        return { settled: 0, unknown: ['late-abort'], gone: [] };
      },
      listInFlightTaskIds: () => ['late-abort'],
      totalBudgetMs: 100_000,
      roundMs: 500,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(post.conclusion).toBe('interrupted');
    expect(post.rounds).toBe(1); // 中止后不得再开第二轮
    expect([...post.unsettledTaskIds]).toEqual(['late-abort']);
  });

  it('没有名单出口时:timed-out 用 settleWindow 的 unknown 报名,绝不以空数组冒充"没有未结算"', async () => {
    const clock = makeFakeClock();
    const report = await drainHeadlessBeforeExit({
      isHeadless: true,
      hasInFlightWork: () => true,
      settleWindow: async (windowMs) => {
        clock.advance(windowMs);
        return { settled: 0, unknown: ['solo-unknown'], gone: [] };
      },
      totalBudgetMs: 1_000,
      roundMs: 1_000,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(report.conclusion).toBe('timed-out');
    expect([...report.unsettledTaskIds]).toContain('solo-unknown');
  });

  it('有界性常量与钳制:默认/下限/上限都是有限正数;坏输入不得退化成"不等直接退"或"无限等"', () => {
    expect(HEADLESS_DRAIN_DEFAULT_TOTAL_MS).toBeGreaterThan(0);
    expect(Number.isFinite(HEADLESS_DRAIN_DEFAULT_TOTAL_MS)).toBe(true);
    expect(clampDrainBudgetMs(undefined)).toBe(HEADLESS_DRAIN_DEFAULT_TOTAL_MS);
    expect(clampDrainBudgetMs(0)).toBe(HEADLESS_DRAIN_DEFAULT_TOTAL_MS); // 坏值 ⇒ 回默认(仍>0)
    expect(clampDrainBudgetMs(-5)).toBe(HEADLESS_DRAIN_DEFAULT_TOTAL_MS);
    expect(clampDrainBudgetMs(Number.NaN)).toBe(HEADLESS_DRAIN_DEFAULT_TOTAL_MS);
    expect(clampDrainBudgetMs(5)).toBe(HEADLESS_DRAIN_MIN_TOTAL_MS);
    expect(clampDrainBudgetMs(10 ** 12)).toBe(HEADLESS_DRAIN_MAX_TOTAL_MS);
    expect(HEADLESS_DRAIN_MAX_TOTAL_MS).toBeLessThanOrEqual(30 * 60_000);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
