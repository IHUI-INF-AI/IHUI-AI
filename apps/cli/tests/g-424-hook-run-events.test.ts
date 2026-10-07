// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-424(2026-10-07 拍板"抄上游")—— 钩子运行事件层:
 *   ① 每条派发的钩子必发 started + 一个终态事件(成功也不例外,成对由结构保证);
 *   ② 终态枚举含上游四档 TimedOut/Cancelled/Failed/Blocked,取消与超时/失败不再同形;
 *   ③ linkAbortSignal 把父级取消信号并进时限:取消先于派发 ⇒ 该条不执行(Cancelled);
 *      取消落在两条之间 ⇒ 余下条目不再派发。
 * 走生产入口(真派生子进程 + 真 hooks.json),不 mock 执行面;
 * 事件层判定不内联第二份 —— 全部经生产导出的 onHookRunEvent 观察。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  runPreToolCall,
  runHook,
  onHookRunEvent,
  linkAbortSignal,
  HOOK_RUN_OUTCOMES,
  isTerminalComplete,
  type HookRunEvent,
  type HookEvent,
} from '../src/hooks/index.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'g424-hook-events-'));
const CONFIG = path.join(TMP, 'hooks.json');
const isWin = process.platform === 'win32';
let uniq = 0;
const hookName = (tag: string) => `g424-${tag}-${++uniq}`;

const exit0Cmd = isWin ? 'cmd /c exit 0' : "sh -c 'exit 0'";
const exit3Cmd = isWin ? 'cmd /c exit 3' : "sh -c 'exit 3'";
const longCmd = isWin ? 'cmd /c ping -n 10 127.0.0.1 >nul' : "sh -c 'sleep 10'";

function writeHookConfig(event: HookEvent, entries: Array<Record<string, unknown>>): void {
  fs.writeFileSync(CONFIG, JSON.stringify({ [event]: entries }), 'utf-8');
}

/** 事件收集器:返回 {events, unsubscribe}。 */
function collectEvents(): { events: HookRunEvent[]; unsubscribe: () => void } {
  const events: HookRunEvent[] = [];
  const unsubscribe = onHookRunEvent((e) => events.push(e));
  return { events, unsubscribe };
}

let origConfig: string | undefined;
let origTrust: string | undefined;

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
  // 临时目录不在工作区内 ⇒ 信任门按 folder-not-trusted 拦;显式出口只免目录信任这一层。
  process.env.IHUI_TRUST_WORKSPACE = '1';
});

afterAll(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('G-424 started/terminal 事件成对不变量', () => {
  it('① 两条钩子(成功+非阻断失败)各得一对事件,outcome 分别为 Succeeded/Failed', () => {
    const a = hookName('ok');
    const b = hookName('fail-nb');
    writeHookConfig('preToolCall', [
      { name: a, command: exit0Cmd, blockOnError: false },
      { name: b, command: exit3Cmd, blockOnError: false },
    ]);
    const { events, unsubscribe } = collectEvents();
    try {
      const result = runPreToolCall('bash', {});
      expect(result.proceed).toBe(true);
      expect(result.terminal).toBe('non_blocking_error');
      // 每条派发恰好一对,顺序 started→terminal
      expect(events.map((e) => `${e.type}:${e.hook}`)).toEqual([
        `started:${a}`,
        `terminal:${a}`,
        `started:${b}`,
        `terminal:${b}`,
      ]);
      expect(events.every((e) => e.hookEvent === 'preToolCall')).toBe(true);
      const outcomes = events
        .filter((e): e is Extract<HookRunEvent, { type: 'terminal' }> => e.type === 'terminal')
        .map((e) => e.outcome);
      expect(outcomes).toEqual(['Succeeded', 'Failed']);
    } finally {
      unsubscribe();
    }
  });

  it('② 超时被杀 ⇒ terminal 事件 TimedOut(与取消/失败可判地分开)', () => {
    const a = hookName('slow');
    writeHookConfig('preToolCall', [{ name: a, command: longCmd, timeout: 400, blockOnError: false }]);
    const { events, unsubscribe } = collectEvents();
    try {
      const result = runPreToolCall('bash', {});
      expect(result.terminal).toBe('timed_out');
      const terminal = events.find(
        (e): e is Extract<HookRunEvent, { type: 'terminal' }> => e.type === 'terminal',
      );
      expect(terminal).toBeDefined();
      expect(terminal!.hook).toBe(a);
      expect(terminal!.outcome).toBe('TimedOut');
    } finally {
      unsubscribe();
    }
  });

  it('③ 父级取消先于派发 ⇒ 该条不执行、事件层报 Cancelled、余下条目不再派发', () => {
    const a = hookName('cancel-first');
    const b = hookName('cancel-never');
    writeHookConfig('preToolCall', [
      { name: a, command: exit0Cmd, blockOnError: false },
      { name: b, command: exit0Cmd, blockOnError: false },
    ]);
    const controller = new AbortController();
    controller.abort(new Error('parent-cancelled'));
    const { events, unsubscribe } = collectEvents();
    try {
      const result = runPreToolCall('bash', {}, controller.signal);
      // 取消不是完成:旧终态层投影 result_unknown(§30 不渲染成完成)
      expect(result.proceed).toBe(true);
      expect(result.terminal).toBe('result_unknown');
      expect(isTerminalComplete(result.terminal!)).toBe(false);
      // 只派发了第一条,且事件成对;第二条从未 started
      expect(events.map((e) => `${e.type}:${e.hook}`)).toEqual([`started:${a}`, `terminal:${a}`]);
      const terminal = events[1] as Extract<HookRunEvent, { type: 'terminal' }>;
      expect(terminal.outcome).toBe('Cancelled');
    } finally {
      unsubscribe();
    }
  });

  it('④ 取消落在两条之间(经 terminal 事件监听器触发)⇒ 断链,余下不派发', () => {
    const a = hookName('chain-first');
    const b = hookName('chain-never');
    writeHookConfig('preToolCall', [
      { name: a, command: exit0Cmd, blockOnError: false },
      { name: b, command: exit0Cmd, blockOnError: false },
    ]);
    const controller = new AbortController();
    const { events, unsubscribe } = collectEvents();
    // 监听器在第一条 terminal 时取消父级:模拟"收尾边界落地"的取消
    const off = onHookRunEvent((e) => {
      if (e.type === 'terminal' && e.hook === a) controller.abort(new Error('mid-chain-cancel'));
    });
    try {
      const result = runPreToolCall('bash', {}, controller.signal);
      expect(result.proceed).toBe(true);
      expect(result.terminal).toBe('succeeded');
      expect(controller.signal.aborted).toBe(true);
      expect(events.map((e) => `${e.type}:${e.hook}`)).toEqual([`started:${a}`, `terminal:${a}`]);
    } finally {
      off();
      unsubscribe();
    }
  });

  it('⑤ 事件面监听器抛错不改写钩子判定,事件流对第二个监听器仍然完整', () => {
    const a = hookName('throwing-listener');
    writeHookConfig('preToolCall', [{ name: a, command: exit3Cmd, blockOnError: false }]);
    const offThrow = onHookRunEvent(() => {
      throw new Error('listener must not break dispatch');
    });
    const { events, unsubscribe } = collectEvents();
    try {
      const result = runPreToolCall('bash', {});
      expect(result.proceed).toBe(true);
      expect(result.terminal).toBe('non_blocking_error');
      expect(events).toHaveLength(2);
      expect((events[1] as Extract<HookRunEvent, { type: 'terminal' }>).outcome).toBe('Failed');
    } finally {
      offThrow();
      unsubscribe();
    }
  });

  it('⑥ runHook 通用分发同样成对(turnStart 事件)', () => {
    const a = hookName('generic');
    writeHookConfig('turnStart', [{ name: a, command: exit0Cmd, blockOnError: false }]);
    const { events, unsubscribe } = collectEvents();
    try {
      const result = runHook('turnStart', { workspacePath: TMP, turnNumber: 1 });
      expect(result.proceed).toBe(true);
      expect(result.terminal).toBe('succeeded');
      expect(events.map((e) => `${e.type}:${e.hookEvent}`)).toEqual([
        'started:turnStart',
        'terminal:turnStart',
      ]);
      expect((events[1] as Extract<HookRunEvent, { type: 'terminal' }>).outcome).toBe('Succeeded');
    } finally {
      unsubscribe();
    }
  });
});

describe('G-424 终态枚举与 linkAbortSignal', () => {
  it('⑦ HOOK_RUN_OUTCOMES 封闭集包含上游四档 TimedOut/Cancelled/Failed/Blocked', () => {
    for (const outcome of ['TimedOut', 'Cancelled', 'Failed', 'Blocked'] as const) {
      expect(HOOK_RUN_OUTCOMES).toContain(outcome);
    }
  });

  it('⑧ 父级已取消 ⇒ link 立即返回已 abort 的 signal', () => {
    const parent = new AbortController();
    parent.abort(new Error('already'));
    const linked = linkAbortSignal(parent.signal, 60_000);
    try {
      expect(linked.signal.aborted).toBe(true);
    } finally {
      linked.dispose();
    }
  });

  it('⑨ 父级后取消 ⇒ link 跟随 abort;成功路径 dispose 后不被时限误杀', async () => {
    const parent = new AbortController();
    const linked = linkAbortSignal(parent.signal, 60_000);
    const followAborted = new Promise<void>((resolve) => {
      linked.signal.addEventListener('abort', () => resolve(), { once: true });
    });
    // dispose 与"父级取消"竞争前先验证:dispose 清了定时器,时限不再触发
    parent.abort(new Error('cancel-now'));
    await followAborted;
    expect(linked.signal.aborted).toBe(true);
    linked.dispose();

    const linked2 = linkAbortSignal(undefined, 50);
    linked2.dispose();
    await new Promise((r) => setTimeout(r, 120));
    expect(linked2.signal.aborted).toBe(false);
  });
});
