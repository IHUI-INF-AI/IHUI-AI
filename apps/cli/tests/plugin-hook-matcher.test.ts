// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 / Z13 — hook 声明的 `event:matcher` **真参与派发**(装车证明)。
 *
 * 票面事实(Z1 未竟 3):`registry.runHook` 旧实现只做 `h === event || h.startsWith(event + ':')`,
 * matcher 那半截被读到、从不进判定 —— 声明「只关心 write_file」的插件每一次 preToolCall 都被叫醒。
 * 本用例把新语义钉成**正反对照**(§14:每条行为变更都要有能跑的证据):
 *   合法匹配仍执行 / 不匹配不执行 / 通配与整档订阅不变 / 空 matcher 与缺 toolName 一律不执行(§0.10 保守方向)。
 *
 * 同一批还钉两件「拆档不该改变行为」的对照:contributor 两枚 runner 与五枚汇总口的去重顺序
 * (实现搬到 `plugin-dispatch.ts` / `collectExtensions` 后,既有在册形态的结果逐字不变)。
 *
 * 已知的行为变更影响面(白名单外,交主席一行改):`tests/plugins-integration.test.ts`
 * 的「runHook 匹配 `${event}:` 前缀」那条断言钉的正是本票要消灭的旧行为(期望两次触发),
 * 新语义下第二次触发(`toolName: 'read_file'`)不该发生。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { loadPlugins } from '../src/plugins/loader.js';
import { PluginRegistry } from '../src/plugins/registry.js';
import { hookMatcherSatisfied, parseHookDeclaration, pluginHookMatches } from '../src/plugins/plugin-dispatch.js';
import type { PluginDefinition } from '../src/plugins/types.js';

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-hook-matcher-');
});

afterEach(() => {
  rmScratch(root);
});

function registryOf(...plugins: PluginDefinition[]): PluginRegistry {
  const registry = new PluginRegistry({ workingDir: root });
  registry.registerAll(plugins);
  return registry;
}

describe('parseHookDeclaration — 事件段与 matcher 的唯一拆法', () => {
  it('纯事件名没有 matcher;第一个冒号处切一刀,后缀整截算 matcher', () => {
    expect(parseHookDeclaration('preToolCall')).toEqual({ event: 'preToolCall', matcher: null });
    expect(parseHookDeclaration('preToolCall:write_file')).toEqual({ event: 'preToolCall', matcher: 'write_file' });
    expect(parseHookDeclaration('postToolCall:')).toEqual({ event: 'postToolCall', matcher: '' });
    // 旧实现按 startsWith('a:') 判,后缀是黑箱;新实现只在第一个冒号切,多余的冒号留在 matcher 里
    expect(parseHookDeclaration('a:b:c')).toEqual({ event: 'a', matcher: 'b:c' });
  });

  it('matcher 满足判据:缺席 / 通配 = 每次都要;具名工具 = 逐字相等;空串与缺 toolName 一律不满足', () => {
    expect(hookMatcherSatisfied(null, { toolName: 'read_file' })).toBe(true);
    expect(hookMatcherSatisfied('*', { toolName: 'read_file' })).toBe(true);
    expect(hookMatcherSatisfied('write_file', { toolName: 'write_file' })).toBe(true);
    expect(hookMatcherSatisfied('write_file', { toolName: 'read_file' })).toBe(false);
    expect(hookMatcherSatisfied('', { toolName: 'write_file' })).toBe(false);
    expect(hookMatcherSatisfied('write_file', {})).toBe(false);
  });
});

describe('runHook:合法匹配仍执行(正向对照)', () => {
  it('matcher 命中当次 toolName ⇒ onHook 被叫一次,invoked=1', async () => {
    const seen: string[] = [];
    const registry = registryOf({
      name: 'matcher-hit',
      version: '1.0.0',
      hooks: ['preToolCall:write_file'],
      onHook: (event, ctx) => seen.push(`${event}/${ctx.toolName}`),
    });
    expect(await registry.runHook('preToolCall', { toolName: 'write_file' })).toBe(1);
    expect(seen).toEqual(['preToolCall/write_file']);
  });

  it('整档订阅(纯事件名)对每一次派发都执行 —— 既有在册形态零回归', async () => {
    const seen: string[] = [];
    const registry = registryOf({
      name: 'plain-subscriber',
      version: '1.0.0',
      hooks: ['preToolCall'],
      onHook: (_event, ctx) => seen.push(String(ctx.toolName)),
    });
    await registry.runHook('preToolCall', { toolName: 'write_file' });
    await registry.runHook('preToolCall', { toolName: 'read_file' });
    expect(seen).toEqual(['write_file', 'read_file']);
  });

  it('显式通配 `postToolCall:*` 覆盖所有工具;一个插件一次事件只叫一回(两条声明都命中也不重复)', async () => {
    const seen: string[] = [];
    const registry = registryOf({
      name: 'wildcard',
      version: '1.0.0',
      hooks: ['postToolCall:*'],
      onHook: (_event, ctx) => seen.push(String(ctx.toolName)),
    });
    expect(await registry.runHook('postToolCall', { toolName: 'edit_file' })).toBe(1);
    expect(seen).toEqual(['edit_file']);

    const calls: string[] = [];
    const both = registryOf({
      name: 'two-hits',
      version: '1.0.0',
      hooks: ['preToolCall', 'preToolCall:write_file'],
      onHook: () => calls.push('once'),
    });
    expect(await both.runHook('preToolCall', { toolName: 'write_file' })).toBe(1);
    expect(calls).toEqual(['once']);
  });

  it('pluginHookMatches 与 runHook 同判据(单源,不在测试里复算)', () => {
    const plugin: PluginDefinition = { name: 'p', version: '1.0.0', hooks: ['preToolCall:read_file'] };
    expect(pluginHookMatches(plugin, 'preToolCall', { toolName: 'read_file' })).toBe(true);
    expect(pluginHookMatches(plugin, 'preToolCall', { toolName: 'write_file' })).toBe(false);
    expect(pluginHookMatches(plugin, 'postToolCall', { toolName: 'read_file' })).toBe(false);
  });
});

describe('runHook:不匹配不执行(反向对照)', () => {
  it('matcher 不命中 ⇒ 零回调、invoked=0(旧实现在这里会误叫)', async () => {
    const seen: string[] = [];
    const registry = registryOf({
      name: 'matcher-miss',
      version: '1.0.0',
      hooks: ['preToolCall:write_file'],
      onHook: (event, ctx) => seen.push(`${event}/${ctx.toolName}`),
    });
    expect(await registry.runHook('preToolCall', { toolName: 'read_file' })).toBe(0);
    expect(seen).toEqual([]);
  });

  it('事件段不同 ⇒ 不执行(与旧实现一致)', async () => {
    const seen: string[] = [];
    const registry = registryOf({ name: 'pre-only', version: '1.0.0', hooks: ['preToolCall'], onHook: () => seen.push('x') });
    expect(await registry.runHook('postToolCall', { toolName: 'write_file' })).toBe(0);
    expect(seen).toEqual([]);
  });

  it('空 matcher(`preToolCall:`)永不执行:拼错的清单不得升成全量订阅', async () => {
    const seen: string[] = [];
    const registry = registryOf({ name: 'empty-matcher', version: '1.0.0', hooks: ['preToolCall:'], onHook: () => seen.push('x') });
    expect(await registry.runHook('preToolCall', { toolName: 'write_file' })).toBe(0);
    expect(await registry.runHook('preToolCall', {})).toBe(0);
    expect(seen).toEqual([]);
  });

  it('派发上下文没有 toolName ⇒ 具名 matcher 不执行(证不了就是那个工具)', async () => {
    const seen: string[] = [];
    const registry = registryOf({ name: 'no-toolname', version: '1.0.0', hooks: ['preToolCall:write_file'], onHook: () => seen.push('x') });
    expect(await registry.runHook('preToolCall', { args: {} })).toBe(0);
    expect(seen).toEqual([]);
  });

  it('onHook 抛异常:不计入 invoked,也不阻塞同批健康插件(旧行为保持)', async () => {
    const registry = registryOf(
      { name: 'broken', version: '1.0.0', hooks: ['preToolCall'], onHook: () => { throw new Error('boom'); } },
      { name: 'healthy', version: '1.0.0', hooks: ['preToolCall'], onHook: () => {} },
    );
    expect(await registry.runHook('preToolCall', { toolName: 'write_file' })).toBe(1);
  });
});

describe('仅声明无回调(JSON 清单):日志只给真命中的那一次', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('清单声明的 matcher 真参与派发:命中记一行(点名命中的声明原文),不命中一行都不记', async () => {
    const dir = path.join(root, 'logging-plug');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'plugin.json'),
      JSON.stringify({ name: 'logging-plug', version: '1.0.0', hooks: ['preToolCall:write_file'] }),
      'utf-8',
    );
    const registry = registryOf(...loadPlugins({ pluginsDir: root }));
    expect(registry.getHookExtensions()).toEqual(['preToolCall:write_file']);

    expect(await registry.runHook('preToolCall', { toolName: 'write_file' })).toBe(0);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = infoSpy.mock.calls[0]![0] as string;
    expect(line).toContain('[plugin:logging-plug]');
    expect(line).toContain('preToolCall');
    expect(line).toContain('preToolCall:write_file');

    infoSpy.mockClear();
    expect(await registry.runHook('preToolCall', { toolName: 'read_file' })).toBe(0);
    expect(infoSpy).not.toHaveBeenCalled();
  });
});

describe('拆档不改行为:contributor 两枚 runner + 五枚汇总口', () => {
  it('runTurnInputContributors 拼接非空贡献;空串/异常都不进正文', async () => {
    const registry = registryOf(
      { name: 'a', version: '1.0.0', turnInputContributors: ['ctx-a'], onTurnInputContribute: () => 'A' },
      { name: 'b', version: '1.0.0', turnInputContributors: ['ctx-b'], onTurnInputContribute: () => '   ' },
      { name: 'c', version: '1.0.0', turnInputContributors: ['ctx-c'], onTurnInputContribute: () => { throw new Error('boom'); } },
      { name: 'd', version: '1.0.0', turnInputContributors: ['ctx-d'] },
    );
    const ctx = { workingDir: root, turnNumber: 1, maxTurns: 3 };
    expect(await registry.runTurnInputContributors(ctx)).toBe('A');
  });

  it('runCommandContributors 数的是真被调到的插件数', async () => {
    const seen: string[] = [];
    const registry = registryOf(
      { name: 'a', version: '1.0.0', commandContributors: ['cmd-a'], onCommandContribute: () => seen.push('a') },
      { name: 'b', version: '1.0.0', commandContributors: ['cmd-b'] },
      { name: 'c', version: '1.0.0', commandContributors: ['cmd-c'], onCommandContribute: () => { throw new Error('boom'); } },
    );
    const n = await registry.runCommandContributors({ workingDir: root, turnNumber: 2, maxTurns: 5 });
    expect(n).toBe(1);
    expect(seen).toEqual(['a']);
  });

  it('汇总口仍是「按注册序去重」:collectExtensions 重构后结果逐字不变', () => {
    const registry = registryOf(
      { name: 'a', version: '1.0.0', tools: ['read_file', 'edit_file'], hooks: ['preToolCall'], commands: ['deploy'], turnInputContributors: ['t1'], commandContributors: ['c1'] },
      { name: 'b', version: '1.0.0', tools: ['edit_file', 'list_dir'], hooks: ['preToolCall'], commands: ['deploy'], turnInputContributors: ['t1'], commandContributors: ['c2'] },
    );
    expect(registry.getToolExtensions()).toEqual(['read_file', 'edit_file', 'list_dir']);
    expect(registry.getHookExtensions()).toEqual(['preToolCall']);
    expect(registry.getCommandExtensions()).toEqual(['deploy']);
    expect(registry.getTurnInputContributorExtensions()).toEqual(['t1']);
    expect(registry.getCommandContributorExtensions()).toEqual(['c1', 'c2']);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
