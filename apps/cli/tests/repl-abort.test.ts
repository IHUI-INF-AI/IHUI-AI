/**
 * P2-2 REPL Abort + Drain 增强 单元测试。
 *
 * 测试范围:
 *   1. createReplSigintHandler:SIGINT handler 行为契约
 *      - agentRunning=false 维持默认行为(不 abort)
 *      - agentRunning=true 调 abortController.abort()
 *      - 双击 SIGINT 间隔 < 1s 调 onForceExit(强杀退出)
 *      - 已 aborted 的 controller 不重复调 onAbort
 *   2. createDrainInterjections:drain 机制真正从 buffer pop
 *      - 不再返回 [](P2-2 核心修复)
 *      - 多次调用第二次返回空(buffer 已清空)
 *      - 转换 Interjection 为 InterjectionBlock(text 类型)
 *   3. consumePendingInterjections:normal/low 自动消费
 *      - 所有优先级(critical/high/normal/low)都被递归消费
 *      - aborted 时停止消费
 *      - maxDepth 限制防止无限递归
 *      - 空 buffer 时不调用 sendFn
 *
 * 用 vitest + mock,不依赖真实 readline / process 信号。
 */
import { describe, expect, it, vi } from 'vitest';
import { InterjectionBuffer } from '../src/interjection.js';
import {
  createReplSigintHandler,
  createDrainInterjections,
  consumePendingInterjections,
} from '../src/commands/repl.js';
import type { ReplState } from '../src/commands/repl.js';

/** 构造最小可用 ReplState(测试 helper,避免每个用例重复完整字段) */
function makeTestState(overrides: Partial<ReplState> = {}): ReplState {
  return {
    opts: {
      modelId: 'test-model',
      workspacePath: '/tmp/test',
      apiUrl: 'http://localhost:3000',
      maxIterations: 10,
    },
    history: [],
    session: null,
    checkpoints: null,
    agentReady: false,
    systemPrompt: null,
    ctx: null,
    skills: [],
    memory: [],
    rewindStack: [],
    interjectionBuffer: new InterjectionBuffer(),
    agentRunning: false,
    aborted: false,
    abortController: null,
    ...overrides,
  };
}

describe('P2-2 createReplSigintHandler — SIGINT handler 行为契约', () => {
  it('agentRunning=false 时维持默认行为:不调 abort,不调 onForceExit,不调 onAbort', () => {
    const controller = new AbortController();
    const state = {
      agentRunning: false,
      aborted: false,
      abortController: controller,
    };
    const onForceExit = vi.fn();
    const onAbort = vi.fn();
    const handler = createReplSigintHandler(state, { onForceExit, onAbort });

    handler();

    expect(onForceExit).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();
    expect(state.aborted).toBe(false);
    expect(controller.signal.aborted).toBe(false);
  });

  it('agentRunning=true 时调 abortController.abort() + onAbort,不调 onForceExit', () => {
    const controller = new AbortController();
    const state = {
      agentRunning: true,
      aborted: false,
      abortController: controller,
    };
    const onForceExit = vi.fn();
    const onAbort = vi.fn();
    const handler = createReplSigintHandler(state, { onForceExit, onAbort });

    handler();

    expect(onForceExit).not.toHaveBeenCalled();
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(state.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  it('双击 SIGINT 间隔 < 1s 时调 onForceExit(强杀退出)', () => {
    const controller = new AbortController();
    const state = {
      agentRunning: true,
      aborted: false,
      abortController: controller,
    };
    const onForceExit = vi.fn();
    const onAbort = vi.fn();
    // 用假时钟控制时间戳
    let currentTime = 1000;
    const handler = createReplSigintHandler(state, {
      onForceExit,
      onAbort,
      now: () => currentTime,
    });

    // 第一次 SIGINT(时间 1000):触发 abort
    handler();
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onForceExit).not.toHaveBeenCalled();

    // 第二次 SIGINT(时间 1500,间隔 500ms < 1s):触发强杀
    currentTime = 1500;
    handler();
    expect(onForceExit).toHaveBeenCalledTimes(1);
  });

  it('双击 SIGINT 间隔 >= 1s 时不调 onForceExit(只触发 abort)', () => {
    const controller = new AbortController();
    const state = {
      agentRunning: true,
      aborted: false,
      abortController: controller,
    };
    const onForceExit = vi.fn();
    const onAbort = vi.fn();
    let currentTime = 1000;
    const handler = createReplSigintHandler(state, {
      onForceExit,
      onAbort,
      now: () => currentTime,
    });

    // 第一次 SIGINT(时间 1000):触发 abort
    handler();
    expect(onForceExit).not.toHaveBeenCalled();

    // 第二次 SIGINT(时间 2100,间隔 1100ms >= 1s):不触发强杀
    // 注意:此时 controller 已 aborted,不会重复调 onAbort
    currentTime = 2100;
    handler();
    expect(onForceExit).not.toHaveBeenCalled();
  });

  it('已 aborted 的 controller 不会重复调 onAbort', () => {
    const controller = new AbortController();
    const state = {
      agentRunning: true,
      aborted: false,
      abortController: controller,
    };
    const onAbort = vi.fn();
    let currentTime = 1000;
    const handler = createReplSigintHandler(state, {
      onAbort,
      now: () => currentTime,
    });

    // 第一次:触发 abort + onAbort
    handler();
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(controller.signal.aborted).toBe(true);

    // 第二次(间隔 >= 1s):controller 已 aborted,不重复调 onAbort
    currentTime = 3000;
    handler();
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('agentRunning=true 但 abortController=null 时不抛错(防御性)', () => {
    const state = {
      agentRunning: true,
      aborted: false,
      abortController: null,
    };
    const onAbort = vi.fn();
    const handler = createReplSigintHandler(state, { onAbort });

    expect(() => handler()).not.toThrow();
    expect(onAbort).not.toHaveBeenCalled();
    expect(state.aborted).toBe(false);
  });
});

describe('P2-2 createDrainInterjections — drain 机制真正从 buffer pop', () => {
  it('drain 返回 buffer 中所有 pending(不再返回 [])', () => {
    const buffer = new InterjectionBuffer();
    buffer.push('第一条', 'normal');
    buffer.push('第二条', 'high');
    buffer.push('第三条', 'low');

    const drain = createDrainInterjections(buffer);
    const blocks = drain();

    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.type === 'text')).toBe(true);
    // 内容应包含所有 pending(顺序按优先级 pop:high > normal > low)
    const texts = blocks.map((b) => (b.type === 'text' ? b.text : ''));
    expect(texts).toContain('第一条');
    expect(texts).toContain('第二条');
    expect(texts).toContain('第三条');
  });

  it('drain 后 buffer 已清空,第二次调用返回空数组', () => {
    const buffer = new InterjectionBuffer();
    buffer.push('内容 A', 'normal');

    const drain = createDrainInterjections(buffer);
    const first = drain();
    const second = drain();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(buffer.hasPending()).toBe(false);
  });

  it('drain 转换 Interjection 为 InterjectionBlock(text 类型,内容保留)', () => {
    const buffer = new InterjectionBuffer();
    buffer.push('测试内容 XYZ', 'critical');

    const drain = createDrainInterjections(buffer);
    const [block] = drain();

    expect(block).toBeDefined();
    expect(block!.type).toBe('text');
    if (block!.type === 'text') {
      expect(block!.text).toBe('测试内容 XYZ');
    }
  });

  it('空 buffer 时 drain 返回空数组(不抛错)', () => {
    const buffer = new InterjectionBuffer();
    const drain = createDrainInterjections(buffer);

    expect(drain()).toEqual([]);
    expect(drain()).toEqual([]);
  });
});

describe('P2-2 consumePendingInterjections — normal/low 自动消费', () => {
  it('所有优先级(critical/high/normal/low)都被递归消费', async () => {
    const state = makeTestState();
    state.interjectionBuffer.push('low 任务', 'low');
    state.interjectionBuffer.push('normal 任务', 'normal');
    state.interjectionBuffer.push('high 任务', 'high');
    state.interjectionBuffer.push('critical 任务', 'critical');

    const sendFn = vi.fn().mockResolvedValue(undefined);
    const onConsume = vi.fn();

    await consumePendingInterjections(state, sendFn, 0, 5, onConsume);

    // 4 条 interjection 都应被消费
    expect(sendFn).toHaveBeenCalledTimes(4);
    expect(onConsume).toHaveBeenCalledTimes(4);
    expect(state.interjectionBuffer.hasPending()).toBe(false);
  });

  it('normal/low 优先级也被消费(P2-2 核心改进,原逻辑只消费 high/critical)', async () => {
    const state = makeTestState();
    state.interjectionBuffer.push('normal 任务', 'normal');
    state.interjectionBuffer.push('low 任务', 'low');

    const sendFn = vi.fn().mockResolvedValue(undefined);

    await consumePendingInterjections(state, sendFn, 0, 5);

    // normal + low 都应被消费(原逻辑会留下它们)
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(state.interjectionBuffer.hasPending()).toBe(false);
  });

  it('aborted=true 时停止消费(不调用 sendFn)', async () => {
    const state = makeTestState({ aborted: true });
    state.interjectionBuffer.push('任务 1', 'normal');
    state.interjectionBuffer.push('任务 2', 'high');

    const sendFn = vi.fn().mockResolvedValue(undefined);

    await consumePendingInterjections(state, sendFn, 0, 5);

    // aborted 时不消费任何 interjection
    expect(sendFn).not.toHaveBeenCalled();
    expect(state.interjectionBuffer.hasPending()).toBe(true);
  });

  it('消费过程中 aborted 变 true 时停止后续消费', async () => {
    const state = makeTestState();
    state.interjectionBuffer.push('任务 1', 'normal');
    state.interjectionBuffer.push('任务 2', 'normal');
    state.interjectionBuffer.push('任务 3', 'normal');

    // 第一次调用 sendFn 后设置 aborted=true
    const sendFn = vi.fn().mockImplementation(async () => {
      state.aborted = true;
    });

    await consumePendingInterjections(state, sendFn, 0, 5);

    // 只消费第一条,后续因 aborted 停止
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('depth >= maxDepth 时不消费(maxDepth 限制防止无限递归)', async () => {
    const state = makeTestState();
    state.interjectionBuffer.push('任务 1', 'normal');

    const sendFn = vi.fn().mockResolvedValue(undefined);

    // depth=2, maxDepth=2 → depth >= maxDepth,不消费
    await consumePendingInterjections(state, sendFn, 2, 2);

    expect(sendFn).not.toHaveBeenCalled();
    expect(state.interjectionBuffer.hasPending()).toBe(true);
  });

  it('空 buffer 时不调用 sendFn', async () => {
    const state = makeTestState();
    const sendFn = vi.fn().mockResolvedValue(undefined);

    await consumePendingInterjections(state, sendFn, 0, 5);

    expect(sendFn).not.toHaveBeenCalled();
  });

  it('onConsume 回调收到正确的 priority + content', async () => {
    const state = makeTestState();
    state.interjectionBuffer.push('紧急任务', 'critical');

    const sendFn = vi.fn().mockResolvedValue(undefined);
    const onConsume = vi.fn();

    await consumePendingInterjections(state, sendFn, 0, 5, onConsume);

    expect(onConsume).toHaveBeenCalledWith('critical', '紧急任务');
  });
});
