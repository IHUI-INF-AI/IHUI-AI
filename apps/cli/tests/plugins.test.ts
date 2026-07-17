/**
 * Plugins 系统测试 — 覆盖 types / loader / registry 全部 API + 边界场景。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadPlugins,
  validateManifest,
  PluginRegistry,
  type PluginDefinition,
} from '../src/plugins/index.js';

// ==================== Loader 测试 ====================

describe('Plugins loader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-plugins-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePlugin(parent: string, name: string, manifest: Record<string, unknown>, file: string = 'plugin.json'): string {
    const pluginDir = path.join(parent, name);
    fs.mkdirSync(pluginDir, { recursive: true });
    const file_path = path.join(pluginDir, file);
    fs.writeFileSync(file_path, JSON.stringify(manifest), 'utf-8');
    return file_path;
  }

  it('pluginsDir 不存在时返回空数组', () => {
    const result = loadPlugins({ pluginsDir: path.join(tmpDir, 'no-such-dir') });
    expect(result).toEqual([]);
  });

  it('pluginsDir 是文件时返回空数组', () => {
    const file = path.join(tmpDir, 'not-a-dir.txt');
    fs.writeFileSync(file, 'x', 'utf-8');
    const result = loadPlugins({ pluginsDir: file });
    expect(result).toEqual([]);
  });

  it('空目录返回空数组', () => {
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toEqual([]);
  });

  it('加载单个 plugin.json', () => {
    writePlugin(tmpDir, 'my-plugin', {
      name: 'my-plugin',
      version: '1.0.0',
      description: '示例插件',
      author: 'alice',
      tools: ['custom-tool'],
      hooks: ['preToolCall'],
      commands: ['my-slash'],
    });
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('my-plugin');
    expect(result[0]!.version).toBe('1.0.0');
    expect(result[0]!.description).toBe('示例插件');
    expect(result[0]!.author).toBe('alice');
    expect(result[0]!.tools).toEqual(['custom-tool']);
    expect(result[0]!.hooks).toEqual(['preToolCall']);
    expect(result[0]!.commands).toEqual(['my-slash']);
    expect(result[0]!.source).toContain('plugin.json');
  });

  it('支持 plugin.config.json 文件名', () => {
    writePlugin(tmpDir, 'alt', { name: 'alt', version: '2.0.0' }, 'plugin.config.json');
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('alt');
    expect(result[0]!.source).toContain('plugin.config.json');
  });

  it('plugin.json 优先于 plugin.config.json', () => {
    const pluginDir = path.join(tmpDir, 'prio');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ name: 'from-json', version: '1.0.0' }));
    fs.writeFileSync(path.join(pluginDir, 'plugin.config.json'), JSON.stringify({ name: 'from-config', version: '1.0.0' }));
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('from-json');
  });

  it('无效 JSON 被跳过不抛异常', () => {
    const pluginDir = path.join(tmpDir, 'broken');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), '{ not valid json');
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toEqual([]);
  });

  it('缺 name 字段被跳过', () => {
    writePlugin(tmpDir, 'no-name', { version: '1.0.0' });
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toEqual([]);
  });

  it('缺 version 字段被跳过', () => {
    writePlugin(tmpDir, 'no-version', { name: 'no-version' });
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toEqual([]);
  });

  it('name 为空字符串被跳过', () => {
    writePlugin(tmpDir, 'empty-name', { name: '', version: '1.0.0' });
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toEqual([]);
  });

  it('多插件目录全部加载', () => {
    writePlugin(tmpDir, 'plugin-a', { name: 'a', version: '1.0.0' });
    writePlugin(tmpDir, 'plugin-b', { name: 'b', version: '1.0.0' });
    writePlugin(tmpDir, 'plugin-c', { name: 'c', version: '1.0.0' });
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toHaveLength(3);
    const names = result.map((p) => p.name).sort();
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('同名插件后者覆盖前者', () => {
    writePlugin(tmpDir, 'first', { name: 'dup', version: '1.0.0', description: 'first' });
    writePlugin(tmpDir, 'second', { name: 'dup', version: '2.0.0', description: 'second' });
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toHaveLength(1);
    expect(result[0]!.version).toBe('2.0.0');
    expect(result[0]!.description).toBe('second');
  });

  it('顶层 plugin.json 视为单插件', () => {
    fs.writeFileSync(path.join(tmpDir, 'plugin.json'), JSON.stringify({ name: 'top', version: '1.0.0' }));
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('top');
  });

  it('tools/hooks/commands 数组中非字符串被过滤', () => {
    writePlugin(tmpDir, 'mixed', {
      name: 'mixed',
      version: '1.0.0',
      tools: ['valid', 123, null, 'also-valid'] as unknown as string[],
      hooks: ['h1', true] as unknown as string[],
      commands: ['c1'] as unknown as string[],
    });
    const result = loadPlugins({ pluginsDir: tmpDir });
    expect(result[0]!.tools).toEqual(['valid', 'also-valid']);
    expect(result[0]!.hooks).toEqual(['h1']);
    expect(result[0]!.commands).toEqual(['c1']);
  });

  it('recursive=true 时递归扫描嵌套子目录', () => {
    const deepDir = path.join(tmpDir, 'nested', 'deeper');
    fs.mkdirSync(deepDir, { recursive: true });
    fs.writeFileSync(path.join(deepDir, 'plugin.json'), JSON.stringify({ name: 'deep', version: '1.0.0' }));
    expect(loadPlugins({ pluginsDir: tmpDir })).toEqual([]);
    const result = loadPlugins({ pluginsDir: tmpDir, recursive: true });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('deep');
  });

  it('validateManifest 校验有效清单返回 true', () => {
    expect(validateManifest({ name: 'x', version: '1.0.0' })).toBe(true);
  });

  it('validateManifest 校验无效清单返回 false', () => {
    expect(validateManifest(null)).toBe(false);
    expect(validateManifest({})).toBe(false);
    expect(validateManifest({ name: 'x' })).toBe(false);
    expect(validateManifest({ version: '1.0.0' })).toBe(false);
    expect(validateManifest('string')).toBe(false);
  });
});

// ==================== Registry 测试 ====================

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry({ workingDir: '/tmp', config: { foo: 'bar' } });
  });

  function makePlugin(name: string, extras: Partial<PluginDefinition> = {}): PluginDefinition {
    return {
      name,
      version: '1.0.0',
      ...extras,
    };
  }

  it('register 单个插件后 list 返回 1 项', () => {
    registry.register(makePlugin('a'));
    expect(registry.size()).toBe(1);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]!.name).toBe('a');
  });

  it('register 返回 true 表示成功', () => {
    expect(registry.register(makePlugin('a'))).toBe(true);
  });

  it('同名注册默认返回 false 且不覆盖', () => {
    registry.register(makePlugin('a', { version: '1.0.0' }));
    const ok = registry.register(makePlugin('a', { version: '2.0.0' }));
    expect(ok).toBe(false);
    expect(registry.get('a')!.version).toBe('1.0.0');
  });

  it('同名注册 force=true 覆盖原插件', () => {
    registry.register(makePlugin('a', { version: '1.0.0' }));
    const ok = registry.register(makePlugin('a', { version: '2.0.0' }), { force: true });
    expect(ok).toBe(true);
    expect(registry.get('a')!.version).toBe('2.0.0');
  });

  it('registerAll 批量注册返回成功数量', () => {
    const n = registry.registerAll([makePlugin('a'), makePlugin('b'), makePlugin('c')]);
    expect(n).toBe(3);
    expect(registry.size()).toBe(3);
  });

  it('registerAll 同名冲突计入失败数', () => {
    registry.register(makePlugin('a'));
    const n = registry.registerAll([makePlugin('a'), makePlugin('b')]);
    expect(n).toBe(1);
    expect(registry.size()).toBe(2);
  });

  it('unregister 不存在的插件返回 false', async () => {
    const ok = await registry.unregister('nope');
    expect(ok).toBe(false);
    expect(registry.size()).toBe(0);
  });

  it('unregister 已存在的插件返回 true 并删除', async () => {
    registry.register(makePlugin('a'));
    const ok = await registry.unregister('a');
    expect(ok).toBe(true);
    expect(registry.has('a')).toBe(false);
    expect(registry.size()).toBe(0);
  });

  it('unregisterSync 同步卸载', () => {
    registry.register(makePlugin('a'));
    expect(registry.unregisterSync('a')).toBe(true);
    expect(registry.has('a')).toBe(false);
  });

  it('unregisterSync 卸载不存在的插件返回 false', () => {
    expect(registry.unregisterSync('nope')).toBe(false);
  });

  it('unregister callTeardown=true 调用 teardown', async () => {
    let called = false;
    registry.register(makePlugin('a', {
      teardown: () => { called = true; },
    }));
    await registry.unregister('a', { callTeardown: true });
    expect(called).toBe(true);
  });

  it('unregister callTeardown=false 不调用 teardown', async () => {
    let called = false;
    registry.register(makePlugin('a', {
      teardown: () => { called = true; },
    }));
    await registry.unregister('a');
    expect(called).toBe(false);
  });

  it('unregister teardown 抛异常仍能卸载', async () => {
    registry.register(makePlugin('a', {
      teardown: () => { throw new Error('boom'); },
    }));
    const ok = await registry.unregister('a', { callTeardown: true });
    expect(ok).toBe(true);
    expect(registry.has('a')).toBe(false);
  });

  it('get 返回插件对象', () => {
    registry.register(makePlugin('a', { description: 'desc' }));
    const p = registry.get('a');
    expect(p).toBeDefined();
    expect(p!.description).toBe('desc');
  });

  it('get 不存在返回 undefined', () => {
    expect(registry.get('nope')).toBeUndefined();
  });

  it('has 返回是否注册', () => {
    registry.register(makePlugin('a'));
    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(false);
  });

  it('getToolExtensions 汇总所有插件工具名并去重', () => {
    registry.register(makePlugin('a', { tools: ['t1', 't2'] }));
    registry.register(makePlugin('b', { tools: ['t2', 't3'] }));
    const tools = registry.getToolExtensions().sort();
    expect(tools).toEqual(['t1', 't2', 't3']);
  });

  it('getHookExtensions 汇总所有插件 Hook 标识', () => {
    registry.register(makePlugin('a', { hooks: ['preToolCall', 'sessionStart'] }));
    registry.register(makePlugin('b', { hooks: ['preToolCall'] }));
    const hooks = registry.getHookExtensions().sort();
    expect(hooks).toEqual(['preToolCall', 'sessionStart']);
  });

  it('getCommandExtensions 汇总所有 slash command 名', () => {
    registry.register(makePlugin('a', { commands: ['/foo', '/bar'] }));
    registry.register(makePlugin('b', { commands: ['/foo'] }));
    const cmds = registry.getCommandExtensions().sort();
    expect(cmds).toEqual(['/bar', '/foo']);
  });

  it('插件无 tools/hooks/commands 时扩展返回空数组', () => {
    registry.register(makePlugin('a'));
    expect(registry.getToolExtensions()).toEqual([]);
    expect(registry.getHookExtensions()).toEqual([]);
    expect(registry.getCommandExtensions()).toEqual([]);
  });

  it('list 返回浅拷贝,修改不影响内部状态', () => {
    registry.register(makePlugin('a'));
    const list = registry.list();
    list[0]!.name = 'mutated';
    expect(registry.get('a')!.name).toBe('a');
  });

  it('list 按 name 字母排序', () => {
    registry.register(makePlugin('zebra'));
    registry.register(makePlugin('apple'));
    registry.register(makePlugin('mango'));
    const names = registry.list().map((p) => p.name);
    expect(names).toEqual(['apple', 'mango', 'zebra']);
  });

  it('clear 清空所有插件', () => {
    registry.register(makePlugin('a'));
    registry.register(makePlugin('b'));
    registry.clear();
    expect(registry.size()).toBe(0);
  });

  it('getContext 返回注入的上下文', () => {
    const r = new PluginRegistry({ workingDir: '/custom', config: { k: 'v' } });
    const ctx = r.getContext();
    expect(ctx.workingDir).toBe('/custom');
    expect(ctx.config).toEqual({ k: 'v' });
    expect(ctx.logger).toBeDefined();
  });

  it('getContext 缺省值正确(workingDir=cwd, config={})', () => {
    const r = new PluginRegistry();
    const ctx = r.getContext();
    expect(ctx.workingDir).toBe(process.cwd());
    expect(ctx.config).toEqual({});
    expect(ctx.logger).toBe(console);
  });

  it('runSetups 调用所有插件 setup', async () => {
    const calls: string[] = [];
    registry.register(makePlugin('a', { setup: () => { calls.push('a'); } }));
    registry.register(makePlugin('b', { setup: () => { calls.push('b'); } }));
    registry.register(makePlugin('c'));
    const failed = await registry.runSetups();
    expect(failed).toEqual([]);
    expect(calls).toHaveLength(2);
    expect(calls.sort()).toEqual(['a', 'b']);
  });

  it('runSetups setup 抛异常时返回失败插件名', async () => {
    registry.register(makePlugin('a', { setup: () => { throw new Error('boom'); } }));
    registry.register(makePlugin('b', { setup: () => {} }));
    const failed = await registry.runSetups();
    expect(failed).toEqual(['a']);
  });

  it('runTeardowns 调用所有插件 teardown', async () => {
    const calls: string[] = [];
    registry.register(makePlugin('a', { teardown: () => { calls.push('a'); } }));
    registry.register(makePlugin('b', { teardown: () => { calls.push('b'); } }));
    const failed = await registry.runTeardowns();
    expect(failed).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('runTeardowns teardown 抛异常时返回失败插件名', async () => {
    registry.register(makePlugin('a', { teardown: () => { throw new Error('boom'); } }));
    const failed = await registry.runTeardowns();
    expect(failed).toEqual(['a']);
  });

  it('register 存储的是浅拷贝(外部修改不影响内部)', () => {
    const plugin = makePlugin('a', { description: 'orig' });
    registry.register(plugin);
    plugin.description = 'mutated';
    expect(registry.get('a')!.description).toBe('orig');
  });
});

// ==================== 集成场景测试 ====================

describe('Plugins 集成场景', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-plugins-int-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadPlugins + PluginRegistry 完整流程', async () => {
    fs.mkdirSync(path.join(tmpDir, 'plugin-a'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'plugin-a', 'plugin.json'),
      JSON.stringify({ name: 'plugin-a', version: '1.0.0', tools: ['ta'], commands: ['/ca'] }),
    );
    fs.mkdirSync(path.join(tmpDir, 'plugin-b'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'plugin-b', 'plugin.json'),
      JSON.stringify({ name: 'plugin-b', version: '1.0.0', tools: ['tb'], hooks: ['preToolCall'] }),
    );

    const defs = loadPlugins({ pluginsDir: tmpDir });
    expect(defs).toHaveLength(2);

    const registry = new PluginRegistry();
    const registered = registry.registerAll(defs);
    expect(registered).toBe(2);

    const tools = registry.getToolExtensions().sort();
    expect(tools).toEqual(['ta', 'tb']);
    const hooks = registry.getHookExtensions();
    expect(hooks).toEqual(['preToolCall']);
    const cmds = registry.getCommandExtensions();
    expect(cmds).toEqual(['/ca']);
  });

  it('损坏清单不阻塞其他有效插件加载', () => {
    fs.mkdirSync(path.join(tmpDir, 'broken'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'broken', 'plugin.json'), '{ invalid');
    fs.mkdirSync(path.join(tmpDir, 'good'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'good', 'plugin.json'),
      JSON.stringify({ name: 'good', version: '1.0.0' }),
    );

    const defs = loadPlugins({ pluginsDir: tmpDir });
    expect(defs).toHaveLength(1);
    expect(defs[0]!.name).toBe('good');
  });
});
