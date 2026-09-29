// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 两张已登记票的回归(2026-09-29):
 *
 *  票A —— 无头/一次性运行退出前等待**在飞后台任务**;被 abort 时把状态落成中断,不伪装完成。
 *  票B —— 事件流的**单一写者**:"同一条事件恰好出现一次"是结构事实,不是去重结果。
 *
 * 三组用例各有分工,缺任何一组都留一个盲区:
 *  ① 判据本身(纯函数 + 构造面)—— 证明"二选一 / 挡下 / 四态可分辨"这些结论真会分叉;
 *  ② 真实注册表端到端 —— 证明等待**消费的是 background-registry 那份既有出口**,不是测试
 *     自己造的第二个机制(判据若在真机制上空转,①全绿也毫无意义);
 *  ③ 源码形状锁 —— 证明 `runAgent` 那两处接线**在位且顺序对**。这一组不可替代:
 *     ①② 只证明"函数会被正确使用",接线被摘线时它们一路报绿
 *     (本仓记过多次同型:守门 70 / 76 / 81 / 115 —— 判据失效的表现永远是安静)。
 */
import { afterEach, afterAll, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';

// 台账落点改道:background-ledger 走 getIhuiRoot() ⇒ IHUI_HOME(端内既有的测试覆盖档,优先级最高)。
// 必须在任何 registerTask 之前设好 —— 测试不得往真人的 ~/.ihui 里写状态。
const SCRATCH_HOME = mkdtempSync(join(tmpdir(), 'ihui-headless-drain-home-'));
process.env.IHUI_HOME = SCRATCH_HOME;

import { createHeadlessEventSink, perTurnSinkArgs } from '../src/headless-format.js';
import type { HeadlessEventSink } from '../src/headless-format.js';
import {
  drainInFlightBackgroundTasks,
  HEADLESS_DRAIN_LEG_MS,
  HEADLESS_DRAIN_MIN_LEG_MS,
  type HeadlessDrainFacts,
  type HeadlessDrainOutcome,
} from '../src/commands/agent.js';
import { registerTask, listTasks, waitForTask, clearAllTasks } from '../src/tools/background-registry.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const AGENT_SRC = readFileSync(join(HERE, '../src/commands/agent.ts'), 'utf8');
const FORMAT_SRC = readFileSync(join(HERE, '../src/headless-format.ts'), 'utf8');

/**
 * 形状锁必须判**代码面**。理由不是洁癖:说明性文字里逐字引用被禁的调用形态,
 * 会把那条"不得再出现"的断言永远钉红 —— 本仓在同一条坑上摔过多次
 * (一次是注释里写出执行性字符让 `node --check` 炸,一次是 JSDoc 里逐字引了 JSX
 *  让返回文字的判据把解释自己的那行判成违规)。
 * 判据刻意只剥"整行以 // 或 * 或 /* 开头"的行:真语句不会以这三种形态起头,
 * 所以它剥得准,也**剥不掉**任何违规写法。
 */
function codeFace(src: string): string {
  return src
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'));
    })
    .join('\n');
}

const AGENT_CODE = codeFace(AGENT_SRC);

afterEach(() => {
  clearAllTasks();
});

afterAll(() => {
  rmSync(SCRATCH_HOME, { recursive: true, force: true });
  delete process.env.IHUI_HOME;
});

// ==================== ① 票B:单一写者的判据 ====================

type Verdict = 'settled' | 'still-running' | 'timed-out-unknown' | 'gone';

/** 一台 sink + 它的落笔流水 + 挡下流水。两条都要 —— 只记落笔就把"挡下了什么"读不出来了。 */
function makeSink(format: 'json' | 'text' = 'json') {
  const lines: string[] = [];
  const drops: Array<{ type: string; reason: string; droppedCount: number }> = [];
  const sink: HeadlessEventSink = createHeadlessEventSink({
    write: (line) => lines.push(line),
    format,
    onDrop: ({ event, reason, droppedCount }) => {
      drops.push({ type: event.type, reason, droppedCount });
    },
  });
  return { sink, lines, drops };
}

const delta = (text: string) => ({ type: 'message_delta', text }) as const;
const completeEvent = {
  type: 'complete',
  stopReason: 'end_turn',
  iterations: 1,
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 },
} as const;

describe('票B createHeadlessEventSink:写入权与终止符', () => {
  it('二选一:没人持有写入权时 per-turn 一侧拿到它,并原样返回那组回调', () => {
    const { sink } = makeSink();
    const args = { onDelta: () => {} };
    expect(perTurnSinkArgs(sink, args)).toBe(args);
    expect(sink.claimedBy).toBe('per-turn-callbacks');
  });

  it('二选一:常驻订阅先 claim 之后,per-turn 一侧必须拿到空对象(一个回调都不装)', () => {
    const { sink } = makeSink();
    expect(sink.claim('resident-subscription')).toBe(true);
    // 关键不是"返回了个东西",而是**什么都没带过去** —— 带着回调返回就等于两条都装,
    // 于是"重复行"又回到只能靠去重兜,而那正是本票要换掉的形状。
    expect(Object.keys(perTurnSinkArgs(sink, { onDelta: () => {} }))).toEqual([]);
    expect(sink.claimedBy).toBe('resident-subscription');
  });

  it('同一来源重复 claim 幂等,另一路永远拿不到', () => {
    const { sink } = makeSink();
    expect(sink.claim('per-turn-callbacks')).toBe(true);
    expect(sink.claim('per-turn-callbacks')).toBe(true);
    expect(sink.claim('resident-subscription')).toBe(false);
  });

  it('恰好一次:一个写者时 N 条事件落 N 行,不多不少', () => {
    const { sink, lines } = makeSink();
    perTurnSinkArgs(sink, { onDelta: () => {} });
    for (let i = 0; i < 5; i += 1) sink.emit(delta(`d${i}`));
    expect(lines).toHaveLength(5);
    expect(new Set(lines).size).toBe(5);
    expect(sink.writtenCount).toBe(5);
  });

  it('停订阅之后的 emit 不落笔、按 detached 交代,绝不静默', () => {
    const { sink, lines, drops } = makeSink();
    sink.detach();
    sink.emit(delta('late'));
    expect(lines).toEqual([]);
    expect(drops).toEqual([{ type: 'message_delta', reason: 'detached', droppedCount: 1 }]);
    expect(sink.droppedCount).toBe(1);
  });

  it('结果行是终止符:落过之后的任何事件按 after-terminal 挡下', () => {
    const { sink, lines, drops } = makeSink();
    sink.detach();
    sink.emitTerminal(completeEvent);
    sink.emit(delta('after the terminator'));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).type).toBe('complete');
    expect(drops).toEqual([{ type: 'message_delta', reason: 'after-terminal', droppedCount: 1 }]);
  });

  it('一条流只有一个终止符:第二条 complete 被挡下,不覆盖第一次落笔', () => {
    const { sink, lines, drops } = makeSink();
    sink.emitTerminal(completeEvent);
    sink.emitTerminal(completeEvent);
    expect(lines).toHaveLength(1);
    expect(drops).toEqual([{ type: 'complete', reason: 'after-terminal', droppedCount: 1 }]);
  });

  it('停订阅或落过终止符之后都不再接受 claim(迟到的订阅者装不上写者)', () => {
    const a = makeSink();
    a.sink.detach();
    expect(a.sink.claim('resident-subscription')).toBe(false);
    const b = makeSink();
    b.sink.emitTerminal(completeEvent);
    expect(b.sink.claim('resident-subscription')).toBe(false);
    expect(b.sink.claim('per-turn-callbacks')).toBe(false);
  });

  it('text 模式与迁移前 `if (line)` 同形:空序列化不落笔也不计数,但终止符照样关闭这条流', () => {
    const { sink, lines } = makeSink('text');
    sink.emit(delta('x'));
    expect(lines).toEqual([]);
    expect(sink.writtenCount).toBe(0);
    sink.emitTerminal(completeEvent);
    expect(sink.terminalWritten).toBe(true);
    sink.emit(delta('y'));
    expect(sink.droppedCount).toBe(1);
  });
});

// ==================== ① 票A:排水判据 ====================

interface FakeTask {
  id: string;
  status: string;
}

/**
 * 造一把可编程的尺子:每轮清单由外部数组喂(索引按枚举次数走),
 * waitForTask 的结论按每个 id 的脚本给。
 */
function makeFacts(input: {
  snapshots: FakeTask[][];
  verdicts?: Record<string, Verdict[]>;
  legMsSeen?: number[];
}) {
  const verdicts = input.verdicts ?? {};
  const calls: Array<{ id: string; timeoutMs: number }> = [];
  let round = 0;
  const facts: HeadlessDrainFacts = {
    listTasks(): FakeTask[] {
      const at = input.snapshots[Math.min(round, input.snapshots.length - 1)]!;
      round += 1;
      return at;
    },
    async waitForTask(id: string, timeoutMs: number): Promise<{ state: Verdict }> {
      calls.push({ id, timeoutMs });
      input.legMsSeen?.push(timeoutMs);
      const queue = verdicts[id] ?? (['settled'] as Verdict[]);
      const state = queue.length > 1 ? queue.shift() : queue[0];
      return { state: state ?? 'settled' };
    },
  };
  return { facts, calls };
}

/** 只在 interrupted 档上取字段:union 不做断言式收窄,直接点会不类型安全。 */
function expectInterrupted(out: HeadlessDrainOutcome) {
  if (out.kind !== 'interrupted') {
    throw new Error(`期望 interrupted,实得 ${out.kind}`);
  }
  return out;
}

const FAST_LEG = 10;

describe('票A drainInFlightBackgroundTasks:等完在飞任务或等被取消', () => {
  it('没有 running 任务 ⇒ drained 且一次都不等待(窄触发:无后台任务的运行零差异)', async () => {
    const { facts, calls } = makeFacts({ snapshots: [[{ id: 'a', status: 'exited' }]] });
    const out = await drainInFlightBackgroundTasks({ facts });
    expect(out).toEqual({ kind: 'drained', settledCount: 0, legCount: 0 });
    expect(calls).toEqual([]);
  });

  it('空清单同样零等待', async () => {
    const { facts } = makeFacts({ snapshots: [[]] });
    expect(await drainInFlightBackgroundTasks({ facts })).toEqual({
      kind: 'drained',
      settledCount: 0,
      legCount: 0,
    });
  });

  it('先 timed-out-unknown 后 settled ⇒ 等到才算数', async () => {
    const { facts } = makeFacts({
      // 第一轮腿超时(清单里它还在跑),第二轮腿拿到终态 ⇒ 两腿都记进 legCount。
      snapshots: [
        [{ id: 'a', status: 'running' }],
        [{ id: 'a', status: 'running' }],
        [{ id: 'a', status: 'exited' }],
      ],
      verdicts: { a: ['timed-out-unknown', 'settled'] },
    });
    const out = await drainInFlightBackgroundTasks({ facts, legMs: FAST_LEG });
    expect(out.kind).toBe('drained');
    expect(out.settledCount).toBe(1);
    expect(out.legCount).toBe(2);
  });

  it('超时不等于结论:全程 timed-out-unknown 时 settledCount 必须停在 0', async () => {
    const ac = new AbortController();
    const { facts } = makeFacts({
      snapshots: [[{ id: 'a', status: 'running' }]],
      verdicts: { a: ['timed-out-unknown'] },
    });
    // 第二条腿之后取消:证明"没等到"从来没被写成"结束了"。
    let leg = 0;
    const wrapped: HeadlessDrainFacts = {
      listTasks: () => facts.listTasks(),
      waitForTask: async (id, timeoutMs) => {
        leg += 1;
        if (leg >= 2) ac.abort();
        return facts.waitForTask(id, timeoutMs);
      },
    };
    const out = expectInterrupted(
      await drainInFlightBackgroundTasks({ facts: wrapped, signal: ac.signal, legMs: FAST_LEG }),
    );
    expect(out.settledCount).toBe(0);
    expect(out.unsettledTaskIds).toEqual(['a']);
    expect(out.abortedBeforeFirstWait).toBe(false);
  });

  it('信号在第一条腿之前就已 abort ⇒ interrupted 且如实标 abortedBeforeFirstWait', async () => {
    const ac = new AbortController();
    ac.abort();
    const { facts, calls } = makeFacts({ snapshots: [[{ id: 'a', status: 'running' }]] });
    const out = expectInterrupted(
      await drainInFlightBackgroundTasks({ facts, signal: ac.signal, legMs: FAST_LEG }),
    );
    expect(out.abortedBeforeFirstWait).toBe(true);
    expect(out.unsettledTaskIds).toEqual(['a']);
    expect(calls).toEqual([]);
  });

  it('gone 也算不再欠等待(任务记录没了 ⇒ 无人能为它负责,但不能挂着不放)', async () => {
    const { facts } = makeFacts({
      snapshots: [[{ id: 'a', status: 'running' }], []],
      verdicts: { a: ['gone'] },
    });
    const out = await drainInFlightBackgroundTasks({ facts, legMs: FAST_LEG });
    expect(out).toEqual({ kind: 'drained', settledCount: 1, legCount: 1 });
  });

  it('每轮重新枚举:在飞任务派生的新任务也要被等到(只等进门那一批会漏)', async () => {
    const { facts, calls } = makeFacts({
      snapshots: [
        [{ id: 'a', status: 'running' }],
        [
          { id: 'a', status: 'exited' },
          { id: 'b', status: 'running' },
        ],
        [
          { id: 'a', status: 'exited' },
          { id: 'b', status: 'exited' },
        ],
      ],
      verdicts: { a: ['settled'], b: ['settled'] },
    });
    const out = await drainInFlightBackgroundTasks({ facts, legMs: FAST_LEG });
    expect(out).toEqual({ kind: 'drained', settledCount: 2, legCount: 2 });
    expect(calls.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('legMs<=0 不得把等待变成热自旋:实参被抬到下限(0 档会让 waitForTask 走非阻塞探询)', async () => {
    const legMsSeen: number[] = [];
    const { facts } = makeFacts({
      snapshots: [[{ id: 'a', status: 'running' }], [{ id: 'a', status: 'exited' }]],
      verdicts: { a: ['timed-out-unknown', 'settled'] },
      legMsSeen,
    });
    await drainInFlightBackgroundTasks({ facts, legMs: 0 });
    expect(legMsSeen.length).toBeGreaterThan(0);
    for (const ms of legMsSeen) expect(ms).toBeGreaterThanOrEqual(HEADLESS_DRAIN_MIN_LEG_MS);
  });

  it('缺省腿长走常量(而不是 Infinity/0 那两种把取消吞掉的写法)', async () => {
    const legMsSeen: number[] = [];
    const { facts } = makeFacts({
      snapshots: [[{ id: 'a', status: 'running' }], [{ id: 'a', status: 'exited' }]],
      verdicts: { a: ['timed-out-unknown', 'settled'] },
      legMsSeen,
    });
    await drainInFlightBackgroundTasks({ facts });
    expect(legMsSeen.every((ms) => ms === HEADLESS_DRAIN_LEG_MS)).toBe(true);
    expect(HEADLESS_DRAIN_LEG_MS).toBeGreaterThan(HEADLESS_DRAIN_MIN_LEG_MS);
  });
});

// ==================== ② 真实注册表端到端 ====================

/**
 * 假子进程:注册表只用到 stdout / stderr / on / pid / kill,不必真派生进程 ——
 * 端到端要证的是**等待机制归属**(等的是注册表那张表),不是进程能不能起。
 */
function makeFakeChild(): { child: ChildProcess; emitter: EventEmitter; stdout: PassThrough } {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const child = Object.assign(emitter, {
    pid: 424242,
    stdout,
    stderr: new PassThrough(),
    kill: () => true,
  }) as unknown as ChildProcess;
  return { child, emitter, stdout };
}

function taskStatusOf(id: string): string | undefined {
  return listTasks().find((t) => t.id === id)?.status;
}

describe('票A 与真实 background-registry 的端到端', () => {
  it('close 未到绝不返回,close 一到就 drained(等的是注册表那份出口)', async () => {
    const { child, emitter, stdout } = makeFakeChild();
    const id = registerTask(child, 'fake: node -e 1');
    expect(listTasks().some((t) => t.id === id && t.status === 'running')).toBe(true);

    let returned = false;
    const pending = drainInFlightBackgroundTasks({
      facts: { listTasks, waitForTask },
      legMs: 20,
    }).then((r) => {
      returned = true;
      return r;
    });

    await new Promise((r) => setTimeout(r, 60));
    // 本票的全部价值在这一行:任务还在跑时排水**没有**返回。
    // 少了这条断言,一个"看一眼就返回 drained"的实现能把 ① 全组判据同时跑绿。
    expect(returned).toBe(false);

    stdout.write('done\n');
    emitter.emit('close', 0, null);
    const out = await pending;
    expect(out.kind).toBe('drained');
    expect(out.settledCount).toBeGreaterThanOrEqual(1);
    expect(taskStatusOf(id)).toBe('exited');
  });

  it('没结束就被取消 ⇒ interrupted,并把被丢下的任务报名(不伪装完成)', async () => {
    const { child } = makeFakeChild();
    const id = registerTask(child, 'fake: never closes');
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 40);
    const out = expectInterrupted(
      await drainInFlightBackgroundTasks({
        facts: { listTasks, waitForTask },
        signal: ac.signal,
        legMs: 20,
      }),
    );
    expect(out.unsettledTaskIds).toContain(id);
    expect(out.settledCount).toBe(0);
    expect(taskStatusOf(id)).toBe('running');
  });
});

// ==================== ③ 接线形状锁 ====================

/** 从 `perTurnSinkArgs<…>(sink, { … })` 起,括号配平地取出那个对象字面量(含起止偏移)。 */
function locatePerTurnLiteral(src: string): { start: number; end: number; text: string } {
  const marker = src.indexOf('perTurnSinkArgs<');
  if (marker === -1) throw new Error('runAgent 里没有 perTurnSinkArgs 接线(该组回调已被摘线)');
  const open = src.indexOf('{', src.indexOf('sink,', marker));
  if (open === -1) throw new Error('perTurnSinkArgs 的第二实参不是对象字面量');
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start: open, end: i + 1, text: src.slice(open, i + 1) };
    }
  }
  throw new Error('perTurnSinkArgs 的对象字面量没有闭合');
}

/** 括号配平地取出 `await runToolLoop({ … })` 的那个选项对象字面量。 */
function locateRunToolLoopLiteral(src: string): { start: number; end: number; text: string } {
  const marker = 'await runToolLoop({';
  const at = src.indexOf(marker);
  if (at === -1) throw new Error('找不到 runToolLoop 调用点');
  const open = at + marker.length - 1;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start: open, end: i + 1, text: src.slice(open, i + 1) };
    }
  }
  throw new Error('runToolLoop 的选项字面量没有闭合');
}

const PER_TURN_KEYS = [
  'onDelta',
  'onToolCall',
  'onToolDeltaFrames',
  'onToolResult',
  'onIteration',
  'onError',
] as const;

describe('接线形状锁:runAgent 真的按这两张票的规矩接', () => {
  const detachIdx = AGENT_CODE.indexOf('sink.detach();');
  const terminalIdx = AGENT_CODE.indexOf('sink.emitTerminal(');
  const drainIdx = AGENT_CODE.indexOf('await drainInFlightBackgroundTasks(');

  it('六条回合回调全部经 perTurnSinkArgs 装,一条都不落在 runToolLoop 选项的顶层', () => {
    const perTurn = locatePerTurnLiteral(AGENT_CODE);
    for (const key of PER_TURN_KEYS) {
      expect(perTurn.text, `per-turn 字面量里缺 ${key}`).toContain(`${key}:`);
    }
    // 顶层那一份必须不存在:同一组回调装两处 = 一条事件两行(本票判的就是这一型)。
    // 判据按"wrapper 之外的那一段选项文本"算,而不是按缩进 —— 写死列位会因为一次
    // 格式化就把锁判成"变异未生效"(本仓另一条反例已经踩过这种脆弱)。
    const loop = locateRunToolLoopLiteral(AGENT_CODE);
    const relStart = perTurn.start - loop.start;
    const outside = loop.text.slice(0, relStart) + loop.text.slice(perTurn.end - loop.start);
    for (const key of PER_TURN_KEYS) {
      expect(outside, `${key} 还留在 runToolLoop 选项顶层 = 两条都在装`).not.toContain(`${key}:`);
    }
  });

  it('顺序是"排水 → 停订阅 → 结果行",三段都不许换位', () => {
    expect(detachIdx).toBeGreaterThan(-1);
    expect(terminalIdx).toBeGreaterThan(-1);
    expect(drainIdx).toBeGreaterThan(-1);
    expect(drainIdx).toBeLessThan(detachIdx);
    expect(detachIdx).toBeLessThan(terminalIdx);
  });

  it('结果行只能由 emitTerminal 落;complete 不得再从 emit 走一条(那会绕过终止符语义)', () => {
    expect(AGENT_CODE).toMatch(/emitTerminal\(\{\s*type:\s*'complete'/);
    expect(AGENT_CODE).not.toMatch(/emit\(\{\s*type:\s*'complete'/);
  });

  it('mermaid 那一格(循环之后唯一还会写事件的后处理)必须在停订阅之前', () => {
    const mermaidEmitIdx = AGENT_CODE.indexOf("emit({ type: 'tool_result', name: 'mermaid_render'");
    expect(mermaidEmitIdx).toBeGreaterThan(-1);
    expect(mermaidEmitIdx).toBeLessThan(detachIdx);
  });

  it('异常路径也停订阅(finally 里那一次),否则收尾代码还能往终止符后面插行', () => {
    expect(AGENT_CODE.split('sink.detach();').length - 1).toBe(2);
  });

  it('agent.ts 不再自己序列化:所有落笔都经 sink(第二支笔就是第二份真相)', () => {
    expect(AGENT_CODE).not.toMatch(/formatHeadlessEvent\s*\(/);
    expect(FORMAT_SRC).toMatch(/export function formatHeadlessEvent/);
    expect(FORMAT_SRC).toMatch(/export function createHeadlessEventSink/);
  });

  it('被中断落成 cancelled(既有档名:退 130 且 finally 仍落 session ⇒ 可 --resume),不新增状态词汇', () => {
    expect(AGENT_CODE).toMatch(/drain\.kind === 'interrupted'\s*\?\s*'cancelled'/);
    // 人读面:排水被取消时**整块终态行不许出现**(那句绿色 ✨ 在这一支是假的),
    // 而中断的文案由 index.ts 的 SIGINT 处理点负责 —— 这里再打一行就是同一句出现两次,
    // 所以既不许多打,也不许多造一条新的硬编码中文(§19 要五语言同批,守门 70 也顶不住)。
    expect(AGENT_CODE).toMatch(/if \(drain\.kind !== 'interrupted'\) \{/);
    expect(AGENT_CODE).not.toContain("t('cliEntry.interruptSaving')");
    // 被丢下的任务必须**报名**,不得只留一句"失败了"。
    expect(AGENT_CODE).toMatch(/process\.stderr\.write\(\s*\n?\s*`?\[ihui\] headless drain aborted/);
  });

  it('排水消费的是注册表那份既有出口,而且没有 env 逃生口 / 没有总超时', () => {
    expect(AGENT_CODE).toMatch(/listTasks as listBackgroundTasks/);
    expect(AGENT_CODE).toMatch(/waitForTask as waitForBackgroundTask/);
    expect(AGENT_CODE).toContain(
      'facts: { listTasks: listBackgroundTasks, waitForTask: waitForBackgroundTask }',
    );
    // agent.ts 通篇不读环境变量 ⇒ 排水不可能藏着"IHUI_HEADLESS_DRAIN_TIMEOUT"这类后门。
    expect(AGENT_CODE).not.toMatch(/process\.env/);
    expect(AGENT_CODE).not.toMatch(/totalTimeout|deadlineMs|MAX_MS/);
  });

  it('反向对照:形状锁判的是代码面,注释里引用被禁形态不得把它钉红', () => {
    // 这一条防的是"锁对着一句解释自己的话变红":去掉行首注释之后,
    // 同一份源码里那句描述旧写法的散文不再参与判据。
    const withDocComment = `// 原先挂在 emit({type:'complete'}) 之后\n${AGENT_CODE}`;
    expect(codeFace(withDocComment)).not.toMatch(/emit\(\{\s*type:\s*'complete'/);
    expect(withDocComment).toMatch(/emit\(\{type:'complete'\}/);
  });
});
