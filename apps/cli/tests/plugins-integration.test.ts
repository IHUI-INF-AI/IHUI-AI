/**
 * PluginRegistry 集成测试 — 验证 setupAgentTools 接入 PluginRegistry + runPluginHooks 真实调用 runHook。
 *
 * 覆盖:
 *   - settings.plugins.enabled === false(默认):setupAgentTools 不加载 pluginRegistry(零回归)
 *   - 外部注入 pluginRegistry:setupAgentTools 透传给 runToolLoop
 *   - runHook 调用 plugin.onHook(程序化回调)
 *   - runHook 仅声明的插件(JSON 加载)通过 logger.info 记录事件
 *   - onHook 抛异常不阻塞主流程
 *   - loadPlugins + registerAll + runSetups 真实流程
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  PluginRegistry,
  loadPlugins,
  type PluginDefinition,
  type PluginHookContext,
} from '../src/plugins/index.js';

// ==================== runHook 集成测试 ====================

describe('PluginRegistry.runHook 集成', () => {
  let registry: PluginRegistry;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new PluginRegistry({ workingDir: '/tmp' });
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('未注册插件时 runHook 返回 0(不调用 logger)', async () => {
    const n = await registry.runHook('preToolCall', { toolName: 'read_file' });
    expect(n).toBe(0);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('注册带 onHook 的插件:runHook 调用 onHook 回调,返回调用数', async () => {
    const calls: string[] = [];
    registry.register({
      name: 'audit-plugin',
      version: '1.0.0',
      hooks: ['preToolCall'],
      onHook: (event, ctx) => {
        calls.push(`${event}:${ctx.toolName}`);
      },
    });
    const n = await registry.runHook('preToolCall', { toolName: 'write_file' });
    expect(n).toBe(1);
    expect(calls).toEqual(['preToolCall:write_file']);
  });

  it('注册仅声明 hooks 数组(无 onHook)的插件:runHook 通过 logger.info 记录事件', async () => {
    registry.register({
      name: 'declarative-plugin',
      version: '1.0.0',
      hooks: ['preToolCall', 'preToolCall:write_file'],
      // 无 onHook(JSON 加载场景)
    });
    const n = await registry.runHook('preToolCall', { toolName: 'write_file' });
    expect(n).toBe(0); // 无 onHook 回调,返回 0
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const msg = infoSpy.mock.calls[0]![0] as string;
    expect(msg).toContain('declarative-plugin');
    expect(msg).toContain('preToolCall');
  });

  it('runHook 匹配 `${event}:` 前缀(hook 带子标识)', async () => {
    const calls: string[] = [];
    registry.register({
      name: 'filtered-plugin',
      version: '1.0.0',
      hooks: ['preToolCall:write_file'], // 只关心 write_file 的 preToolCall
      onHook: (event) => calls.push(event),
    });
    // 触发 preToolCall:write_file(应匹配)
    await registry.runHook('preToolCall', { toolName: 'write_file' });
    // 触发 preToolCall(应也匹配,因为 startsWith('preToolCall:'))
    await registry.runHook('preToolCall', { toolName: 'read_file' });
    expect(calls).toEqual(['preToolCall', 'preToolCall']);
  });

  it('runHook 不匹配未声明的事件(注册 preToolCall,触发 postToolCall 不调用)', async () => {
    const calls: string[] = [];
    registry.register({
      name: 'pre-only',
      version: '1.0.0',
      hooks: ['preToolCall'],
      onHook: (event) => calls.push(event),
    });
    await registry.runHook('postToolCall', { toolName: 'write_file' });
    expect(calls).toEqual([]);
  });

  it('onHook 抛异常不阻塞:runHook 返回 0(异常的插件不计入 invoked)', async () => {
    registry.register({
      name: 'broken-plugin',
      version: '1.0.0',
      hooks: ['preToolCall'],
      onHook: () => {
        throw new Error('boom');
      },
    });
    registry.register({
      name: 'healthy-plugin',
      version: '1.0.0',
      hooks: ['preToolCall'],
      onHook: () => {},
    });
    const n = await registry.runHook('preToolCall', { toolName: 'write_file' });
    expect(n).toBe(1); // 只有 healthy-plugin 计入
  });

  it('多插件并发 runHook:每个匹配的插件都被调用', async () => {
    const calls: string[] = [];
    registry.register({
      name: 'a',
      version: '1.0.0',
      hooks: ['preToolCall'],
      onHook: () => calls.push('a'),
    });
    registry.register({
      name: 'b',
      version: '1.0.0',
      hooks: ['preToolCall'],
      onHook: () => calls.push('b'),
    });
    registry.register({
      name: 'c',
      version: '1.0.0',
      hooks: ['postToolCall'], // 不匹配 preToolCall
      onHook: () => calls.push('c'),
    });
    const n = await registry.runHook('preToolCall', { toolName: 'x' });
    expect(n).toBe(2);
    expect(calls.sort()).toEqual(['a', 'b']);
  });

  it('runHook 透传 PluginHookContext 字段给 onHook', async () => {
    let receivedCtx: PluginHookContext | undefined;
    registry.register({
      name: 'ctx-plugin',
      version: '1.0.0',
      hooks: ['postToolCall'],
      onHook: (_event, ctx) => {
        receivedCtx = ctx;
      },
    });
    await registry.runHook('postToolCall', {
      toolName: 'edit_file',
      args: { path: 'foo.ts' },
      result: { success: true },
    });
    expect(receivedCtx).toBeDefined();
    expect(receivedCtx!.toolName).toBe('edit_file');
    expect(receivedCtx!.args).toEqual({ path: 'foo.ts' });
    expect(receivedCtx!.result).toEqual({ success: true });
  });
});

// ==================== setupAgentTools 集成测试 ====================

describe('setupAgentTools 接入 PluginRegistry 集成', () => {
  let tmpDir: string;
  let origHome: string;
  let origUserProfile: string | undefined;
  let origHooksConfig: string | undefined;
  let tmpHome: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-plugin-int-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-plugin-home-'));
    origHome = process.env.HOME ?? '';
    origUserProfile = process.env.USERPROFILE;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(tmpDir, 'no-hooks.json');
  });

  afterEach(() => {
    process.env.HOME = origHome;
    if (origUserProfile !== undefined) {
      process.env.USERPROFILE = origUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('默认 settings.plugins.enabled 未设置 → setupAgentTools 不返回 pluginRegistry', async () => {
    // 不创建 settings.json(无 plugins 配置)
    const { setupAgentTools } = await import('../src/commands/agent.js');
    const result = await setupAgentTools({
      workspacePath: tmpDir,
      silent: true,
    });
    expect(result.pluginRegistry).toBeUndefined();
  });

  it('settings.plugins.enabled === true 时,从 <workspace>/.ihui/plugins 加载插件', async () => {
    // 创建 settings.json 启用 plugins
    const settingsFile = path.join(tmpHome, '.ihui', 'settings.json');
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify({
      plugins: { enabled: true, pluginsDir: path.join(tmpDir, 'plugins') },
    }));

    // 在 pluginsDir 下创建一个插件
    const pluginDir = path.join(tmpDir, 'plugins', 'my-plug');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
      name: 'my-plug',
      version: '1.0.0',
      hooks: ['preToolCall'],
    }));

    const { setupAgentTools } = await import('../src/commands/agent.js');
    const result = await setupAgentTools({
      workspacePath: tmpDir,
      silent: true,
    });
    expect(result.pluginRegistry).toBeDefined();
    expect(result.pluginRegistry!.size()).toBe(1);
    expect(result.pluginRegistry!.has('my-plug')).toBe(true);
    // runSetups 已被调用(无 setup 回调 → 不抛错)
    // getHookExtensions 应返回 ['preToolCall']
    expect(result.pluginRegistry!.getHookExtensions()).toEqual(['preToolCall']);
  });

  it('外部注入 pluginRegistry:setupAgentTools 透传给返回值(优先于 settings)', async () => {
    const external = new PluginRegistry({ workingDir: tmpDir });
    external.register({
      name: 'external-plug',
      version: '1.0.0',
      hooks: ['postToolCall'],
      onHook: () => {},
    });

    const { setupAgentTools } = await import('../src/commands/agent.js');
    const result = await setupAgentTools({
      workspacePath: tmpDir,
      silent: true,
      pluginRegistry: external,
    });
    expect(result.pluginRegistry).toBe(external);
    expect(result.pluginRegistry!.has('external-plug')).toBe(true);
  });

  it('settings.plugins.enabled === true 但 pluginsDir 不存在 → 不抛错,pluginRegistry undefined', async () => {
    const settingsFile = path.join(tmpHome, '.ihui', 'settings.json');
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify({
      plugins: { enabled: true, pluginsDir: path.join(tmpDir, 'nonexistent') },
    }));

    const { setupAgentTools } = await import('../src/commands/agent.js');
    const result = await setupAgentTools({
      workspacePath: tmpDir,
      silent: true,
    });
    // loadPlugins 返回空数组 → 不创建 registry
    expect(result.pluginRegistry).toBeUndefined();
  });

  it('setupAgentTools 加载的 pluginRegistry 可被 runHook 调用(端到端)', async () => {
    const settingsFile = path.join(tmpHome, '.ihui', 'settings.json');
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify({
      plugins: { enabled: true, pluginsDir: path.join(tmpDir, 'plugins') },
    }));

    const pluginDir = path.join(tmpDir, 'plugins', 'logging-plug');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
      name: 'logging-plug',
      version: '1.0.0',
      hooks: ['preToolCall'],
    }));

    const { setupAgentTools } = await import('../src/commands/agent.js');
    const result = await setupAgentTools({
      workspacePath: tmpDir,
      silent: true,
    });
    expect(result.pluginRegistry).toBeDefined();
    // 调用 runHook(JSON 加载的插件,仅声明,会通过 logger.info 记录)
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const n = await result.pluginRegistry!.runHook('preToolCall', { toolName: 'test' });
      expect(n).toBe(0); // 无 onHook 回调
      expect(infoSpy).toHaveBeenCalled();
    } finally {
      infoSpy.mockRestore();
    }
  });
});

// ==================== loadPlugins + registerAll + runSetups 端到端 ====================

describe('Plugin 全流程集成:loadPlugins + registerAll + runSetups + runHook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-plugin-flow-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('从 pluginsDir 加载 → registerAll → runSetups → runHook 全流程', async () => {
    // 创建 2 个插件
    const dir1 = path.join(tmpDir, 'plug-a');
    const dir2 = path.join(tmpDir, 'plug-b');
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });
    fs.writeFileSync(path.join(dir1, 'plugin.json'), JSON.stringify({
      name: 'plug-a',
      version: '1.0.0',
      hooks: ['preToolCall'],
    }));
    fs.writeFileSync(path.join(dir2, 'plugin.json'), JSON.stringify({
      name: 'plug-b',
      version: '1.0.0',
      hooks: ['postToolCall'],
    }));

    // loadPlugins
    const defs = loadPlugins({ pluginsDir: tmpDir });
    expect(defs).toHaveLength(2);

    // registerAll
    const registry = new PluginRegistry({ workingDir: tmpDir });
    const n = registry.registerAll(defs);
    expect(n).toBe(2);
    expect(registry.size()).toBe(2);

    // runSetups(无 setup 回调 → 空失败列表)
    const failed = await registry.runSetups();
    expect(failed).toEqual([]);

    // getHookExtensions 汇总
    const hooks = registry.getHookExtensions().sort();
    expect(hooks).toEqual(['postToolCall', 'preToolCall']);

    // runHook 验证(仅声明,无 onHook → logger.info 记录)
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await registry.runHook('preToolCall', { toolName: 'x' });
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0]![0]).toContain('plug-a');
    } finally {
      infoSpy.mockRestore();
    }
  });

  it('setup 回调被 runSetups 真实调用(程序化插件)', async () => {
    const calls: string[] = [];
    const registry = new PluginRegistry({ workingDir: tmpDir });
    const def: PluginDefinition = {
      name: 'prog-plug',
      version: '1.0.0',
      hooks: ['preToolCall'],
      setup: () => calls.push('setup'),
      onHook: (event) => calls.push(`hook:${event}`),
    };
    registry.register(def);
    const failed = await registry.runSetups();
    expect(failed).toEqual([]);
    expect(calls).toEqual(['setup']);
    // runHook 调用 onHook
    await registry.runHook('preToolCall', { toolName: 'x' });
    expect(calls).toEqual(['setup', 'hook:preToolCall']);
  });
});
