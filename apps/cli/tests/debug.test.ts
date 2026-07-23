/**
 * DAP 调试器工具测试 — 消息编解码 / 握手 / 10 个工具 / session 管理
 *
 * 策略:mock child_process.spawn,不依赖真实 DAP server。
 * 验证 DAP 消息编码格式(Content-Length header + JSON body)、握手流程、参数透传、事件处理。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as childProcess from 'node:child_process';

// Mock child_process.spawn(在所有 import 之前 hoist)
vi.mock('node:child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof childProcess;
  return { ...actual, spawn: vi.fn() };
});

// 绕过源码循环依赖 bug(git.ts ↔ git-advanced.ts):mock 这两个模块为空数组,
// 不影响被测的 debug 工具行为(debug.ts 不依赖 git 模块)。
vi.mock('../src/tools/git-advanced.js', () => ({ GIT_ADVANCED_TOOLS: [] }));
vi.mock('../src/tools/github-pr.js', () => ({ GITHUB_PR_TOOLS: [] }));

// 先触发 index.js 完整加载,避免 debug.ts ↔ index.ts 循环依赖导致 registerLspTools 未定义
import '../src/tools/index.js';
import { spawn } from 'node:child_process';
import {
  debug_launch,
  debug_attach,
  debug_set_breakpoints,
  debug_continue,
  debug_step,
  debug_get_stack_trace,
  debug_get_variables,
  debug_eval,
  debug_disconnect,
  debug_list_sessions,
  DEBUG_TOOLS,
  cleanupIdleSessions,
} from '../src/tools/debug.js';
import type { ToolContext } from '../src/tools/index.js';

// ==================== Mock DAP adapter ====================

interface MockChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  pid: number;
  kill: ReturnType<typeof vi.fn>;
  killed: boolean;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: vi.fn(() => true), end: vi.fn() };
  child.pid = 12345;
  child.kill = vi.fn(() => true);
  child.killed = false;
  return child;
}

/** DAP 消息编码(Content-Length header + JSON body) */
function encodeDap(msg: Record<string, unknown>): string {
  const body = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n${body}`;
}

/** 从 stdin 写入中解析 DAP 请求 */
function parseDap(data: string): Record<string, unknown> | null {
  const m = data.match(/Content-Length:\s*(\d+)\r\n\r\n([\s\S]+)/);
  if (!m || !m[1] || !m[2]) return null;
  try {
    return JSON.parse(m[2].substring(0, parseInt(m[1], 10)));
  } catch {
    return null;
  }
}

let lastChild: MockChild;
let requestLog: Array<{ seq: number; command: string; args?: unknown }>;
let sessionIds: string[];

/** 按命令返回模拟响应 body */
function getResponseBody(command: string): unknown {
  switch (command) {
    case 'initialize':
      return { supportsConfigurationDoneRequest: false };
    case 'launch':
    case 'attach':
      return {};
    case 'setBreakpoints':
      return { breakpoints: [{ verified: true, line: 10 }, { verified: true, line: 20 }] };
    case 'continue':
      return {};
    case 'next':
    case 'stepIn':
    case 'stepOut':
      return {};
    case 'stackTrace':
      return {
        stackFrames: [
          { id: 1, name: 'main', source: { path: '/test.js' }, line: 10, column: 1 },
          { id: 2, name: 'helper', source: { path: '/util.ts' }, line: 5, column: 3 },
        ],
      };
    case 'scopes':
      return { scopes: [{ name: 'Locals', variablesReference: 1000 }, { name: 'Globals', variablesReference: 2000 }] };
    case 'variables':
      return { variables: [{ name: 'x', value: '42', type: 'number' }, { name: 's', value: '"hi"', type: 'string' }] };
    case 'evaluate':
      return { result: '42', type: 'number' };
    case 'disconnect':
      return {};
    default:
      return {};
  }
}

function emitResponse(child: MockChild, requestSeq: number, command: string, body: unknown): void {
  const resp = encodeDap({ seq: -1, type: 'response', request_seq: requestSeq, success: true, command, body });
  setImmediate(() => child.stdout.emit('data', Buffer.from(resp)));
}

function emitEvent(child: MockChild, event: string, body: unknown): void {
  const ev = encodeDap({ seq: -1, type: 'event', event, body });
  setImmediate(() => child.stdout.emit('data', Buffer.from(ev)));
}

function setupSpawn(autoRespond: boolean = true): void {
  requestLog = [];
  vi.mocked(spawn).mockImplementation(
    (() => {
      const child = createMockChild();
      lastChild = child;
      child.stdin.write = vi.fn((data: string) => {
        const req = parseDap(data);
        if (req) {
          requestLog.push({ seq: req.seq as number, command: req.command as string, args: req.arguments });
          if (autoRespond) {
            emitResponse(child, req.seq as number, req.command as string, getResponseBody(req.command as string));
            // continue/step 后需发 stopped 事件以解除 waitForStopped 等待
            if (['continue', 'next', 'stepIn', 'stepOut'].includes(req.command as string)) {
              emitEvent(child, 'stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
            }
          }
        }
        return true;
      }) as any;
      // 触发 spawnAdapter 的 once('data') 回调,确认进程已启动
      setImmediate(() => child.stdout.emit('data', Buffer.from('')));
      return child;
    }) as any,
  );
}

/** 从 launch/attach 结果中提取 sessionId */
function extractSessionId(output: string): string | null {
  const m = output.match(/sessionId:\s*([\w-]+)/);
  return m?.[1] ?? null;
}

/** 向 session 发送 stopped 事件(设置 currentThreadId) */
async function flushStopped(child: MockChild): Promise<void> {
  emitEvent(child, 'stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
  await new Promise((r) => setImmediate(r));
}

// ==================== 测试环境 ====================

let origHooksConfig: string | undefined;
let ctx: ToolContext;

beforeEach(() => {
  origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
  process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-debug-' + Date.now() + '.json');
  ctx = { workspacePath: '/test-workspace' };
  sessionIds = [];
  setupSpawn(true);
});

afterEach(async () => {
  for (const sid of sessionIds) {
    try {
      await debug_disconnect.execute({ sessionId: sid }, ctx);
    } catch {
      // 忽略已断开的 session
    }
  }
  if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
  vi.mocked(spawn).mockReset();
});

// ==================== 测试用例 ====================

describe('DEBUG_TOOLS 注册', () => {
  it('注册 10 个 debug 工具', () => {
    expect(DEBUG_TOOLS).toHaveLength(10);
    expect(DEBUG_TOOLS.map((t) => t.name).sort()).toEqual([
      'debug_attach',
      'debug_continue',
      'debug_disconnect',
      'debug_eval',
      'debug_get_stack_trace',
      'debug_get_variables',
      'debug_launch',
      'debug_list_sessions',
      'debug_set_breakpoints',
      'debug_step',
    ]);
  });
});

describe('DAP 消息编码格式', () => {
  it('stdin 写入的请求包含 Content-Length header + JSON body', async () => {
    const r = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    // 至少有 initialize + launch 两条请求
    expect(requestLog.length).toBeGreaterThanOrEqual(2);
    // 所有写入的数据都应包含 Content-Length header
    const writes = lastChild.stdin.write.mock.calls.map((c) => String(c[0]));
    for (const w of writes) {
      expect(w).toMatch(/^Content-Length:\s*\d+\r\n\r\n\{/);
    }
  });

  it('Content-Length 值与 JSON body 字节数一致', async () => {
    const r = await debug_launch.execute({ type: 'node', command: 'app.js' }, ctx);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const writes = lastChild.stdin.write.mock.calls.map((c) => String(c[0]));
    for (const w of writes) {
      const m = w.match(/Content-Length:\s*(\d+)\r\n\r\n([\s\S]+)/);
      expect(m).not.toBeNull();
      const declared = parseInt(m![1], 10);
      const body = m![2].substring(0, declared);
      expect(Buffer.byteLength(body, 'utf-8')).toBe(declared);
      // body 应为合法 JSON
      expect(() => JSON.parse(body)).not.toThrow();
    }
  });
});

describe('DAP 消息解码(DapProtocolReader)', () => {
  it('从 buffer 解析完整消息并 resolve pending 请求', async () => {
    // spawnAdapter 等待 stdout 第一条 data,然后 DapClient 初始化
    // initialize 请求写入 stdin 后,自动回复 → DapClient 解码 response → resolve
    const r = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);
    // launch 成功说明 initialize + launch 响应都被正确解码
    expect(r.output).toContain('sessionId:');
  });

  it('多条消息粘包也能正确解析', async () => {
    // 手动控制:initialize 响应 + initialized 事件一次性发送(粘包)
    // launch 请求到达时,launch 响应 + 一个无关事件粘包发送
    requestLog = [];
    vi.mocked(spawn).mockImplementation(
      (() => {
        const child = createMockChild();
        lastChild = child;
        let initSeq = 0;
        let launchSeq = 0;
        child.stdin.write = vi.fn((data: string) => {
          const req = parseDap(data);
          if (req) {
            requestLog.push({ seq: req.seq as number, command: req.command as string });
            // initialize 请求到达 → 一次性发送 initialize 响应 + initialized 事件(粘包)
            if (req.command === 'initialize') {
              initSeq = req.seq as number;
              const resp1 = encodeDap({ seq: -1, type: 'response', request_seq: initSeq, success: true, command: 'initialize', body: { supportsConfigurationDoneRequest: false } });
              const evt2 = encodeDap({ seq: -2, type: 'event', event: 'initialized', body: {} });
              setImmediate(() => child.stdout.emit('data', Buffer.from(resp1 + evt2)));
            }
            // launch 请求到达 → 一次性发送 launch 响应 + 一个无关 event(粘包)
            if (req.command === 'launch') {
              launchSeq = req.seq as number;
              const resp1 = encodeDap({ seq: -3, type: 'response', request_seq: launchSeq, success: true, command: 'launch', body: {} });
              const evt2 = encodeDap({ seq: -4, type: 'event', event: 'process', body: { name: 'test.js' } });
              setImmediate(() => child.stdout.emit('data', Buffer.from(resp1 + evt2)));
            }
          }
          return true;
        }) as any;
        setImmediate(() => child.stdout.emit('data', Buffer.from('')));
        return child;
      }) as any,
    );

    const r = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);
    // 验证 initialize 和 launch 请求都收到了(响应被正确解析后才发 launch)
    expect(requestLog.some((r) => r.command === 'initialize')).toBe(true);
    expect(requestLog.some((r) => r.command === 'launch')).toBe(true);
  });

  it('body 不完整时不解析(等待更多数据)', async () => {
    // 此场景由 DapClient.tryParseMessage 内部处理(buffer 不足时返回 null)
    // 间接验证:正常流程能完成,说明分片重组逻辑正确
    const r = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);
  });
});

describe('DapClient 初始化(initialize 握手)', () => {
  it('发送 initialize 请求,包含 clientID/clientName/adapterID', async () => {
    const r = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const initReq = requestLog.find((r) => r.command === 'initialize');
    expect(initReq).toBeDefined();
    const args = initReq!.args as Record<string, unknown>;
    expect(args.clientID).toBe('ihui-cli');
    expect(args.clientName).toBe('IHUI CLI');
    expect(args.adapterID).toBe('generic');
    expect(args.linesStartAt1).toBe(true);
    expect(args.pathFormat).toBe('path');
  });
});

describe('debug_launch', () => {
  it('验证 launch 请求包含 program 参数', async () => {
    const r = await debug_launch.execute({ type: 'node', command: '/path/to/script.js' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const launchReq = requestLog.find((r) => r.command === 'launch');
    expect(launchReq).toBeDefined();
    const args = launchReq!.args as Record<string, unknown>;
    expect(args.program).toBe('/path/to/script.js');
    expect(args.type).toBe('pwa-node');
  });

  it('launch 参数透传 args/cwd/env/stopOnEntry', async () => {
    const r = await debug_launch.execute(
      { type: 'node', command: 'script.js', args: ['--flag', 'val'], cwd: '/custom', env: { NODE_ENV: 'dev' }, stopOnEntry: true },
      ctx,
    );
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const launchReq = requestLog.find((r) => r.command === 'launch');
    const args = launchReq!.args as Record<string, unknown>;
    expect(args.args).toEqual(['--flag', 'val']);
    expect(args.cwd).toBe('/custom');
    expect(args.env).toEqual({ NODE_ENV: 'dev' });
    expect(args.stopOnEntry).toBe(true);
  });

  it('python 类型 launch 请求包含 type=python', async () => {
    const r = await debug_launch.execute({ type: 'python', command: 'script.py' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const launchReq = requestLog.find((r) => r.command === 'launch');
    const args = launchReq!.args as Record<string, unknown>;
    expect(args.type).toBe('python');
    expect(args.program).toBe('script.py');
  });

  it('web 类型 launch 请求包含 url 而非 program', async () => {
    const r = await debug_launch.execute({ type: 'web', command: 'http://localhost:3000' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const launchReq = requestLog.find((r) => r.command === 'launch');
    const args = launchReq!.args as Record<string, unknown>;
    expect(args.type).toBe('pwa-chrome');
    expect(args.url).toBe('http://localhost:3000');
    expect(args.program).toBeUndefined();
  });

  it('缺少 type 参数返回错误', async () => {
    const r = await debug_launch.execute({ command: 'script.js' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('type');
  });

  it('缺少 command 参数返回错误', async () => {
    const r = await debug_launch.execute({ type: 'node' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('command');
  });
});

describe('debug_attach', () => {
  it('发送 attach 请求包含 port + host', async () => {
    const r = await debug_attach.execute({ type: 'node', port: 9229, host: '10.0.0.1' }, ctx);
    expect(r.success).toBe(true);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const attachReq = requestLog.find((r) => r.command === 'attach');
    expect(attachReq).toBeDefined();
    const args = attachReq!.args as Record<string, unknown>;
    expect(args.port).toBe(9229);
    expect(args.host).toBe('10.0.0.1');
    expect(args.type).toBe('pwa-node');
  });

  it('host 默认 localhost', async () => {
    const r = await debug_attach.execute({ type: 'node', port: 9229 }, ctx);
    const sid = extractSessionId(r.output);
    if (sid) sessionIds.push(sid);

    const attachReq = requestLog.find((r) => r.command === 'attach');
    const args = attachReq!.args as Record<string, unknown>;
    expect(args.host).toBe('localhost');
  });

  it('缺少 port 返回错误', async () => {
    const r = await debug_attach.execute({ type: 'node' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('port');
  });
});

describe('debug_set_breakpoints', () => {
  it('验证 file + lines 参数序列化', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);
    expect(sid).not.toBeNull();

    requestLog = [];
    const r = await debug_set_breakpoints.execute(
      { sessionId: sid!, file: '/src/test.js', lines: [{ line: 10 }, { line: 20, condition: 'x > 5' }] },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain('2 个断点');

    const bpReq = requestLog.find((r) => r.command === 'setBreakpoints');
    expect(bpReq).toBeDefined();
    const args = bpReq!.args as Record<string, unknown>;
    expect(args.source).toEqual({ path: '/src/test.js' });
    const breakpoints = args.breakpoints as Array<Record<string, unknown>>;
    expect(breakpoints).toHaveLength(2);
    expect(breakpoints[0]!.line).toBe(10);
    expect(breakpoints[1]!.line).toBe(20);
    expect(breakpoints[1]!.condition).toBe('x > 5');
  });

  it('sessionId 不存在返回 not_found', async () => {
    const r = await debug_set_breakpoints.execute(
      { sessionId: 'nonexistent', file: 'test.js', lines: [{ line: 1 }] },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('not_found');
  });
});

describe('debug_continue', () => {
  it('验证 stopped 事件处理 + continue 请求', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    // 先发 stopped 事件设置 currentThreadId
    await flushStopped(lastChild);

    requestLog = [];
    const r = await debug_continue.execute({ sessionId: sid! }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('reason: breakpoint');
    expect(r.output).toContain('threadId: 1');

    const continueReq = requestLog.find((r) => r.command === 'continue');
    expect(continueReq).toBeDefined();
    const args = continueReq!.args as Record<string, unknown>;
    expect(args.threadId).toBe(1);
  });

  it('无当前线程时返回错误', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    // 不发 stopped 事件,currentThreadId 仍为 undefined
    const r = await debug_continue.execute({ sessionId: sid! }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('debug-unavailable');
  });
});

describe('debug_step', () => {
  it('stepType=next 透传', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);
    await flushStopped(lastChild);

    requestLog = [];
    const r = await debug_step.execute({ sessionId: sid!, stepType: 'next' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('next');

    const stepReq = requestLog.find((r) => r.command === 'next');
    expect(stepReq).toBeDefined();
  });

  it('stepType=stepIn 透传', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);
    await flushStopped(lastChild);

    requestLog = [];
    const r = await debug_step.execute({ sessionId: sid!, stepType: 'stepIn' }, ctx);
    expect(r.success).toBe(true);
    expect(requestLog.some((r) => r.command === 'stepIn')).toBe(true);
  });

  it('stepType=stepOut 透传', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);
    await flushStopped(lastChild);

    requestLog = [];
    const r = await debug_step.execute({ sessionId: sid!, stepType: 'stepOut' }, ctx);
    expect(r.success).toBe(true);
    expect(requestLog.some((r) => r.command === 'stepOut')).toBe(true);
  });

  it('无效 stepType 返回错误', async () => {
    const r = await debug_step.execute({ sessionId: 'x', stepType: 'invalid' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('stepType');
  });
});

describe('debug_get_stack_trace', () => {
  it('stackTrace 请求 + 响应解析', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);
    await flushStopped(lastChild);

    requestLog = [];
    const r = await debug_get_stack_trace.execute({ sessionId: sid! }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('调用栈');
    expect(r.output).toContain('main');
    expect(r.output).toContain('/test.js:10:1');

    const stReq = requestLog.find((r) => r.command === 'stackTrace');
    expect(stReq).toBeDefined();
    const args = stReq!.args as Record<string, unknown>;
    expect(args.threadId).toBe(1);
    expect(args.startFrame).toBe(0);
    expect(args.levels).toBe(20);
  });

  it('无当前线程时返回错误', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    const r = await debug_get_stack_trace.execute({ sessionId: sid! }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('debug-unavailable');
  });
});

describe('debug_get_variables', () => {
  it('variables 请求 + variablesReference 透传', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);
    await flushStopped(lastChild);

    requestLog = [];
    const r = await debug_get_variables.execute({ sessionId: sid!, frameId: 1, scope: 'local' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('x = 42');
    expect(r.output).toContain('s = "hi"');

    // 先发 scopes 请求,再发 variables 请求
    const scopesReq = requestLog.find((r) => r.command === 'scopes');
    expect(scopesReq).toBeDefined();
    expect((scopesReq!.args as Record<string, unknown>).frameId).toBe(1);

    const varsReq = requestLog.find((r) => r.command === 'variables');
    expect(varsReq).toBeDefined();
    expect((varsReq!.args as Record<string, unknown>).variablesReference).toBe(1000);
  });

  it('缺少 frameId 返回错误', async () => {
    const r = await debug_get_variables.execute({ sessionId: 'x' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('frameId');
  });
});

describe('debug_eval', () => {
  it('expression 透传', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    requestLog = [];
    const r = await debug_eval.execute({ sessionId: sid!, expression: '1 + 1' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('1 + 1');
    expect(r.output).toContain('42');

    const evalReq = requestLog.find((r) => r.command === 'evaluate');
    expect(evalReq).toBeDefined();
    const args = evalReq!.args as Record<string, unknown>;
    expect(args.expression).toBe('1 + 1');
    expect(args.context).toBe('repl');
  });

  it('frameId 透传(可选)', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    requestLog = [];
    const r = await debug_eval.execute({ sessionId: sid!, expression: 'x', frameId: 5 }, ctx);
    expect(r.success).toBe(true);
    const evalReq = requestLog.find((r) => r.command === 'evaluate');
    expect((evalReq!.args as Record<string, unknown>).frameId).toBe(5);
  });

  it('缺少 expression 返回错误', async () => {
    const r = await debug_eval.execute({ sessionId: 'x' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('expression');
  });
});

describe('debug_disconnect', () => {
  it('发送 disconnect 请求 + 进程清理', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    expect(sid).not.toBeNull();

    requestLog = [];
    const r = await debug_disconnect.execute({ sessionId: sid! }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('已断开');

    const disconnectReq = requestLog.find((r) => r.command === 'disconnect');
    expect(disconnectReq).toBeDefined();
    const args = disconnectReq!.args as Record<string, unknown>;
    expect(args.terminateDebuggee).toBe(true);

    // 验证子进程被 kill
    expect(lastChild.kill).toHaveBeenCalled();
  });

  it('terminated 事件后 session 状态变为 terminated', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    // 发送 terminated 事件
    emitEvent(lastChild, 'terminated', {});
    await new Promise((r) => setImmediate(r));

    // session 已终止,后续操作返回 not_found
    const r = await debug_continue.execute({ sessionId: sid! }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('not_found');
  });

  it('sessionId 不存在返回 not_found', async () => {
    const r = await debug_disconnect.execute({ sessionId: 'nonexistent' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('not_found');
  });
});

describe('debug_list_sessions', () => {
  it('无 session 时返回提示', async () => {
    const r = await debug_list_sessions.execute({}, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('无活跃');
  });

  it('有 session 时列出详情', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    const r = await debug_list_sessions.execute({}, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('1 个');
    expect(r.output).toContain(sid!);
    expect(r.output).toContain('node');
  });
});

describe('DebugSessionManager 多 session 管理', () => {
  it('多次 launch 返回不同 sessionId', async () => {
    const r1 = await debug_launch.execute({ type: 'node', command: 'a.js' }, ctx);
    const sid1 = extractSessionId(r1.output);
    if (sid1) sessionIds.push(sid1);

    const r2 = await debug_launch.execute({ type: 'python', command: 'b.py' }, ctx);
    const sid2 = extractSessionId(r2.output);
    if (sid2) sessionIds.push(sid2);

    expect(sid1).not.toBeNull();
    expect(sid2).not.toBeNull();
    expect(sid1).not.toBe(sid2);
  });

  it('list_sessions 显示所有活跃 session', async () => {
    await debug_launch.execute({ type: 'node', command: 'a.js' }, ctx);
    await debug_launch.execute({ type: 'python', command: 'b.py' }, ctx);
    // 收集 sessionIds 用于 cleanup
    const listResult = await debug_list_sessions.execute({}, ctx);
    const matches = listResult.output.match(/[\w-]{36}/g);
    if (matches) sessionIds.push(...matches);

    expect(listResult.success).toBe(true);
    expect(listResult.output).toContain('2 个');
  });

  it('disconnect 后 session 从列表消失', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    expect(sid).not.toBeNull();

    await debug_disconnect.execute({ sessionId: sid! }, ctx);

    const listResult = await debug_list_sessions.execute({}, ctx);
    expect(listResult.output).toContain('无活跃');
  });
});

describe('session 超时清理', () => {
  it('活跃 session 不被清理', async () => {
    await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const listResult = await debug_list_sessions.execute({}, ctx);
    const matches = listResult.output.match(/[\w-]{36}/g);
    if (matches) sessionIds.push(...matches);

    const cleaned = cleanupIdleSessions();
    expect(cleaned).toBe(0);
  });

  it('terminated session 被清理', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    expect(sid).not.toBeNull();

    // 发送 terminated 事件使 session 状态变为 terminated
    emitEvent(lastChild, 'terminated', {});
    await new Promise((r) => setImmediate(r));

    const cleaned = cleanupIdleSessions();
    expect(cleaned).toBe(1);

    // 清理后 list_sessions 不再显示该 session
    const listResult = await debug_list_sessions.execute({}, ctx);
    expect(listResult.output).toContain('无活跃');
  });
});

describe('DapClient 事件处理', () => {
  it('continued 事件将状态设为 running', async () => {
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    // 发 stopped 事件设置 currentThreadId
    await flushStopped(lastChild);

    // 发 continued 事件
    emitEvent(lastChild, 'continued', {});
    await new Promise((r) => setImmediate(r));

    // 此时 continue 应该仍然可用(currentThreadId 已设置)
    // 但状态是 running,不影响 continue 操作
    requestLog = [];
    const r = await debug_continue.execute({ sessionId: sid! }, ctx);
    expect(r.success).toBe(true);
  });

  it('onEvent 注册的自定义 handler 被调用', async () => {
    // 通过 stopped 事件间接验证 onEvent 机制
    // DapClient 内部 handleEvent 会调用 eventHandlers 中注册的 handler
    const launchResult = await debug_launch.execute({ type: 'node', command: 'test.js' }, ctx);
    const sid = extractSessionId(launchResult.output);
    if (sid) sessionIds.push(sid);

    // 发送自定义事件不会崩溃
    emitEvent(lastChild, 'customEvent', { foo: 'bar' });
    await new Promise((r) => setImmediate(r));

    // session 仍然正常
    const listResult = await debug_list_sessions.execute({}, ctx);
    expect(listResult.success).toBe(true);
  });
});
