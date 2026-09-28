// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D113「工具流中 diff 预览」三面接线(ACP / server agent-core / headless)的尺子。
 *
 * 派生算法本身不在这里判(它只有 `src/tools/file-edit-preview.ts` 一份实现,
 * 由 file-edit-preview-parity.test.ts 与服务端逐字对账),这里判的是**接线**:
 *
 *  A. agent-core 面 —— **行为级**:用假 runToolLoop 驱动 `AgentCore.sendMessage`,
 *     问只有跑起来才答得出的三件事:帧是否逐条发出且 seq 原样、终态是否**先清预览
 *     再落结果**、流中断是否把仍在场的预览全部作废(而不是留在消费方账上被读成结果)。
 *  B. ACP 面 —— **行为级**:planAcpPreviewUpdate 的三条"不发帧"闸门(空卡 id / 0 帧 /
 *     卡已落终态)与 emitAcpToolDeltaPreview 的"非终态"形态(status 恒 in_progress、
 *     content 带可辨认前缀、toolCallId 与卡片同一个 ⇒ 终态 update 覆盖它即清)。
 *  C. headless 面 —— **行为级**序列化:新事件必须是**单行 JSON**,text/markdown 模式
 *     刻意不出预览(没有撤回通道);另加一条"payload 字段名沿用 ToolDeltaEvent"。
 *  D. 三面共用的**装车锁**:每一道"必须出现 X"都配一个构造反例(把 X 删掉/换掉),
 *     证明该锁对修复前的源码必红 —— 只写正向断言的锁等于没有锁
 *     (§22c"镜像测试只复读实现就是复读机"、守门 70/76/81/115 同一课)。
 *  E. 单一源锁:三面都不得自己派生预览(buildFileEditPreviewEvents / 自拼
 *     JSON.stringify(args) 当 partialText 一律判红),派生只在 runToolLoop 那一处。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  buildFileEditPreviewEvents,
  createToolDeltaPreviewStore,
} from '../src/tools/file-edit-preview.js';
import type { ToolDeltaEvent } from '@ihui/api-client';
import type { AgentEventHandler } from '../src/server/agent-core.js';
import type { AgentContext } from '@agentclientprotocol/sdk';
import {
  formatHeadlessEvent,
  eventToMarkdown,
  type HeadlessEvent,
} from '../src/headless-format.js';

const SRC = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

/** 一条两行的假"将要写入的内容":走唯一出口派生,不手写帧 */
function previewFramesFor(toolName = 'write_file', id = 'cli-preview-fixed'): ToolDeltaEvent[] {
  return buildFileEditPreviewEvents(id, toolName, {
    path: 'a.txt',
    content: 'line-1\nline-2\n',
  });
}

// ==================== 假件(三面共用;真实现只替换 IO 那一层) ====================

vi.mock('@ihui/api-client', () => ({
  streamChat: vi.fn(),
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  fetchApi: vi.fn(),
  getToken: vi.fn(async () => null),
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
}));

// 会话层换内存假件:本测试不得往 ~/.ihui 写任何东西(§15 工作区卫生)。
// 用 importOriginal 铺底:acp/server.ts 还 import 了 repair/rewind 一族,
// 只列 4 个键会让"没列的那些"在 link 时抛 No export defined(门为假件而红,不是为判据而红)。
vi.mock('../src/commands/session.js', async (importOriginal) => {
  // 用 Record 展开而不是 `typeof import(...)` 类型注解(eslint consistent-type-imports 禁后者)
  const actual = (await importOriginal()) as Record<string, unknown>;
  let seq = 0;
  return {
    ...actual,
    createSession: () => {
      seq += 1;
      return {
        id: `fake-session-${seq}`,
        workspacePath: '/tmp/none',
        modelId: 'test',
        history: [],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
    },
    saveSession: () => undefined,
    loadSession: () => null,
    listSessions: () => [],
  };
});

interface LoopCallbacks {
  onToolCall?: (name: string, args: Record<string, unknown>) => unknown | Promise<unknown>;
  onToolDeltaFrames?: (events: ToolDeltaEvent[]) => unknown | Promise<unknown>;
  onToolResult?: (name: string, success: boolean, output: string) => unknown | Promise<unknown>;
  onError?: (message: string) => unknown | Promise<unknown>;
}
const loopState = vi.hoisted(() => ({ scenario: 'write-then-result' }));

// runToolLoop / setupAgentTools 换假件:本测试判的是**三面各自怎么处理回调**,
// 主循环那侧("执行前派生")已由 tool-delta-wiring.test.ts 钉住,不重复判。
vi.mock('../src/commands/agent.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual, // createToolDeltaBridge 用**真**实现:三面共用一份才判得出"共用"
    setupAgentTools: async () => ({ systemPrompt: 'sys', ctx: { workspacePath: '/tmp/none' } }),
    runToolLoop: async (opts: LoopCallbacks) => {
      const frames = previewFramesFor();
      if (loopState.scenario === 'abort') {
        await opts.onToolCall?.('write_file', { path: 'a.txt', content: 'x' });
        await opts.onToolDeltaFrames?.(frames);
        await opts.onError?.('stream died');
      } else if (loopState.scenario === 'non-write-tool') {
        await opts.onToolCall?.('grep', { pattern: 'x' });
        // 非写类工具:主循环根本不会发帧(与 tool-delta-wiring 第②条同一纪律)
        await opts.onToolResult?.('grep', true, 'no matches');
      } else {
        await opts.onToolCall?.('write_file', { path: 'a.txt', content: 'line-1\nline-2\n' });
        await opts.onToolDeltaFrames?.(frames);
        await opts.onToolResult?.('write_file', true, 'written');
      }
      return {
        stopReason: 'end_turn',
        iterations: 1,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
        assistantText: '',
      };
    },
  };
});

const { AgentCore } = await import('../src/server/agent-core.js');
const { planAcpPreviewUpdate, emitAcpToolDeltaPreview, ACP_TOOL_DELTA_PREVIEW_MARKER } =
  await import('../src/acp/server.js');
const { createToolDeltaBridge } = await import('../src/commands/agent.js');

type CoreEvent = Parameters<AgentEventHandler>[0];

async function driveAgentCore(scenario: string): Promise<CoreEvent[]> {
  loopState.scenario = scenario;
  const events: CoreEvent[] = [];
  const core = new AgentCore({
    workspacePath: '/tmp/none',
    model: 'test',
    apiUrl: 'http://127.0.0.1:1',
  });
  await core.sendMessage('go', (e) => {
    events.push(e);
  });
  return events.filter((e) => e.type !== 'done' && e.type !== 'token');
}

// ==================== A. agent-core 面:行为级(驱动真 AgentCore) ====================

describe('A. agent-core 面:预览逐帧发出、终态先清后结果、中断全作废', () => {
  beforeEach(() => {
    loopState.scenario = 'write-then-result';
  });

  it('写类工具:每一帧是一条 tool_delta,字段名沿用 ToolDeltaEvent,seq 原样', async () => {
    const events = await driveAgentCore('write-then-result');
    const deltas = events.filter((e) => e.type === 'tool_delta');
    expect(deltas).toHaveLength(1);
    const frame = deltas[0];
    if (frame?.type !== 'tool_delta') throw new Error('应当有 tool_delta');
    expect(frame.toolCallId).toBe('cli-preview-fixed');
    expect(frame.seq).toBe(1);
    expect(frame.partialText).toBe('line-1\nline-2');
    expect(frame.name).toBe('write_file');
    expect('truncated' in frame).toBe(false);
    expect(events.map((e) => e.type)).toEqual([
      'tool_call',
      'tool_delta',
      'tool_delta_clear',
      'tool_result',
    ]);
  });

  it('终态清预览:clear 在 tool_result **之前**,且带的是同一 toolCallId', async () => {
    const events = await driveAgentCore('write-then-result');
    const idxClear = events.findIndex((e) => e.type === 'tool_delta_clear');
    const idxResult = events.findIndex((e) => e.type === 'tool_result');
    expect(idxClear).toBeGreaterThanOrEqual(0);
    expect(idxClear).toBeLessThan(idxResult);
    const clear = events[idxClear];
    if (clear?.type !== 'tool_delta_clear') throw new Error('clear 缺失');
    expect(clear.toolCallId).toBe('cli-preview-fixed');
    // 结果之后不得再有同 id 的预览(那才是"预览与结果同屏")
    const after = events
      .slice(idxResult)
      .filter((e) => e.type === 'tool_delta' && e.toolCallId === 'cli-preview-fixed');
    expect(after).toHaveLength(0);
  });

  it('非写类工具:0 帧 ⇒ 也不发幽灵 clear(没有预览就没有"清"这件事)', async () => {
    const events = await driveAgentCore('non-write-tool');
    expect(events.filter((e) => e.type === 'tool_delta')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'tool_delta_clear')).toHaveLength(0);
    expect(events.map((e) => e.type)).toEqual(['tool_call', 'tool_result']);
  });

  it('流中断:仍在场的预览全部作废并发 clear,再发 error', async () => {
    const events = await driveAgentCore('abort');
    expect(events.map((e) => e.type)).toEqual([
      'tool_call',
      'tool_delta',
      'tool_delta_clear',
      'error',
    ]);
  });
});

// ==================== B. ACP 面:plan 三闸门 + 非终态形态 ====================

interface Captured {
  method: string;
  sessionId: string;
  update: {
    sessionUpdate: string;
    toolCallId: string;
    status?: string;
    title?: string;
    content: Array<{ type: string; content: { type: string; text: string } }>;
    rawOutput?: {
      toolDeltaPreview?: { seq: number; truncated: boolean; sourceToolCallId: string };
    };
  };
}

function makeCx(notifyImpl?: (method: string, params: unknown) => Promise<void>) {
  const sent: Captured[] = [];
  const cx = {
    request: async () => null,
    notify:
      notifyImpl ??
      (async (method: string, params: unknown) => {
        const p = params as { sessionId: string; update: Captured['update'] };
        sent.push({ method, sessionId: p.sessionId, update: p.update });
      }),
  } as unknown as AgentContext;
  return { cx, sent };
}

describe('B. ACP 面:预览落到已有 tool_call_update 形态,非终态、不伪造归属', () => {
  it('三条"不发帧"闸门各红一次:空卡 id / 0 帧 / 卡已落终态', () => {
    const frames = previewFramesFor();
    const store = createToolDeltaPreviewStore();
    // ① 配不上卡 ⇒ 不伪造归属
    expect(planAcpPreviewUpdate({ store, events: frames, acpToolCallId: '', open: true })).toBeNull();
    // ② 非写类工具(主循环压根不发帧)⇒ 空批不发
    expect(planAcpPreviewUpdate({ store, events: [], acpToolCallId: 'card-1', open: true })).toBeNull();
    // ③ **终态必须清预览**:卡已出队(open=false)⇒ 绝不再刷预览
    expect(
      planAcpPreviewUpdate({ store, events: frames, acpToolCallId: 'card-1', open: false }),
    ).toBeNull();
    // 阳性对照:卡开着才发得出
    const plan = planAcpPreviewUpdate({ store, events: frames, acpToolCallId: 'card-1', open: true });
    expect(plan?.text).toBe('line-1\nline-2');
    expect(plan?.seq).toBe(1);
  });

  it('update 是 tool_call_update / status=in_progress / 同一卡 id / content 带非终态前缀', async () => {
    const store = createToolDeltaPreviewStore();
    const plan = planAcpPreviewUpdate({
      store,
      events: previewFramesFor(),
      acpToolCallId: 'card-9',
      open: true,
    });
    if (!plan) throw new Error('plan 应当成立');
    const { cx, sent } = makeCx();
    await emitAcpToolDeltaPreview(cx, 'sess-1', 'card-9', plan, 'write_file');
    expect(sent).toHaveLength(1);
    const update = sent[0]!.update;
    expect(update.sessionUpdate).toBe('tool_call_update');
    // 非终态:刻意不是 completed/failed —— 预览不是结果
    expect(update.status).toBe('in_progress');
    // 同一 id ⇒ 后续 onToolResult 的终态 update 覆盖它,预览不会与结果同屏
    expect(update.toolCallId).toBe('card-9');
    expect(update.content[0]!.content.text.startsWith(ACP_TOOL_DELTA_PREVIEW_MARKER)).toBe(true);
    expect(update.rawOutput?.toolDeltaPreview?.sourceToolCallId).toBe('cli-preview-fixed');
  });

  it('空卡 id 不发任何 update(不得把预览挂到别人的卡上)', async () => {
    const store = createToolDeltaPreviewStore();
    const plan = planAcpPreviewUpdate({
      store,
      events: previewFramesFor(),
      acpToolCallId: 'card-2',
      open: true,
    });
    if (!plan) throw new Error('plan 应当成立');
    const { cx, sent } = makeCx();
    await emitAcpToolDeltaPreview(cx, 's', '', plan);
    expect(sent).toHaveLength(0);
  });

  it('IDE 渲染失败(notify 抛错)不得中断 agent 主流程', async () => {
    const store = createToolDeltaPreviewStore();
    const plan = planAcpPreviewUpdate({
      store,
      events: previewFramesFor(),
      acpToolCallId: 'card-3',
      open: true,
    });
    if (!plan) throw new Error('plan 应当成立');
    const { cx } = makeCx(async () => {
      throw new Error('client gone');
    });
    await expect(emitAcpToolDeltaPreview(cx, 's', 'card-3', plan)).resolves.toBeUndefined();
  });

  it('超预算时 truncated 为真(不静默变短),且帧归属仍是同一张卡', () => {
    const big = {
      path: 'a.txt',
      content: Array.from({ length: 500 }, (_, i) => `l${i}`).join('\n'),
    };
    const frames = buildFileEditPreviewEvents('cli-preview-big', 'write_file', big);
    expect(frames[frames.length - 1]?.truncated).toBe(true);
    const store = createToolDeltaPreviewStore();
    const plan = planAcpPreviewUpdate({
      store,
      events: frames,
      acpToolCallId: 'card-4',
      open: true,
    });
    expect(plan?.truncated).toBe(true);
    expect(store.get('card-4')?.truncated).toBe(true);
  });

  it('同一张卡整帧覆盖:两批帧后 store 只留最后一份累积文本', () => {
    const store = createToolDeltaPreviewStore();
    planAcpPreviewUpdate({ store, events: previewFramesFor('write_file', 'p-1'), acpToolCallId: 'card-5', open: true });
    const second = buildFileEditPreviewEvents('p-2', 'write_file', { content: 'only-one-line\n' });
    const plan = planAcpPreviewUpdate({ store, events: second, acpToolCallId: 'card-5', open: true });
    expect(plan?.text).toBe('only-one-line');
    expect(store.ids()).toEqual(['card-5']);
  });
});

// ==================== C. headless 面:结构化单行 JSON ====================

describe('C. headless 面:新事件是机器可解析的单行 JSON,人读模式不出预览', () => {
  const delta: HeadlessEvent = {
    type: 'tool_delta',
    name: 'write_file',
    toolCallId: 'cli-preview-fixed',
    seq: 1,
    partialText: 'line-1\nline-2',
  };
  const clear: HeadlessEvent = {
    type: 'tool_delta_clear',
    name: 'write_file',
    toolCallId: 'cli-preview-fixed',
  };

  it('json 模式:一行一个事件,含换行的 partialText 被转义而不破行', () => {
    const line = formatHeadlessEvent(delta, 'json');
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1).includes('\n')).toBe(false);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.type).toBe('tool_delta');
    expect(parsed.toolCallId).toBe('cli-preview-fixed');
    expect(parsed.seq).toBe(1);
    expect(parsed.partialText).toBe('line-1\nline-2');
    expect(formatHeadlessEvent(clear, 'json')).toContain('"tool_delta_clear"');
  });

  it('truncated 缺席时不写该键(不产出 truncated:false 的假事实)', () => {
    expect(JSON.parse(formatHeadlessEvent(delta, 'json')).truncated).toBeUndefined();
    const truncatedFrame: HeadlessEvent = { ...delta, truncated: true };
    expect(JSON.parse(formatHeadlessEvent(truncatedFrame, 'json')).truncated).toBe(true);
  });

  it('text / markdown 模式刻意零输出:没有"更新同一 id"的撤回通道,发出去就撤不回', () => {
    expect(formatHeadlessEvent(delta, 'text')).toBe('');
    expect(formatHeadlessEvent(clear, 'text')).toBe('');
    expect(eventToMarkdown(delta)).toBe('');
    expect(eventToMarkdown(clear)).toBe('');
  });
});

// ==================== D/E. 装车锁(每条都带构造反例证明它会红) ====================

type Lock = (src: string) => string[];

/** D1:agent-core 必须消费帧回调,且终态/中断都走同一份桥(clear 必须**发出去**,不是只调 settle) */
const lockAgentCore: Lock = (src) => {
  const misses: string[] = [];
  if (!/onToolDeltaFrames\s*:/.test(src)) misses.push('未把 onToolDeltaFrames 传给 runToolLoop');
  if (!src.includes('createToolDeltaBridge()')) misses.push('未用共用桥(第二份配对逻辑的开始)');
  if (!/d113Bridge\.settle\(name\);[\s\S]{0,200}type: 'tool_delta_clear'/.test(src)) {
    misses.push('终态算了该清谁,但没把 clear 发出去');
  }
  if (!/d113Bridge\.abort\(\)[\s\S]{0,220}type: 'tool_delta_clear'/.test(src)) {
    misses.push('流中断清了账,但消费方收不到 clear');
  }
  if (!src.includes("type: 'tool_delta'")) misses.push('AgentEvent 里没有 tool_delta');
  return misses;
};

/** D2:ACP 必须重划到卡 id、走非终态形态、终态清账 */
const lockAcp: Lock = (src) => {
  const misses: string[] = [];
  if (!/onToolDeltaFrames\s*:/.test(src)) misses.push('ACP 没有接 onToolDeltaFrames');
  if (!src.includes('planAcpPreviewUpdate({')) misses.push('没有经过非终态闸门判据');
  if (!src.includes('emitAcpToolDeltaPreview(cx')) misses.push('判据在位但没人发帧');
  if (!src.includes('previewStore.clear(toolCallId)')) misses.push('tool_result 未清同卡预览');
  if (!src.includes('previewStore.clearAll()')) misses.push('异常轮未清账');
  if (!/status: 'in_progress' as const/.test(src)) misses.push('预览帧落成了终态形态(伪造终态)');
  if (!src.includes('ACP_TOOL_DELTA_PREVIEW_MARKER')) misses.push('content 里没有可辨认的预览前缀');
  return misses;
};

/** D3:headless 必须把两条新事件**各自发到该发的位置**(substring 在场不算 —— 反例 4 就是被这一点教会) */
const lockHeadless: Lock = (src) => {
  const misses: string[] = [];
  if (!/onToolDeltaFrames: \(events\)/.test(src)) misses.push('headless 未接帧回调');
  if (!/type: 'tool_delta',\s*\n?\s*name: fact\.toolName/.test(src)) {
    misses.push('headless 没有把帧逐条发成 tool_delta');
  }
  if (!/const settled = d113Bridge\.settle\(name\);[\s\S]{0,220}type: 'tool_delta_clear'/.test(src)) {
    misses.push('终态算了该清谁,但没把 clear 发出去');
  }
  if (!/d113Bridge\.abort\(\)[\s\S]{0,260}type: 'tool_delta_clear'/.test(src)) {
    misses.push('流中断清了账,但机器消费方收不到 clear');
  }
  if (!src.includes('const d113Bridge = createToolDeltaBridge()')) misses.push('headless 没有配对桥');
  if (!src.includes('d113Bridge.noteToolCall(name)')) misses.push('帧归属没人记');
  return misses;
};

/** D4:HeadlessEvent 联合必须真登记这两个 kind(agent.ts 构造的事件要靠它定型) */
const lockUnion: Lock = (src) => {
  const misses: string[] = [];
  if (!src.includes("| { type: 'tool_delta';")) misses.push('HeadlessEvent 联合未登记 tool_delta');
  if (!src.includes("| { type: 'tool_delta_clear';")) misses.push('HeadlessEvent 联合未登记 clear');
  return misses;
};

/** E:派生只能有一处 —— 三面文件都不得自己算预览文本 */
const lockSingleSource: Lock = (src) => {
  const misses: string[] = [];
  if (src.includes('buildFileEditPreviewEvents(')) misses.push('该面自己派生了帧(应有唯一一处)');
  if (src.includes('FILE_EDIT_PREVIEW_KEYS')) misses.push('该面复制了取键表(第二份真相)');
  if (/partialText:\s*JSON\.stringify/.test(src)) misses.push('把 args 直接 stringify 当预览');
  return misses;
};

describe('D. 装车锁:三面接线 + 反例证明每条都会红(不是恒绿摆设)', () => {
  const coreSrc = SRC('server/agent-core.ts');
  const acpSrc = SRC('acp/server.ts');
  const headlessSrc = SRC('commands/agent.ts');
  const formatSrc = SRC('headless-format.ts');

  it('当前源码:五把锁全部零违规(阳性)', () => {
    expect(lockAgentCore(coreSrc)).toEqual([]);
    expect(lockAcp(acpSrc)).toEqual([]);
    expect(lockHeadless(headlessSrc)).toEqual([]);
    expect(lockUnion(formatSrc)).toEqual([]);
    for (const [label, src] of [
      ['agent-core', coreSrc],
      ['acp/server', acpSrc],
      ['headless-format', formatSrc],
    ] as const) {
      expect(lockSingleSource(src), label).toEqual([]);
    }
  });

  it('反例 1:摘掉 agent-core 的 onToolDeltaFrames ⇒ D1 必红', () => {
    const mutated = coreSrc.replace(
      'onToolDeltaFrames: async (events: ToolDeltaEvent[]) => {',
      'onToolDeltaFrames_REMOVED: async (events: ToolDeltaEvent[]) => {',
    );
    expect(mutated).not.toBe(coreSrc); // 反例必须真生效(否则"红过"是假的)
    expect(lockAgentCore(mutated)).toContain('未把 onToolDeltaFrames 传给 runToolLoop');
  });

  it('反例 2:删掉 tool_result 里的 previewStore.clear ⇒ D2 必红(终态不清预览)', () => {
    const mutated = acpSrc.replace('previewStore.clear(toolCallId);', '');
    expect(mutated).not.toBe(acpSrc);
    expect(lockAcp(mutated)).toContain('tool_result 未清同卡预览');
  });

  it('反例 3:预览 update 写成 completed ⇒ D2 判"伪造终态"', () => {
    const mutated = acpSrc.replace(
      "status: 'in_progress' as const,",
      "status: 'completed' as const,",
    );
    expect(mutated).not.toBe(acpSrc);
    expect(lockAcp(mutated)).toContain('预览帧落成了终态形态(伪造终态)');
  });

  it('反例 4:headless 终态不发 clear ⇒ D3 必红(结果与预览同屏)', () => {
    const mutated = headlessSrc.replace(
      "emit({ type: 'tool_delta_clear', name: settled.toolName, toolCallId: settled.toolCallId });",
      '',
    );
    expect(mutated).not.toBe(headlessSrc); // 反例必须真生效
    expect(lockHeadless(mutated)).toContain('终态算了该清谁,但没把 clear 发出去');
  });

  it('反例 4b:headless 中断不发 clear ⇒ D3 必红(消费方账上留一张幽灵预览)', () => {
    const mutated = headlessSrc.replace(
      "emit({ type: 'tool_delta_clear', name: stale.toolName, toolCallId: stale.toolCallId });",
      '',
    );
    expect(mutated).not.toBe(headlessSrc);
    expect(lockHeadless(mutated)).toContain('流中断清了账,但机器消费方收不到 clear');
  });

  it('反例 4c:headless 把逐帧改成只发末帧 ⇒ D3 必红(seq 契约丢了)', () => {
    const mutated = headlessSrc.replace(
      "type: 'tool_delta',\n            name: fact.toolName,",
      "type: 'tool_delta',\n            name: 'unknown',",
    );
    expect(mutated).not.toBe(headlessSrc);
    expect(lockHeadless(mutated)).toContain('headless 没有把帧逐条发成 tool_delta');
  });

  it('反例 4d:agent-core 终态只调 settle 不发事件 ⇒ D1 必红', () => {
    const mutated = coreSrc.replace(
      "await onEvent({ type: 'tool_delta_clear', name: settled.toolName, toolCallId: settled.toolCallId });",
      'void settled;',
    );
    expect(mutated).not.toBe(coreSrc);
    expect(lockAgentCore(mutated)).toContain('终态算了该清谁,但没把 clear 发出去');
  });

  it('反例 5:HeadlessEvent 联合里删掉 tool_delta ⇒ D4 必红', () => {
    const mutated = formatSrc.replace("| { type: 'tool_delta';", "| { type: 'tool_delta_x';");
    expect(mutated).not.toBe(formatSrc);
    expect(lockUnion(mutated)).toContain('HeadlessEvent 联合未登记 tool_delta');
  });

  it('反例 6:某一面自己 stringify args 当预览 ⇒ E 必红', () => {
    const mutated = coreSrc.replace(
      'partialText: fact.event.partialText,',
      'partialText: JSON.stringify(args),',
    );
    expect(mutated).not.toBe(coreSrc);
    expect(lockSingleSource(mutated)).toContain('把 args 直接 stringify 当预览');
  });

  it('反例 7:某一面复制取键表 ⇒ E 必红(第二份真相)', () => {
    const mutated = `${acpSrc}\nconst KEYS = FILE_EDIT_PREVIEW_KEYS;\n`;
    expect(lockSingleSource(mutated)).toContain('该面复制了取键表(第二份真相)');
  });

  it('反例 8:agent-core 不再用共用桥 ⇒ D1 点名"第二份配对逻辑"', () => {
    const mutated = coreSrc.replace('createToolDeltaBridge()', 'makeMyOwnBridge()');
    expect(mutated).not.toBe(coreSrc);
    expect(lockAgentCore(mutated)).toContain('未用共用桥(第二份配对逻辑的开始)');
  });
});

describe('E. 三面共用同一份预览判据(而不是各写一遍)', () => {
  it('running / 空文本判据只有 pickToolDeltaPreviewText 一处被调用', () => {
    expect(SRC('acp/server.ts').includes('pickToolDeltaPreviewText({')).toBe(true);
    const bridgeSrc = SRC('commands/agent.ts');
    expect(bridgeSrc.includes('pickToolDeltaPreviewText({')).toBe(true);
    expect(bridgeSrc.match(/pickToolDeltaPreviewText\(/g) ?? []).toHaveLength(1);
    // agent-core / headless-format 都不得自己判"预览文本非空"
    expect(SRC('server/agent-core.ts').includes('pickToolDeltaPreviewText')).toBe(false);
  });

  it('共用桥行为:settle 只清第一个仍在场的同名片段,没出过帧的工具返回 null', () => {
    const bridge = createToolDeltaBridge();
    bridge.noteToolCall('write_file');
    expect(bridge.onFrames(previewFramesFor('write_file', 'cli-preview-fixed'))).toHaveLength(1);
    bridge.noteToolCall('write_file');
    const alt = buildFileEditPreviewEvents('cli-preview-second', 'write_file', {
      content: 'a\nb\n',
    });
    expect(bridge.onFrames(alt)).toHaveLength(1);
    bridge.noteToolCall('grep');
    expect(bridge.onFrames([])).toHaveLength(0); // 非写类:0 帧,不入账
    expect(bridge.heldIds()).toEqual(['cli-preview-fixed', 'cli-preview-second']);
    expect(bridge.settle('write_file')?.toolCallId).toBe('cli-preview-fixed');
    expect(bridge.heldIds()).toEqual(['cli-preview-second']);
    expect(bridge.settle('grep')).toBeNull(); // 没出过帧 ⇒ 不发幽灵 clear
    expect(bridge.abort().map((r) => r.toolCallId)).toEqual(['cli-preview-second']);
    expect(bridge.heldIds()).toEqual([]);
  });

  it('空 toolCallId 的帧被丢弃(与 web/RN/小程序同一条纪律,不发无法清场的预览)', () => {
    const bridge = createToolDeltaBridge();
    bridge.noteToolCall('write_file');
    const ghost: ToolDeltaEvent[] = [
      { toolCallId: '', seq: 1, partialText: 'line-1\nline-2' },
    ];
    expect(bridge.onFrames(ghost)).toHaveLength(0);
    expect(bridge.heldIds()).toEqual([]);
    expect(bridge.settle('write_file')).toBeNull();
  });
});
