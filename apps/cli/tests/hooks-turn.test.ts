/**
 * P2-4 agent-lifecycle + hooks 深化测试 — Turn 级事件 + Plugin 扩展点。
 *
 * 覆盖范围:
 *   - HookEvent 新增 4 种 Turn 级事件(turnStart/turnEnd/turnError/turnComplete)
 *   - runHook 触发 Turn 级事件钩子(命令成功/失败)
 *   - Turn 级环境变量传递(IHUI_TURN_NUMBER / IHUI_MAX_TURNS / IHUI_TOTAL_TURNS / IHUI_STOP_REASON)
 *   - deepMergeHooks 合并 Turn 级事件键
 *   - PluginRegistry 新增 turnInputContributors / commandContributors 扩展点
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
import { PluginRegistry } from '../src/plugins/registry.js';
import type { PluginDefinition, TurnContributorContext } from '../src/plugins/types.js';

const isWindows = process.platform === 'win32';
const exit1 = isWindows ? 'cmd /c exit 1' : "sh -c 'exit 1'";

const TURN_EVENTS: HookEvent[] = ['turnStart', 'turnEnd', 'turnError', 'turnComplete'];

describe('P2-4 HookEvent Turn 级事件类型完整性', () => {
  it('应支持 4 种 Turn 级事件', () => {
    expect(TURN_EVENTS).toHaveLength(4);
  });

  it('4 种事件类型无重复', () => {
    expect(new Set(TURN_EVENTS).size).toBe(4);
  });

  it('HookEvent 类型应包含 Turn 级事件(编译时检查)', () => {
    // 运行时验证:赋值给 HookEvent 类型的数组不报错
    const events: HookEvent[] = ['turnStart', 'turnEnd', 'turnError', 'turnComplete'];
    expect(events).toHaveLength(4);
  });
});

describe('P2-4 runHook Turn 级事件触发', () => {
  let tmpDir: string;
  let markerPath: string;
  let hooksPath: string;
  let origConfig: string | undefined;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-hooks-turn-'));
    markerPath = path.join(tmpDir, 'marker.txt');
    hooksPath = path.join(tmpDir, 'hooks.json');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    origConfig = process.env.IHUI_HOOKS_CONFIG;
    try { fs.unlinkSync(markerPath); } catch { /* 忽略 */ }
  });

  afterEach(() => {
    if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origConfig;
  });

  it('turnStart 事件触发钩子(命令成功 → proceed=true)', () => {
    const cmd = isWindows
      ? `cmd /c echo start > "${markerPath}"`
      : `sh -c 'echo start > "${markerPath}"'`;
    const hooks: HooksConfig = {
      turnStart: [{ name: 'mark-start', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    const result = runHook('turnStart', { turnNumber: 1, maxTurns: 5 });
    expect(result.proceed).toBe(true);
    expect(fs.existsSync(markerPath)).toBe(true);
    expect(fs.readFileSync(markerPath, 'utf-8')).toContain('start');
  });

  it('turnEnd 事件触发钩子(命令成功 → proceed=true)', () => {
    const cmd = isWindows
      ? `cmd /c echo end > "${markerPath}"`
      : `sh -c 'echo end > "${markerPath}"'`;
    const hooks: HooksConfig = {
      turnEnd: [{ name: 'mark-end', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    const result = runHook('turnEnd', { turnNumber: 2 });
    expect(result.proceed).toBe(true);
    expect(fs.existsSync(markerPath)).toBe(true);
    expect(fs.readFileSync(markerPath, 'utf-8')).toContain('end');
  });

  it('turnError 事件触发钩子(默认不阻塞,proceed=true)', () => {
    const hooks: HooksConfig = {
      turnError: [{ name: 'err-hook', command: exit1 }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    // turnError 默认 blockOnError=false(非 preToolCall/sessionStart)
    const result = runHook('turnError', { turnNumber: 1, error: 'oops' });
    expect(result.proceed).toBe(true);
  });

  it('turnError 事件 blockOnError=true 时命令失败阻塞(proceed=false)', () => {
    const hooks: HooksConfig = {
      turnError: [{ name: 'err-block', command: exit1, blockOnError: true }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    const result = runHook('turnError', { turnNumber: 1, error: 'oops' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('err-block');
  });

  it('turnComplete 事件触发钩子(默认不阻塞,proceed=true)', () => {
    const cmd = isWindows
      ? `cmd /c echo complete > "${markerPath}"`
      : `sh -c 'echo complete > "${markerPath}"'`;
    const hooks: HooksConfig = {
      turnComplete: [{ name: 'mark-complete', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    const result = runHook('turnComplete', { totalTurns: 3, stopReason: 'end_turn' });
    expect(result.proceed).toBe(true);
    expect(fs.existsSync(markerPath)).toBe(true);
    expect(fs.readFileSync(markerPath, 'utf-8')).toContain('complete');
  });

  it('无配置时 4 种 Turn 级事件均返回 proceed=true', () => {
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'nonexistent-turn-hooks-' + Date.now() + '.json');
    for (const e of TURN_EVENTS) {
      const result = runHook(e, { turnNumber: 1 });
      expect(result.proceed).toBe(true);
      expect(result.reason).toBeUndefined();
    }
  });

  it('Turn 级事件全字段传入不抛异常', () => {
    const ctx: HookContext = {
      workspacePath: '/tmp',
      sessionId: 'sess-1',
      turnNumber: 2,
      maxTurns: 10,
      totalTurns: 5,
      stopReason: 'end_turn',
      error: 'some error',
    };
    for (const e of TURN_EVENTS) {
      expect(() => runHook(e, ctx)).not.toThrow();
    }
  });
});

describe('P2-4 Turn 级环境变量传递', () => {
  let tmpDir: string;
  let envPath: string;
  let hooksPath: string;
  let origConfig: string | undefined;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-hooks-turn-env-'));
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

  it('turnNumber/maxTurns 通过 IHUI_TURN_NUMBER/IHUI_MAX_TURNS 传递给 turnStart 钩子', () => {
    const cmd = isWindows
      ? `cmd /c echo %IHUI_TURN_NUMBER%/%IHUI_MAX_TURNS% > "${envPath}"`
      : `sh -c 'echo "$IHUI_TURN_NUMBER/$IHUI_MAX_TURNS" > "${envPath}"'`;
    const hooks: HooksConfig = {
      turnStart: [{ name: 'capture-turn', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    runHook('turnStart', { turnNumber: 3, maxTurns: 10 });

    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf-8').trim();
    expect(content).toContain('3');
    expect(content).toContain('10');
  });

  it('totalTurns/stopReason 通过 IHUI_TOTAL_TURNS/IHUI_STOP_REASON 传递给 turnComplete 钩子', () => {
    const cmd = isWindows
      ? `cmd /c echo %IHUI_TOTAL_TURNS%/%IHUI_STOP_REASON% > "${envPath}"`
      : `sh -c 'echo "$IHUI_TOTAL_TURNS/$IHUI_STOP_REASON" > "${envPath}"'`;
    const hooks: HooksConfig = {
      turnComplete: [{ name: 'capture-complete', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    runHook('turnComplete', { totalTurns: 7, stopReason: 'max_iterations' });

    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf-8').trim();
    expect(content).toContain('7');
    expect(content).toContain('max_iterations');
  });

  it('error 通过 IHUI_ERROR 传递给 turnError 钩子', () => {
    const cmd = isWindows
      ? `cmd /c echo %IHUI_ERROR% > "${envPath}"`
      : `sh -c 'echo "$IHUI_ERROR" > "${envPath}"'`;
    const hooks: HooksConfig = {
      turnError: [{ name: 'capture-err', command: cmd, blockOnError: false }],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks));
    process.env.IHUI_HOOKS_CONFIG = hooksPath;

    runHook('turnError', { turnNumber: 1, error: 'sample-error' });

    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf-8').trim();
    expect(content).toContain('sample-error');
  });
});

describe('P2-4 deepMergeHooks Turn 级事件键合并', () => {
  it('合并 Turn 级事件键(turnStart/turnEnd/turnError/turnComplete)', () => {
    const a: HooksConfig = {
      turnStart: [{ name: 'a-turn-start' }],
      turnEnd: [{ name: 'a-turn-end' }],
    };
    const b: HooksConfig = {
      turnStart: [{ name: 'b-turn-start' }],
      turnError: [{ name: 'b-turn-error' }],
      turnComplete: [{ name: 'b-turn-complete' }],
    };
    const merged = deepMergeHooks(a, b);

    expect(merged.turnStart).toHaveLength(2);
    expect(merged.turnStart?.[0].name).toBe('a-turn-start');
    expect(merged.turnStart?.[1].name).toBe('b-turn-start');
    expect(merged.turnEnd).toHaveLength(1);
    expect(merged.turnEnd?.[0].name).toBe('a-turn-end');
    expect(merged.turnError).toHaveLength(1);
    expect(merged.turnError?.[0].name).toBe('b-turn-error');
    expect(merged.turnComplete).toHaveLength(1);
    expect(merged.turnComplete?.[0].name).toBe('b-turn-complete');
  });

  it('仅一边存在的 Turn 级事件键被保留', () => {
    const a: HooksConfig = {
      turnComplete: [{ name: 'a-complete' }],
    };
    const b: HooksConfig = {};
    const merged = deepMergeHooks(a, b);

    expect(merged.turnComplete).toHaveLength(1);
    expect(merged.turnComplete?.[0].name).toBe('a-complete');
  });

  it('原有事件键合并不受影响(回归)', () => {
    const a: HooksConfig = {
      preToolCall: [{ name: 'a-pre-tool' }],
      sessionStart: [{ name: 'a-session-start' }],
      turnStart: [{ name: 'a-turn-start' }],
    };
    const b: HooksConfig = {
      preToolCall: [{ name: 'b-pre-tool' }],
      sessionEnd: [{ name: 'b-session-end' }],
    };
    const merged = deepMergeHooks(a, b);

    expect(merged.preToolCall).toHaveLength(2);
    expect(merged.sessionStart).toHaveLength(1);
    expect(merged.sessionEnd).toHaveLength(1);
    expect(merged.turnStart).toHaveLength(1);
  });
});

describe('P2-4 PluginRegistry Turn 贡献者扩展点', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry({ workingDir: '/tmp/test' });
  });

  describe('getTurnInputContributorExtensions', () => {
    it('无插件时返回空数组', () => {
      expect(registry.getTurnInputContributorExtensions()).toEqual([]);
    });

    it('汇总所有插件的 turnInputContributors 声明(去重)', () => {
      const p1: PluginDefinition = {
        name: 'p1', version: '1.0.0',
        turnInputContributors: ['ctx-loader', 'state-injector'],
      };
      const p2: PluginDefinition = {
        name: 'p2', version: '1.0.0',
        turnInputContributors: ['ctx-loader', 'memory-loader'],
      };
      registry.registerAll([p1, p2]);

      const exts = registry.getTurnInputContributorExtensions();
      expect(exts).toHaveLength(3);
      expect(exts).toContain('ctx-loader');
      expect(exts).toContain('state-injector');
      expect(exts).toContain('memory-loader');
    });

    it('插件未声明 turnInputContributors 时不返回', () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        tools: ['some-tool'],
      };
      registry.register(p);
      expect(registry.getTurnInputContributorExtensions()).toEqual([]);
    });
  });

  describe('getCommandContributorExtensions', () => {
    it('无插件时返回空数组', () => {
      expect(registry.getCommandContributorExtensions()).toEqual([]);
    });

    it('汇总所有插件的 commandContributors 声明(去重)', () => {
      const p1: PluginDefinition = {
        name: 'p1', version: '1.0.0',
        commandContributors: ['lint', 'test'],
      };
      const p2: PluginDefinition = {
        name: 'p2', version: '1.0.0',
        commandContributors: ['lint', 'notify'],
      };
      registry.registerAll([p1, p2]);

      const exts = registry.getCommandContributorExtensions();
      expect(exts).toHaveLength(3);
      expect(exts).toContain('lint');
      expect(exts).toContain('test');
      expect(exts).toContain('notify');
    });
  });

  describe('runTurnInputContributors', () => {
    it('无插件时返回空字符串', async () => {
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const result = await registry.runTurnInputContributors(ctx);
      expect(result).toBe('');
    });

    it('插件未声明 turnInputContributors 时不调用回调,返回空字符串', async () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        tools: ['some-tool'],
        onTurnInputContribute: () => 'should-not-be-called',
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const result = await registry.runTurnInputContributors(ctx);
      expect(result).toBe('');
    });

    it('声明但无回调的插件被跳过(JSON 加载的插件)', async () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        turnInputContributors: ['ctx-loader'],
        // 无 onTurnInputContribute 回调
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const result = await registry.runTurnInputContributors(ctx);
      expect(result).toBe('');
    });

    it('调用有回调的插件,拼接返回值', async () => {
      const p1: PluginDefinition = {
        name: 'p1', version: '1.0.0',
        turnInputContributors: ['ctx-loader'],
        onTurnInputContribute: (ctx) => `ctx-from-p1-turn-${ctx.turnNumber}`,
      };
      const p2: PluginDefinition = {
        name: 'p2', version: '1.0.0',
        turnInputContributors: ['state-injector'],
        onTurnInputContribute: () => 'state-from-p2',
      };
      registry.registerAll([p1, p2]);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 3,
        maxTurns: 5,
      };
      const result = await registry.runTurnInputContributors(ctx);
      expect(result).toContain('ctx-from-p1-turn-3');
      expect(result).toContain('state-from-p2');
      expect(result).toContain('\n\n');
    });

    it('回调返回空字符串/null/undefined 时不注入', async () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        turnInputContributors: ['ctx-loader'],
        onTurnInputContribute: () => '',
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const result = await registry.runTurnInputContributors(ctx);
      expect(result).toBe('');
    });

    it('回调抛异常时不阻塞主流程(返回空字符串)', async () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        turnInputContributors: ['ctx-loader'],
        onTurnInputContribute: () => { throw new Error('callback error'); },
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const result = await registry.runTurnInputContributors(ctx);
      expect(result).toBe('');
    });

    it('回调支持异步返回值', async () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        turnInputContributors: ['ctx-loader'],
        onTurnInputContribute: async (ctx) => {
          await new Promise((r) => setTimeout(r, 10));
          return `async-ctx-turn-${ctx.turnNumber}`;
        },
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 2,
        maxTurns: 5,
      };
      const result = await registry.runTurnInputContributors(ctx);
      expect(result).toContain('async-ctx-turn-2');
    });
  });

  describe('runCommandContributors', () => {
    it('无插件时返回 0', async () => {
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const count = await registry.runCommandContributors(ctx);
      expect(count).toBe(0);
    });

    it('插件未声明 commandContributors 时不调用回调,返回 0', async () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        tools: ['some-tool'],
        onCommandContribute: () => { throw new Error('should not be called'); },
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const count = await registry.runCommandContributors(ctx);
      expect(count).toBe(0);
    });

    it('声明但无回调的插件被跳过,返回 0', async () => {
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        commandContributors: ['lint'],
        // 无 onCommandContribute 回调
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const count = await registry.runCommandContributors(ctx);
      expect(count).toBe(0);
    });

    it('调用有回调的插件,返回调用数', async () => {
      let called1 = false;
      let called2 = false;
      const p1: PluginDefinition = {
        name: 'p1', version: '1.0.0',
        commandContributors: ['lint'],
        onCommandContribute: (ctx) => { called1 = ctx.turnNumber === 1; },
      };
      const p2: PluginDefinition = {
        name: 'p2', version: '1.0.0',
        commandContributors: ['test'],
        onCommandContribute: (ctx) => { called2 = ctx.turnNumber === 1; },
      };
      registry.registerAll([p1, p2]);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const count = await registry.runCommandContributors(ctx);
      expect(count).toBe(2);
      expect(called1).toBe(true);
      expect(called2).toBe(true);
    });

    it('回调抛异常时不阻塞主流程(仍计入调用数前)', async () => {
      const p1: PluginDefinition = {
        name: 'p1', version: '1.0.0',
        commandContributors: ['fail'],
        onCommandContribute: () => { throw new Error('callback error'); },
      };
      const p2: PluginDefinition = {
        name: 'p2', version: '1.0.0',
        commandContributors: ['ok'],
        onCommandContribute: () => undefined,
      };
      registry.registerAll([p1, p2]);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const count = await registry.runCommandContributors(ctx);
      // p1 抛异常被捕获,p2 正常执行,返回 1(p1 失败不计入)
      expect(count).toBe(1);
    });

    it('回调支持异步执行', async () => {
      let executed = false;
      const p: PluginDefinition = {
        name: 'p', version: '1.0.0',
        commandContributors: ['async-cmd'],
        onCommandContribute: async () => {
          await new Promise((r) => setTimeout(r, 10));
          executed = true;
        },
      };
      registry.register(p);
      const ctx: TurnContributorContext = {
        workingDir: '/tmp',
        turnNumber: 1,
        maxTurns: 5,
      };
      const count = await registry.runCommandContributors(ctx);
      expect(count).toBe(1);
      expect(executed).toBe(true);
    });
  });
});
