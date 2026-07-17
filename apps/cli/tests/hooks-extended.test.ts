/**
 * Hooks 扩展事件测试 — 14 种事件枚举 + preCompact/postCompact 集成 + HookContext 字段传递。
 *
 * 覆盖范围:
 *   - HookEvent 14 种事件类型完整性(类型 + 运行时)
 *   - runHook 异常安全(无配置 / 未知事件不抛异常)
 *   - compressContextIfNeeded 触发压缩时调用 preCompact/postCompact
 *   - HookContext 新增字段(compactedTokensBefore/After)通过环境变量正确传递
 *   - deepMergeHooks 合并 14 种事件键
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  runHook,
  deepMergeHooks,
  type HookEvent,
  type HookContext,
  type HooksConfig,
} from '../src/hooks/index.js';
import { compressContextIfNeeded, type ChatMessage } from '../src/context.js';

const isWindows = process.platform === 'win32';

const ALL_EVENTS: HookEvent[] = [
  'preToolCall', 'postToolCall', 'sessionStart', 'sessionEnd',
  'userPromptSubmit', 'preCompact', 'postCompact', 'notification',
  'stop', 'stopFailure', 'postToolUseFailure', 'permissionDenied',
  'subagentStart', 'subagentStop',
];

describe('HookEvent 类型完整性', () => {
  it('应支持 14 种事件类型(4 原有 + 10 新增)', () => {
    expect(ALL_EVENTS).toHaveLength(14);
  });

  it('14 种事件类型无重复', () => {
    expect(new Set(ALL_EVENTS).size).toBe(14);
  });

  it('包含原有 4 种事件', () => {
    const legacy: HookEvent[] = ['preToolCall', 'postToolCall', 'sessionStart', 'sessionEnd'];
    for (const e of legacy) {
      expect(ALL_EVENTS).toContain(e);
    }
  });

  it('包含新增 10 种事件', () => {
    const added: HookEvent[] = [
      'userPromptSubmit', 'preCompact', 'postCompact', 'notification',
      'stop', 'stopFailure', 'postToolUseFailure', 'permissionDenied',
      'subagentStart', 'subagentStop',
    ];
    expect(added).toHaveLength(10);
    for (const e of added) {
      expect(ALL_EVENTS).toContain(e);
    }
  });
});

describe('runHook 异常安全', () => {
  let origConfig: string | undefined;

  beforeEach(() => {
    origConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'nonexistent-ihui-hooks-' + Date.now() + '.json');
  });

  afterEach(() => {
    if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origConfig;
  });

  it('无配置时所有 14 种事件均返回 proceed=true', () => {
    for (const e of ALL_EVENTS) {
      const result = runHook(e, {});
      expect(result.proceed).toBe(true);
      expect(result.reason).toBeUndefined();
    }
  });

  it('未知事件类型不抛异常且返回 proceed=true', () => {
    const unknown = 'unknownEvent' as HookEvent;
    expect(() => runHook(unknown, {})).not.toThrow();
    expect(runHook(unknown, {}).proceed).toBe(true);
  });

  it('HookContext 全字段传入不抛异常', () => {
    const ctx: HookContext = {
      workspacePath: '/tmp',
      sessionId: 'sess-1',
      toolName: 'bash',
      toolArgs: { cmd: 'ls' },
      toolResult: 'output',
      prompt: 'hello',
      error: 'oops',
      reason: 'denied',
      subagentId: 'sub-1',
      subagentType: 'search',
      compactedTokensBefore: 100,
      compactedTokensAfter: 50,
      notificationText: 'notify',
    };
    for (const e of ALL_EVENTS) {
      expect(() => runHook(e, ctx)).not.toThrow();
    }
  });
});

describe('compressContextIfNeeded 集成 preCompact/postCompact', () => {
  let tmpDir: string;
  let markerPath: string;
  let hooksPath: string;
  let origConfig: string | undefined;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-hooks-ext-'));
    markerPath = path.join(tmpDir, 'marker.txt');
    hooksPath = path.join(tmpDir, 'hooks.json');
    const echoPre = isWindows
      ? `cmd /c echo pre > "${markerPath}"`
      : `sh -c 'echo pre > "${markerPath}"'`;
    const echoPost = isWindows
      ? `cmd /c echo post >> "${markerPath}"`
      : `sh -c 'echo post >> "${markerPath}"'`;
    const hooks: HooksConfig = {
      preCompact: [{ name: 'mark-pre', command: echoPre, blockOnError: false }],
      postCompact: [{ name: 'mark-post', command: echoPost, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    origConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = hooksPath;
    try { fs.unlinkSync(markerPath); } catch { /* 文件不存在忽略 */ }
  });

  afterEach(() => {
    if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origConfig;
  });

  function buildLargeMessages(count: number): ChatMessage[] {
    const msgs: ChatMessage[] = [{ role: 'system', content: 'system prompt' }];
    for (let i = 0; i < count; i++) {
      msgs.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with content for token generation. `.repeat(10),
      });
    }
    return msgs;
  }

  it('触发压缩时执行 preCompact 和 postCompact 钩子', () => {
    const messages = buildLargeMessages(20);
    const result = compressContextIfNeeded(messages, { contextLimit: 500 });

    expect(result.compressed).toBe(true);
    expect(fs.existsSync(markerPath)).toBe(true);
    const content = fs.readFileSync(markerPath, 'utf-8');
    expect(content).toContain('pre');
    expect(content).toContain('post');
  });

  it('未触发压缩时不执行 preCompact/postCompact 钩子', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'short' },
      { role: 'user', content: 'hi' },
    ];
    const result = compressContextIfNeeded(messages, { contextLimit: 100000 });

    expect(result.compressed).toBe(false);
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('preCompact 在 postCompact 之前执行(marker 顺序为 pre 在前)', () => {
    const messages = buildLargeMessages(20);
    compressContextIfNeeded(messages, { contextLimit: 500 });

    const content = fs.readFileSync(markerPath, 'utf-8');
    const preIdx = content.indexOf('pre');
    const postIdx = content.indexOf('post');
    expect(preIdx).toBeGreaterThanOrEqual(0);
    expect(postIdx).toBeGreaterThan(preIdx);
  });
});

describe('HookContext 字段传递', () => {
  let tmpDir: string;
  let envPath: string;
  let hooksPath: string;
  let origConfig: string | undefined;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-hooks-ctx-'));
    envPath = path.join(tmpDir, 'env.txt');
    hooksPath = path.join(tmpDir, 'hooks.json');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    origConfig = process.env.IHUI_HOOKS_CONFIG;
    try { fs.unlinkSync(envPath); } catch { /* 忽略 */ }
  });

  afterEach(() => {
    if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origConfig;
  });

  it('compactedTokensBefore/After 通过环境变量传递给 postCompact 钩子', () => {
    const cmd = isWindows
      ? `cmd /c echo %IHUI_COMPACTED_TOKENS_BEFORE%/%IHUI_COMPACTED_TOKENS_AFTER% > "${envPath}"`
      : `sh -c 'echo "$IHUI_COMPACTED_TOKENS_BEFORE/$IHUI_COMPACTED_TOKENS_AFTER" > "${envPath}"'`;
    const hooks: HooksConfig = {
      postCompact: [{ name: 'capture-ctx', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    runHook('postCompact', {
      compactedTokensBefore: 12345,
      compactedTokensAfter: 6789,
    });

    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf-8').trim();
    expect(content).toContain('12345');
    expect(content).toContain('6789');
  });

  it('compressContextIfNeeded 传递真实的 token 数值给钩子', () => {
    const cmd = isWindows
      ? `cmd /c echo %IHUI_COMPACTED_TOKENS_BEFORE%/%IHUI_COMPACTED_TOKENS_AFTER% > "${envPath}"`
      : `sh -c 'echo "$IHUI_COMPACTED_TOKENS_BEFORE/$IHUI_COMPACTED_TOKENS_AFTER" > "${envPath}"'`;
    const hooks: HooksConfig = {
      postCompact: [{ name: 'capture-tokens', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'system prompt' },
      ...Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i} with content for token generation. `.repeat(10),
      })),
    ];
    const result = compressContextIfNeeded(messages, { contextLimit: 500 });

    expect(result.compressed).toBe(true);
    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf-8').trim();
    const parts = content.split('/').map((s) => s.trim());
    expect(Number(parts[0])).toBe(result.originalTokens);
    expect(Number(parts[1])).toBe(result.compressedTokens);
  });

  it('workspacePath/sessionId 通过环境变量传递', () => {
    const cmd = isWindows
      ? `cmd /c echo %IHUI_WORKSPACE%/%IHUI_SESSION_ID% > "${envPath}"`
      : `sh -c 'echo "$IHUI_WORKSPACE/$IHUI_SESSION_ID" > "${envPath}"'`;
    const hooks: HooksConfig = {
      preCompact: [{ name: 'capture-ws', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    runHook('preCompact', {
      workspacePath: '/my/workspace',
      sessionId: 'sess-abc',
      compactedTokensBefore: 100,
    });

    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf-8').trim();
    expect(content).toContain('/my/workspace');
    expect(content).toContain('sess-abc');
  });
});

describe('deepMergeHooks 新事件键合并', () => {
  it('合并新增事件键(preCompact/postCompact/subagentStart 等)', () => {
    const a: HooksConfig = {
      preCompact: [{ name: 'a-pre-compact' }],
      postCompact: [{ name: 'a-post-compact' }],
      subagentStart: [{ name: 'a-sub-start' }],
    };
    const b: HooksConfig = {
      preCompact: [{ name: 'b-pre-compact' }],
      subagentStop: [{ name: 'b-sub-stop' }],
      notification: [{ name: 'b-notify' }],
    };
    const merged = deepMergeHooks(a, b);

    expect(merged.preCompact).toHaveLength(2);
    expect(merged.preCompact?.[0].name).toBe('a-pre-compact');
    expect(merged.preCompact?.[1].name).toBe('b-pre-compact');
    expect(merged.postCompact).toHaveLength(1);
    expect(merged.subagentStart).toHaveLength(1);
    expect(merged.subagentStop).toHaveLength(1);
    expect(merged.notification).toHaveLength(1);
  });

  it('仅一边存在的新事件键被保留', () => {
    const a: HooksConfig = {
      stop: [{ name: 'a-stop' }],
      stopFailure: [{ name: 'a-stop-fail' }],
    };
    const b: HooksConfig = {};
    const merged = deepMergeHooks(a, b);

    expect(merged.stop).toHaveLength(1);
    expect(merged.stop?.[0].name).toBe('a-stop');
    expect(merged.stopFailure).toHaveLength(1);
  });

  it('原有事件键合并不受影响(回归)', () => {
    const a: HooksConfig = {
      preToolCall: [{ name: 'a-pre-tool' }],
      sessionStart: [{ name: 'a-session-start' }],
    };
    const b: HooksConfig = {
      preToolCall: [{ name: 'b-pre-tool' }],
      sessionEnd: [{ name: 'b-session-end' }],
    };
    const merged = deepMergeHooks(a, b);

    expect(merged.preToolCall).toHaveLength(2);
    expect(merged.sessionStart).toHaveLength(1);
    expect(merged.sessionEnd).toHaveLength(1);
  });
});
