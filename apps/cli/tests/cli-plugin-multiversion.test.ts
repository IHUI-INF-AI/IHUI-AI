// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  PLUGIN_DIAGNOSTIC_CODES,
  comparePluginVersions,
  loadPluginsWithDiagnostics,
  loadPluginsWithVersionPolicy,
  parsePluginVersion,
  selectActivePluginVersions,
  type PluginDefinition,
  type PluginDiagnostic,
  type PluginVersionCandidate,
} from '../src/plugins/index.js';

/**
 * #12 插件多版本共存。
 *
 * 钉两件事:
 *   1. 严格通道**一条判据没动** —— 同名不同版本仍弃权(G-684/G-658),共存必须显式开启;
 *   2. 共存通道的选择顺序 = pin > semver 最高;禁用版本留盘不装载;pin 落空确定性回退并留诊断;
 *      **同名同版本**两份仍算歧义,不因共存通道放行。
 */

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-multiversion-');
});

afterEach(() => {
  rmScratch(root);
});

function writeManifest(dirName: string, manifest: Record<string, unknown>, file = 'plugin.json'): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  fs.writeFileSync(target, JSON.stringify(manifest), 'utf-8');
  return target;
}

function candidate(name: string, version: string, dir: string): PluginVersionCandidate {
  const file = path.join(root, dir, 'plugin.json');
  const definition: PluginDefinition = { name, version, source: file };
  return { name, version, file, definition };
}

function codesOf(diagnostics: PluginDiagnostic[]): string[] {
  return diagnostics.map((d) => d.code);
}

describe('#12 版本序单源:comparePluginVersions', () => {
  it('core 逐段比较,次序传递', () => {
    expect(comparePluginVersions('1.0.0', '1.1.0')).toBe(-1);
    expect(comparePluginVersions('1.1.0', '1.0.0')).toBe(1);
    expect(comparePluginVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(comparePluginVersions('1.0.0', '1.0.0')).toBe(0);
    expect(comparePluginVersions('1.2', '1.2.0')).toBe(0);
  });

  it('正式版高于同 core 的 prerelease', () => {
    expect(comparePluginVersions('1.0.0-pre.1', '1.0.0')).toBe(-1);
    expect(comparePluginVersions('1.0.0', '1.0.0-pre.1')).toBe(1);
  });

  it('prerelease 段:数字段按数值比、数字段低于字母段', () => {
    expect(comparePluginVersions('1.0.0-pre.2', '1.0.0-pre.10')).toBe(-1);
    expect(comparePluginVersions('1.0.0-pre.1', '1.0.0-pre.a')).toBe(-1);
    expect(comparePluginVersions('1.0.0-pre.a', '1.0.0-pre.b')).toBe(-1);
    // WorkBuddy 形态:core 之后的整段按 prerelease,且 5.9.4 高于 5.9.3-…
    expect(comparePluginVersions('5.9.3-wb.42398134.gd4692421.h480e8d1fee0f', '5.9.3')).toBe(-1);
    expect(comparePluginVersions('5.9.3-wb.42398134.gd4692421.h480e8d1fee0f', '5.9.4')).toBe(-1);
  });

  it('build metadata 不参与排序,同 core 不同 build 也有唯一顺序(不依赖枚举顺序)', () => {
    const a = '1.0.0+build.1';
    const b = '1.0.0+build.2';
    expect(comparePluginVersions(a, b)).toBe(-1);
    expect(comparePluginVersions(b, a)).toBe(1);
    // build 不参与排序 ⇒ 两者同序;最终按 raw 字符串破平局('1.0.0+build.1' > '1.0.0')
    expect(comparePluginVersions(a, '1.0.0')).toBe(1);
  });

  it('parsePluginVersion 宽松收下整数/两段/v 前缀', () => {
    expect(parsePluginVersion('v2').major).toBe(2);
    expect(parsePluginVersion('1.2').minor).toBe(2);
    expect(parsePluginVersion('1.2.3-x.y+z.w').prerelease).toEqual(['x', 'y']);
    expect(parsePluginVersion('1.2.3-x.y+z.w').build).toEqual(['z', 'w']);
  });
});

describe('#12 纯选择:selectActivePluginVersions', () => {
  it('同名不同版本 ⇒ 选 semver 最高,其余进 shadowed(higher-version)', () => {
    const selection = selectActivePluginVersions([
      candidate('alpha', '1.0.0', 'v1'),
      candidate('alpha', '2.0.0', 'v2'),
      candidate('alpha', '1.5.0', 'v15'),
    ]);

    expect(selection.active.map((c) => c.version)).toEqual(['2.0.0']);
    expect(selection.shadowed.map((s) => `${s.version}:${s.reason}`).sort()).toEqual([
      '1.0.0:higher-version',
      '1.5.0:higher-version',
    ]);
    expect(selection.diagnostics.every((d) => d.code === 'plugin-version-shadowed')).toBe(true);
  });

  it('pin 覆盖最高版:被 pin 的 active,其余让位(pinned-other-version)', () => {
    const selection = selectActivePluginVersions(
      [candidate('alpha', '1.0.0', 'v1'), candidate('alpha', '2.0.0', 'v2')],
      { pins: { alpha: '1.0.0' } },
    );

    expect(selection.active.map((c) => c.version)).toEqual(['1.0.0']);
    expect(selection.shadowed).toHaveLength(1);
    expect(selection.shadowed[0]!.reason).toBe('pinned-other-version');
    expect(selection.diagnostics.map((d) => d.code)).toEqual(['plugin-version-shadowed']);
  });

  it('pin 与盘上只差 build metadata 视为同一版本', () => {
    const selection = selectActivePluginVersions([candidate('alpha', '1.0.0+build.7', 'v1')], {
      pins: { alpha: '1.0.0' },
    });
    expect(selection.active.map((c) => c.version)).toEqual(['1.0.0+build.7']);
    expect(selection.diagnostics).toEqual([]);
  });

  it('pin 落空 ⇒ 报 plugin-version-pin-missing 并确定性退回序最高的可用版本', () => {
    const selection = selectActivePluginVersions(
      [candidate('alpha', '1.0.0', 'v1'), candidate('alpha', '2.0.0', 'v2')],
      { pins: { alpha: '9.9.9' } },
    );

    expect(selection.active.map((c) => c.version)).toEqual(['2.0.0']);
    expect(selection.diagnostics.map((d) => d.code)).toContain('plugin-version-pin-missing');
    const pinMissing = selection.diagnostics.find((d) => d.code === 'plugin-version-pin-missing')!;
    expect(pinMissing.severity).toBe('warning');
    expect(pinMissing.pluginName).toBe('alpha');
  });

  it('禁用版本留盘不参选(shadowed reason=disabled)', () => {
    const selection = selectActivePluginVersions(
      [candidate('alpha', '1.0.0', 'v1'), candidate('alpha', '2.0.0', 'v2')],
      { disabled: ['alpha@2.0.0'] },
    );

    expect(selection.active.map((c) => c.version)).toEqual(['1.0.0']);
    const shadowed = selection.shadowed.find((s) => s.version === '2.0.0')!;
    expect(shadowed.reason).toBe('disabled');
    expect(selection.diagnostics.map((d) => d.code)).toEqual(['plugin-version-shadowed']);
  });

  it('全部版本被禁用 ⇒ 该名不装载,报 plugin-version-all-disabled', () => {
    const selection = selectActivePluginVersions(
      [candidate('alpha', '1.0.0', 'v1'), candidate('alpha', '2.0.0', 'v2')],
      { disabled: ['alpha@1.0.0', 'alpha@2.0.0'] },
    );

    expect(selection.active).toEqual([]);
    expect(selection.shadowed.every((s) => s.reason === 'disabled')).toBe(true);
    const allDisabled = selection.diagnostics.find((d) => d.code === 'plugin-version-all-disabled')!;
    expect(allDisabled.severity).toBe('warning');
    expect(allDisabled.pluginName).toBe('alpha');
  });

  it('同名同版本两份仍是歧义:整桶不参选,不放行', () => {
    const selection = selectActivePluginVersions([
      candidate('alpha', '1.0.0', 'a'),
      candidate('alpha', '1.0.0', 'b'),
    ]);

    expect(selection.active).toEqual([]);
    const ambiguous = selection.diagnostics.filter((d) => d.code === 'plugin_ambiguous_name');
    expect(ambiguous).toHaveLength(2);
    expect(ambiguous.every((d) => d.severity === 'error')).toBe(true);
  });

  it('同版本歧义不连坐其它版本:另一个版本照常参选', () => {
    const selection = selectActivePluginVersions([
      candidate('alpha', '1.0.0', 'a'),
      candidate('alpha', '1.0.0', 'b'),
      candidate('alpha', '2.0.0', 'c'),
    ]);

    expect(selection.active.map((c) => c.version)).toEqual(['2.0.0']);
    expect(selection.diagnostics.filter((d) => d.code === 'plugin_ambiguous_name')).toHaveLength(2);
  });

  it('结论与候选顺序无关(镜像夹具:同输入换序结论逐字相同)', () => {
    const list = [
      candidate('alpha', '1.0.0', 'v1'),
      candidate('alpha', '2.0.0', 'v2'),
      candidate('beta', '3.0.0', 'b3'),
      candidate('beta', '3.1.0', 'b31'),
    ];
    const forward = selectActivePluginVersions(list);
    const backward = selectActivePluginVersions([...list].reverse());

    expect(forward.active.map((c) => `${c.name}@${c.version}`)).toEqual(
      backward.active.map((c) => `${c.name}@${c.version}`),
    );
    expect(forward.shadowed.map((s) => `${s.name}@${s.version}:${s.reason}`)).toEqual(
      backward.shadowed.map((s) => `${s.name}@${s.version}:${s.reason}`),
    );
  });
});

describe('#12 盘上装载:loadPluginsWithVersionPolicy', () => {
  it('严格通道零回归:同一夹具下同名不同版本仍全部弃权', () => {
    const v1 = writeManifest('v1', { name: 'alpha', version: '1.0.0' });
    const v2 = writeManifest('v2', { name: 'alpha', version: '2.0.0' });

    const strict = loadPluginsWithDiagnostics({ pluginsDir: root });
    expect(strict.plugins).toEqual([]);
    expect(strict.diagnostics.map((d) => d.code)).toEqual(['plugin_ambiguous_name', 'plugin_ambiguous_name']);
    expect(strict.diagnostics.map((d) => d.file).sort()).toEqual([v1, v2].sort());
  });

  it('共存通道:装载最高版本,低版本进 shadowed 且不注册', () => {
    const v1 = writeManifest('v1', { name: 'alpha', version: '1.0.0', description: 'old body' });
    const v2 = writeManifest('v2', { name: 'alpha', version: '2.0.0', description: 'new body' });

    const result = loadPluginsWithVersionPolicy({ pluginsDir: root });

    expect(result.plugins.map((p) => p.name)).toEqual(['alpha']);
    expect(result.plugins[0]!.version).toBe('2.0.0');
    expect(result.plugins[0]!.source).toBe(v2);
    expect(result.plugins[0]!.description).toBe('new body');
    expect(result.shadowed.map((s) => `${s.version}:${s.reason}`)).toEqual(['1.0.0:higher-version']);
    expect(result.shadowed[0]!.file).toBe(v1);
    expect(codesOf(result.diagnostics)).toEqual(['plugin-version-shadowed']);
    expect(result.diagnostics[0]!.severity).toBe('warning');
  });

  it('pin 生效:装 pin 的旧版本,新版本被压掉', () => {
    writeManifest('v1', { name: 'alpha', version: '1.0.0' });
    writeManifest('v2', { name: 'alpha', version: '2.0.0' });

    const result = loadPluginsWithVersionPolicy({ pluginsDir: root, policy: { pins: { alpha: '1.0.0' } } });

    expect(result.plugins.map((p) => p.version)).toEqual(['1.0.0']);
    expect(result.shadowed.map((s) => s.reason)).toEqual(['pinned-other-version']);
  });

  it('禁用版本:目录保留,不装载;另一版本照常装载', () => {
    writeManifest('v1', { name: 'alpha', version: '1.0.0' });
    writeManifest('v2', { name: 'alpha', version: '2.0.0' });

    const result = loadPluginsWithVersionPolicy({
      pluginsDir: root,
      policy: { disabled: ['alpha@2.0.0'] },
    });

    expect(result.plugins.map((p) => p.version)).toEqual(['1.0.0']);
    expect(result.shadowed.map((s) => `${s.version}:${s.reason}`)).toEqual(['2.0.0:disabled']);
    expect(fs.existsSync(result.shadowed[0]!.file)).toBe(true);
  });

  it('全部版本禁用:该名不装载,诊断点名全部在盘清单', () => {
    const v1 = writeManifest('v1', { name: 'alpha', version: '1.0.0' });
    const v2 = writeManifest('v2', { name: 'alpha', version: '2.0.0' });

    const result = loadPluginsWithVersionPolicy({
      pluginsDir: root,
      policy: { disabled: ['alpha@1.0.0', 'alpha@2.0.0'] },
    });

    expect(result.plugins).toEqual([]);
    const allDisabled = result.diagnostics.find((d) => d.code === 'plugin-version-all-disabled')!;
    expect(allDisabled).toBeDefined();
    expect(allDisabled.severity).toBe('warning');
    expect([...(allDisabled.relatedFiles ?? [])].sort()).toEqual([v1, v2].sort());
  });

  it('pin 落空:退回最高版并留 plugin-version-pin-missing', () => {
    writeManifest('v1', { name: 'alpha', version: '1.0.0' });
    writeManifest('v2', { name: 'alpha', version: '2.0.0' });

    const result = loadPluginsWithVersionPolicy({
      pluginsDir: root,
      policy: { pins: { alpha: '9.9.9' } },
    });

    expect(result.plugins.map((p) => p.version)).toEqual(['2.0.0']);
    expect(codesOf(result.diagnostics)).toContain('plugin-version-pin-missing');
  });

  it('同名同版本两份:共存通道也只报歧义,不装载(隔离于同名不同版本)', () => {
    writeManifest('a', { name: 'alpha', version: '1.0.0' });
    writeManifest('b', { name: 'alpha', version: '1.0.0' });

    const result = loadPluginsWithVersionPolicy({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    const ambiguous = result.diagnostics.filter((d) => d.code === 'plugin_ambiguous_name');
    expect(ambiguous).toHaveLength(2);
    expect(result.diagnostics.some((d) => d.code === 'plugin-version-all-disabled')).toBe(true);
    expect(result.diagnostics.map((d) => d.file).length).toBeGreaterThan(0);
  });

  it('不同名字的多版本互不影响:各选各的', () => {
    writeManifest('a1', { name: 'alpha', version: '1.0.0' });
    writeManifest('a2', { name: 'alpha', version: '2.0.0' });
    writeManifest('b1', { name: 'beta', version: '3.0.0' });
    writeManifest('b2', { name: 'beta', version: '3.1.0' });

    const result = loadPluginsWithVersionPolicy({ pluginsDir: root });

    expect(result.plugins.map((p) => `${p.name}@${p.version}`)).toEqual(['alpha@2.0.0', 'beta@3.1.0']);
    expect(result.shadowed.map((s) => `${s.name}@${s.version}`)).toEqual(['alpha@1.0.0', 'beta@3.0.0']);
  });

  it('顶层单插件目录(目录本身即插件)行为不变', () => {
    fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ name: 'solo', version: '1.0.0' }), 'utf-8');

    const result = loadPluginsWithVersionPolicy({ pluginsDir: root });

    expect(result.plugins.map((p) => p.name)).toEqual(['solo']);
    expect(result.shadowed).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('递归扫描下嵌套的不同版本同样共存', () => {
    writeManifest('shallow', { name: 'alpha', version: '1.0.0' });
    const deep = path.join(root, 'nested', 'deeper');
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, 'plugin.json'), JSON.stringify({ name: 'alpha', version: '9.9.9' }), 'utf-8');

    const result = loadPluginsWithVersionPolicy({ pluginsDir: root, recursive: true });

    expect(result.plugins.map((p) => p.version)).toEqual(['9.9.9']);
    expect(result.shadowed.map((s) => s.version)).toEqual(['1.0.0']);
  });

  it('三个新诊断码已登记且都是 warning(不在码表里就编译期红)', () => {
    expect(PLUGIN_DIAGNOSTIC_CODES).toContain('plugin-version-shadowed');
    expect(PLUGIN_DIAGNOSTIC_CODES).toContain('plugin-version-pin-missing');
    expect(PLUGIN_DIAGNOSTIC_CODES).toContain('plugin-version-all-disabled');

    const result = loadPluginsWithVersionPolicy({
      pluginsDir: root,
      policy: { pins: { alpha: '0.0.0' }, disabled: ['alpha@2.0.0'] },
    });
    // 空目录:不产出任何版本诊断;三个码的定档由 DIAGNOSTIC_SEVERITY 穷尽表保证
    expect(result.diagnostics).toEqual([]);

    writeManifest('v1', { name: 'alpha', version: '1.0.0' });
    writeManifest('v2', { name: 'alpha', version: '2.0.0' });
    const diagnosed = loadPluginsWithVersionPolicy({
      pluginsDir: root,
      policy: { pins: { alpha: '0.0.0' }, disabled: ['alpha@2.0.0'] },
    });
    for (const diagnostic of diagnosed.diagnostics) {
      expect(['plugin-version-shadowed', 'plugin-version-pin-missing', 'plugin-version-all-disabled']).toContain(
        diagnostic.code,
      );
      expect(diagnostic.severity).toBe('warning');
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
