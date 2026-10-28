// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具粒度钩子取消腿(G-424 移交票,未取号)—— 可打性锁定:
 *   ① preToolCall 腿:执行窗合成信号经 ctx.signal 直达调用点 ⇒ 父级取消杀掉**正在运行**的
 *      钩子子进程,工具以 proceed:false 短路返回,不进主体;
 *   ② postToolCall 腿:同一接线,取消打在 post 钩子,事件层如实报 Cancelled;
 *   ③ 对照组:不取消 ⇒ 钩子正常完成(Succeeded),工具主体跑到结束;
 *   ④ 生产装配面(runToolLoop):回合 opts.signal 经 toolCtx 注入进 ToolContext
 *      (handler 侧 ctx.signal 非 undefined 且随父级 abort 而 aborted),
 *      取消打在运行中的 post 钩子 ⇒ 端到端 Cancelled。
 * 全程走生产链 executeToolCall → handler → run*ToolCall(真派生子进程 + 真 hooks.json),
 * 不 mock 执行面;钩子自身 timeout 远大于"取消后快速返回"的断言窗,防止"等超时才绿"。
 * ④ 唯一 mock 的是采样出口 streamChat(不真发网络),执行面/钩子面仍是真的。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  onHookRunEvent,
  runPostToolCall,
  type HookRunEvent,
  type HookEvent,
} from '../src/hooks/index.js';
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
} from '../src/tools/index.js';
import { GIT_TOOLS } from '../src/tools/git.js';
import { SHADOW_LEDGER_ENV } from '../src/skills/allowed-tools-shadow.js';
import { runToolLoop } from '../src/commands/agent.js';

// ── ④ 专用:部分 mock 采样出口(照 agent-stream-swallow-fix.test.ts 先例)──
// 只桩掉 streamChat/setBaseUrl/setTokenProvider(不真发网络),其余导出走真实实现;
// 执行面(executeToolCall)与钩子面(真子进程 + 真 hooks.json)一律不 mock。
type StreamChatOpts = {
  model: string;
  messages: unknown[];
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  onError?: (err: string) => void;
};
type StreamChatFn = (opts: StreamChatOpts) => Promise<void>;
const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn<StreamChatFn>() }));
import type * as ApiClient from '@ihui/api-client';
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    streamChat: streamChatMock,
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
  };
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'g424-cancel-leg-'));
const CONFIG = path.join(TMP, 'hooks.json');
const isWin = process.platform === 'win32';
let uniq = 0;
const hookName = (tag: string) => `cancelleg-${tag}-${++uniq}`;

const exit0Cmd = isWin ? 'cmd /c exit 0' : "sh -c 'exit 0'";
const longCmd = isWin ? 'cmd /c ping -n 10 127.0.0.1 >nul' : "sh -c 'sleep 10'";
// 钩子自身时限 15s ≫ 取消后应快速返回的断言窗(5s) ⇒ 断言红了就是"取消没打到",不是抖动
const HOOK_TIMEOUT_MS = 15_000;

function writeHookConfig(event: HookEvent, entries: Array<Record<string, unknown>>): void {
  fs.writeFileSync(CONFIG, JSON.stringify({ [event]: entries }), 'utf-8');
}

/** 等某条钩子的 started 事件(证明子进程确已派发、取消落在"运行中"),带超时守卫。 */
function waitForStarted(hook: string): { promise: Promise<void>; dispose: () => void } {
  let resolveFn!: () => void;
  const inner = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  const off = onHookRunEvent((e) => {
    if (e.type === 'started' && e.hook === hook) resolveFn();
  });
  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`钩子 "${hook}" 的 started 事件超时未出现(钩子未派发?)`)), 6_000);
  });
  const promise = Promise.race([inner, guard]).finally(() => {
    if (timer) clearTimeout(timer);
  });
  return { promise, dispose: off };
}

let origConfig: string | undefined;
let origTrust: string | undefined;
let origShadow: string | undefined;
let origAudit: string | undefined;

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  origShadow = process.env[SHADOW_LEDGER_ENV];
  origAudit = process.env.IHUI_AUDIT;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
  // 临时目录不在工作区内 ⇒ 信任门按 folder-not-trusted 拦;显式出口只免目录信任这一层。
  process.env.IHUI_TRUST_WORKSPACE = '1';
  // G-427 影子台账默认开启 ⇒ executeToolCall 会记账,必须关进一次性目录,不碰真实用户台账。
  process.env[SHADOW_LEDGER_ENV] = path.join(TMP, 'shadow.jsonl');
  process.env.IHUI_AUDIT = '0';
});

afterAll(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  if (origShadow === undefined) delete process.env[SHADOW_LEDGER_ENV];
  else process.env[SHADOW_LEDGER_ENV] = origShadow;
  if (origAudit === undefined) delete process.env.IHUI_AUDIT;
  else process.env.IHUI_AUDIT = origAudit;
  fs.rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  resetRateLimiter();
  clearTools();
  registerTools(GIT_TOOLS);
});

describe('工具粒度钩子取消腿(承 G-424)', () => {
  it('① preToolCall 腿:父级取消杀掉运行中的钩子子进程,工具短路返回不进主体', async () => {
    const a = hookName('pre-kill');
    writeHookConfig('preToolCall', [{ name: a, command: longCmd, timeout: HOOK_TIMEOUT_MS }]);
    const events: HookRunEvent[] = [];
    const unsubscribe = onHookRunEvent((e) => events.push(e));
    const controller = new AbortController();
    const wait = waitForStarted(a);
    const t0 = Date.now();
    try {
      const execP = executeToolCall(
        { name: 'git_status', arguments: {} },
        { workspacePath: TMP, signal: controller.signal },
      );
      await wait.promise;
      controller.abort(new Error('user-cancel'));
      const result = await execP;
      const elapsed = Date.now() - t0;
      // 取消 ⇒ blockOnError 缺省 true ⇒ proceed:false ⇒ 工具体未执行
      expect(result.success).toBe(false);
      // 快速返回:远小于钩子自身 15s 时限(接线断了的形状是"等满时限才回")
      expect(elapsed).toBeLessThan(5_000);
      const terminal = events.find(
        (e): e is Extract<HookRunEvent, { type: 'terminal' }> => e.type === 'terminal' && e.hook === a,
      );
      expect(terminal).toBeDefined();
      expect(terminal!.hookEvent).toBe('preToolCall');
      expect(terminal!.outcome).toBe('Cancelled');
    } finally {
      wait.dispose();
      unsubscribe();
    }
  }, 25_000);

  it('② postToolCall 腿:取消杀掉运行中的 post 钩子,事件层报 Cancelled', async () => {
    const a = hookName('post-kill');
    writeHookConfig('postToolCall', [{ name: a, command: longCmd, timeout: HOOK_TIMEOUT_MS }]);
    const events: HookRunEvent[] = [];
    const unsubscribe = onHookRunEvent((e) => events.push(e));
    const controller = new AbortController();
    const wait = waitForStarted(a);
    const t0 = Date.now();
    try {
      // TMP 不是 git 仓 ⇒ 主体 execGit 快速非零返回,post 钩子照常派发(git.ts 不依赖主体成败)
      const execP = executeToolCall(
        { name: 'git_diff', arguments: {} },
        { workspacePath: TMP, signal: controller.signal },
      );
      await wait.promise;
      controller.abort(new Error('user-cancel-post'));
      const result = await execP;
      const elapsed = Date.now() - t0;
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(5_000);
      const terminal = events.find(
        (e): e is Extract<HookRunEvent, { type: 'terminal' }> => e.type === 'terminal' && e.hook === a,
      );
      expect(terminal).toBeDefined();
      expect(terminal!.hookEvent).toBe('postToolCall');
      expect(terminal!.outcome).toBe('Cancelled');
    } finally {
      wait.dispose();
      unsubscribe();
    }
  }, 25_000);

  it('③ 对照组:不取消 ⇒ 钩子正常完成(Succeeded),工具主体跑到结束', async () => {
    const a = hookName('control');
    writeHookConfig('preToolCall', [
      { name: a, command: exit0Cmd, timeout: HOOK_TIMEOUT_MS, blockOnError: false },
    ]);
    const events: HookRunEvent[] = [];
    const unsubscribe = onHookRunEvent((e) => events.push(e));
    try {
      const result = await executeToolCall({ name: 'git_status', arguments: {} }, { workspacePath: TMP });
      expect(result).toBeDefined();
      // 事件成对且 Succeeded:取消腿没有误伤正常路径
      expect(events.map((e) => `${e.type}:${e.hook}`)).toEqual([`started:${a}`, `terminal:${a}`]);
      const terminal = events[1] as Extract<HookRunEvent, { type: 'terminal' }>;
      expect(terminal.outcome).toBe('Succeeded');
    } finally {
      unsubscribe();
    }
  }, 25_000);

  it('④ 生产装配面:runToolLoop 把回合 signal 注入 ToolContext ⇒ 取消端到端打到运行中的 post 钩子', async () => {
    const a = hookName('loop-post-kill');
    writeHookConfig('postToolCall', [{ name: a, command: longCmd, timeout: HOOK_TIMEOUT_MS }]);
    const events: HookRunEvent[] = [];
    const unsubscribe = onHookRunEvent((e) => events.push(e));
    // 探针工具:与真 handler 同型(git.ts 等)——execute 里把 ctx.signal 透传给钩子层。
    // 记两枚证据:① 收到的 ctx.signal 是哪一枚(注入腿),② post 钩子照常派发(取消落点)。
    let seenSignal: AbortSignal | undefined;
    let captured = false;
    registerTools([
      {
        name: 'probe_cancel_leg',
        description: '取消腿探针:同型真 handler,把 ctx.signal 透传 runPostToolCall',
        parameters: {},
        required: [],
        dangerLevel: 'read',
        execute: async (_args: Record<string, unknown>, ctx) => {
          seenSignal = ctx.signal;
          captured = true;
          await runPostToolCall('probe_cancel_leg', { output: 'probe-ok' }, ctx.signal);
          return { success: true, output: 'probe-ok' };
        },
      },
    ]);
    // 采样脚本:第 1 轮吐 tool_call 块(providerSupportsTools:false 走正则路径),第 2 轮纯文本收口。
    let turn = 0;
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      turn += 1;
      if (turn === 1) o.onDelta('```tool_call\n{"name":"probe_cancel_leg","arguments":{}}\n```');
      else o.onDelta('done.');
    });
    const controller = new AbortController();
    const wait = waitForStarted(a);
    const t0 = Date.now();
    try {
      const loopP = runToolLoop({
        modelId: 'test',
        messages: [{ role: 'user', content: 'go' }],
        ctx: { workspacePath: TMP },
        maxIterations: 3,
        signal: controller.signal,
        providerSupportsTools: false,
      });
      await wait.promise;
      controller.abort(new Error('user-cancel-loop'));
      const result = await loopP;
      const elapsed = Date.now() - t0;
      expect(result).toBeDefined();
      // 快速返回:远小于钩子自身 15s 时限(注入腿断了是"等满时限才回"的形状)
      expect(elapsed).toBeLessThan(5_000);
      // 注入腿成立:handler 收到的 ctx.signal 非 undefined(修前经 runToolLoop 恒 undefined;
      // 执行链 executeWithinExecBudget 会派生新 controller,故不比对象身份),
      // 且父级 abort 经 linkAbortSignal 打到派生 signal —— 本测试里 abort 是唯一取消来源,
      // elapsed<5s ≪ 执行预算缺省,排除"预算到点"的假阳性。
      expect(captured).toBe(true);
      expect(seenSignal).toBeDefined();
      expect(seenSignal!.aborted).toBe(true);
      const terminal = events.find(
        (e): e is Extract<HookRunEvent, { type: 'terminal' }> => e.type === 'terminal' && e.hook === a,
      );
      expect(terminal).toBeDefined();
      expect(terminal!.hookEvent).toBe('postToolCall');
      expect(terminal!.outcome).toBe('Cancelled');
    } finally {
      wait.dispose();
      unsubscribe();
      streamChatMock.mockReset();
    }
  }, 25_000);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
