// 流式期工具登记账本 × runToolLoop 的**装车证明**。
//
// 本仓最高频的事故类型是"造好没装车"(纯函数单测全绿而主循环一次都没调过它),
// 所以这里判的是调用关系而不是账本单元:
//   - 断流 / 在途断流 / abort / supersede 四条退出路径都必须把快照交出去
//     ("执行过但账本无记录"是被钉死的失败形态);
//   - 提前执行与主路径执行合起来只跑一次(经 runOnce 复用同一 promise);
//   - late 登记按 register() 现行实际行为断言:带 run 大声抛,裸登记显式记 lost;
//   - **反向对照**(写在账本面上,不依赖 runToolLoop):不经 ledger.register 的
//     真实执行,账本上永远看不见 —— 若有人摘掉接线,用例 1-5 的快照全变 0 而
//     本条保持绿,证明那些断言测的是接线、不是恒真。

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type StreamChatOpts = {
  onDelta: (delta: string) => void;
  onError?: (err: string, info?: unknown) => void;
  onToolCall?: (event: {
    type: string;
    toolCallId: string;
    toolName: string;
    args?: Record<string, unknown>;
  }) => void;
};

const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn() }));

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
}));

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

import { runToolLoop } from '../src/commands/agent.js';
import type { ChatMessage } from '../src/context.js';
import { StreamToolLedger, type LedgerEntry, type LedgerSnapshot } from '../src/stream-tool-ledger.js';
import { registerTools, clearTools, executeToolCall, disableToolHub, type Tool } from '../src/tools/index.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const FIXTURE_ROOT = path.join(REPO_ROOT, '.ihui-agent', 'tmp');

const TOOL_NAME = 'ledger_wire_probe';
/** 原生 tool-call 事件与提前执行共用同一条"调用意图",指纹必须一致 */
const CALL_ARGS = { path: 'a.txt' };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function startEvent(
  toolCallId = 'call-1',
): Parameters<NonNullable<StreamChatOpts['onToolCall']>>[0] {
  return { type: 'tool-call-start', toolCallId, toolName: TOOL_NAME, args: { ...CALL_ARGS } };
}

/** 账本单元面用的小工厂:与 agent.ts 接线相同的准入语义(该工具允许提前跑) */
function makeLedger(overrides?: Partial<ConstructorParameters<typeof StreamToolLedger>[0]>) {
  return new StreamToolLedger({
    turn: 1,
    streamId: 'wire-unit-ledger',
    mayRunEarly: (name) => name === TOOL_NAME,
    ...overrides,
  });
}

describe('流式账本接线装车(runToolLoop 真的在登记/收尾/交账)', () => {
  let workspace = '';
  let execCount = 0;

  function probeTool(pending = false): Tool {
    return {
      name: TOOL_NAME,
      description: 'wiring probe',
      parameters: { path: { type: 'string', description: 'p' } },
      required: ['path'],
      dangerLevel: 'read',
      execute: async () => {
        execCount += 1;
        // 在途形态:永不 resolve —— 模拟请求已发出、结果没回来时流就断了
        if (pending) await new Promise<void>(() => {});
        return { success: true, output: 'X' };
      },
    } as Tool;
  }

  beforeEach(() => {
    // 闸必须显式关:disableToolHub() 不会自动发生,别让它以"凑巧没人开过"的形态通过
    disableToolHub();
    clearTools();
    streamChatMock.mockReset();
    execCount = 0;
    fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
    workspace = fs.mkdtempSync(path.join(FIXTURE_ROOT, 'ledger-wire-'));
    registerTools([probeTool()]);
  });

  afterEach(() => {
    clearTools();
    if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
  });

  function runLoop(extra?: { maxIterations?: number }) {
    const snapshots: LedgerSnapshot[] = [];
    const promise = runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'go' } as ChatMessage],
      ctx: { workspacePath: workspace },
      sessionId: 'ledger-wire',
      maxIterations: extra?.maxIterations ?? 3,
      onToolLedgerSnapshot: (s) => snapshots.push(s),
    });
    return { promise, snapshots };
  }

  it('断流 onError:流中已提前落地的执行必须随快照交出去,恢复端能分类成"已落地"', async () => {
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      o.onToolCall?.(startEvent());
      await tick(); // 让提前执行真正起跑并落地
      o.onError?.('connection reset mid-stream');
    });
    const { promise, snapshots } = runLoop();
    const result = await promise;

    expect(result.stopReason).toBe('error');
    expect(execCount).toBe(1); // 断流前就跑了(提前执行生效)
    expect(snapshots).toHaveLength(1); // 但账本没有随之丢失
    const entry = snapshots[0]!.entries.find((e) => e.toolName === TOOL_NAME);
    expect(entry).toBeDefined();
    expect(entry!.state).toBe('settled');
    expect(entry!.early).toBe(true);
    expect(entry!.ok).toBe(true);

    // 对账分类:恢复轮没有再登记它 → 归入"已落地",不会被误判成"从未发起"
    const report = StreamToolLedger.reconcile(snapshots[0]!, []);
    expect(report.settled.map((a) => a.fingerprint)).toContain(entry!.anchor.fingerprint);
    expect(report.unknownEffect).toHaveLength(0);
  });

  it('在途断流:提前执行未落地 ⇒ started ⇒ reconcile 判 unknownEffect(不谎报没跑过)', async () => {
    registerTools([probeTool(true)]);
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      o.onToolCall?.(startEvent());
      await tick();
      o.onError?.('connection dropped while a call was in flight');
    });
    const { promise, snapshots } = runLoop();
    await promise;

    expect(execCount).toBe(1);
    expect(snapshots).toHaveLength(1);
    const entry = snapshots[0]!.entries.find((e) => e.toolName === TOOL_NAME)!;
    expect(entry.state).toBe('started');
    const report = StreamToolLedger.reconcile(snapshots[0]!, []);
    expect(report.unknownEffect.map((a) => a.fingerprint)).toContain(entry.anchor.fingerprint);
    expect(report.settled).toHaveLength(0);
  });

  it('abort(流中抛错并带部分输出):同样交账,且不把该工具再跑第二遍', async () => {
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      o.onToolCall?.(startEvent());
      o.onDelta('部分输出');
      await tick();
      throw new Error('aborted by user');
    });
    const { promise, snapshots } = runLoop();
    const result = await promise;

    expect(result.stopReason).toBe('error');
    expect(execCount).toBe(1); // 只有提前执行那一次,没有重试第二遍
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.entries.some((e) => e.toolName === TOOL_NAME)).toBe(true);
  });

  it('主路径复用:登记+提前执行后正常走完流,同一调用全程只执行一次', async () => {
    let turn = 0;
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      turn += 1;
      if (turn === 1) {
        o.onToolCall?.(startEvent());
        await tick();
        return;
      }
      o.onDelta('完成。');
    });
    const { promise, snapshots } = runLoop();
    const result = await promise;

    expect(result.stopReason).toBe('end_turn');
    expect(execCount).toBe(1); // 流式期一次;主路径经 runOnce 复用,没有第二次
    const first = snapshots.find((s) => s.entries.some((e) => e.toolName === TOOL_NAME));
    expect(first).toBeDefined();
    const entry = first!.entries.find((e) => e.toolName === TOOL_NAME)!;
    expect(entry.state).toBe('settled');
    expect(entry.early).toBe(true);
    expect(entry.ok).toBe(true);
  });

  it('supersede 交账:provider 拒绝原生 tools 降级重读前,旧册先收尾并交出快照', async () => {
    let turn = 0;
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      turn += 1;
      if (turn === 1) {
        o.onToolCall?.(startEvent());
        await tick(); // 提前执行已落地,紧接着这条流被"不支持 tools"拒掉
        o.onError?.('The provider does not support tools');
        return;
      }
      o.onDelta('完成。'); // 降级后的 prompt 模式重读:不再发原生事件
    });
    const { promise, snapshots } = runLoop();
    const result = await promise;

    expect(result.stopReason).toBe('end_turn');
    expect(execCount).toBe(1);
    // 换册前交账:旧册的落地记录出现在快照里,降级一趟不会把它们变成"执行过但无记录"
    expect(snapshots).toHaveLength(1);
    const entry = snapshots[0]!.entries.find((e) => e.toolName === TOOL_NAME)!;
    expect(entry.state).toBe('settled');
    expect(entry.early).toBe(true);
  });

  it('late 登记(收尾之后)带 run:必须抛响且不入册 —— 不静默、也不悄悄执行', () => {
    const ledger = makeLedger();
    ledger.register({ toolName: TOOL_NAME, args: { path: 'in-stream' } });
    ledger.markEndOfStream();

    // 带执行意图的迟到登记 = 协议不该发生的时序。静默不跑会造出假对账,必须炸;
    // 炸之前不得入册(否则留下一条永远走不完的 lifecycle)。
    const run = vi.fn(async () => 'never');
    expect(() =>
      ledger.register({ toolName: TOOL_NAME, args: { path: 'late-with-run' } }, run),
    ).toThrow(/refusing to register/);
    expect(run).not.toHaveBeenCalled();
    expect(ledger.size).toBe(1);
    expect(ledger.entries().some((e) => e.args.path === 'late-with-run')).toBe(false);
  });

  it('late 裸登记(收尾之后、不带 run):直接丢弃 —— 不入册也不进快照', () => {
    const ledger = makeLedger();
    ledger.register({ toolName: TOOL_NAME, args: { path: 'in-stream' } });
    ledger.markEndOfStream();
    // 现行 register 的口径:账本只记还有完整生命周期可观测的调用;迟到的裸登记
    // 既没执行机会也没对账价值,伪造一条 lost 反而毁掉"对账要能对上"的初衷。
    ledger.register({ toolName: TOOL_NAME, args: { path: 'late-no-run' } });
    expect(ledger.size).toBe(1);
    const snap = ledger.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries.some((e) => e.skipReason === 'registered after end-of-stream')).toBe(false);
  });

  it('runOnce 幂等锚在 dedupeKey 而不是对象引用:共享键的两个条目对象只跑一次', async () => {
    const ledger = makeLedger();
    const entry = ledger.register({ toolName: 'other_write', args: { path: 'x' } });
    const twin: LedgerEntry = { ...entry }; // 第二个条目对象,dedupeKey 完全相同
    expect(twin.dedupeKey).toBe(entry.dedupeKey);
    let runs = 0;
    const first = await ledger.runOnce(entry, async () => {
      runs += 1;
      return 'v';
    });
    const second = await ledger.runOnce(twin, async () => {
      runs += 1;
      return 'v2';
    });
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true); // 复用同一个在途 promise,没有第二次副作用
    expect(second.value).toBe('v');
    expect(runs).toBe(1);
    expect(entry.state).toBe('settled');
  });

  it('同 toolCallId 不同指纹:不得被幂等回放吞掉(那是第二个真实调用)', () => {
    const ledger = makeLedger();
    const first = ledger.register({ toolCallId: 'clash', toolName: TOOL_NAME, args: { path: 'a' } });
    const second = ledger.register({ toolCallId: 'clash', toolName: TOOL_NAME, args: { path: 'b' } });
    expect(second).not.toBe(first);
    expect(ledger.size).toBe(2);
    // 真正的幂等回放仍成立:同 id 且同指纹拿回同一条,不多造
    const replay = ledger.register({ toolCallId: 'clash', toolName: TOOL_NAME, args: { path: 'a' } });
    expect(replay).toBe(first);
    expect(ledger.size).toBe(2);
  });

  it('反向对照(测试的牙):不经 register 的真实执行在账本上完全隐形', async () => {
    // 模拟"账本未接线"的路径(正则 prompt 模式,或有人把接线摘掉):
    // 工具真跑了,但账本对它一无所知。
    // 用独立工具名:模块级限流按工具名计次(10s/5 次),复用主探针名会被
    // 前面用例的执行次数误伤 —— 那会把"真执行"测成"没执行"。
    const DIRECT_NAME = 'ledger_wire_direct';
    registerTools([
      {
        name: DIRECT_NAME,
        description: 'unmanaged direct probe',
        parameters: { path: { type: 'string', description: 'p' } },
        required: ['path'],
        dangerLevel: 'read',
        execute: async () => {
          execCount += 1;
          return { success: true, output: 'X' };
        },
      } as Tool,
    ]);
    const ledger = makeLedger();
    const res = await executeToolCall(
      { name: DIRECT_NAME, arguments: { ...CALL_ARGS } },
      { workspacePath: workspace },
    );
    expect(res.success).toBe(true);
    expect(execCount).toBe(1); // 确实执行了
    expect(ledger.size).toBe(0); // ……但没有任何账本记录
    expect(ledger.markEndOfStream()).toHaveLength(0);
    const report = StreamToolLedger.reconcile(ledger.snapshot(), []);
    expect(report.settled).toHaveLength(0);
    expect(report.unknownEffect).toHaveLength(0);
    expect(report.replayed).toHaveLength(0);
    // ⇒ "执行过 ⇒ 账本必有记录"这条断言在不接线的路径上测不到;
    //   用例 1-5 测得到,靠的是 agent.ts 里那几处 ledger.register 接线。
  });
});
