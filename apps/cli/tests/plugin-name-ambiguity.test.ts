// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPlugins, loadPluginsWithDiagnostics, type PluginDiagnostic } from '../src/plugins/index.js';

/**
 * G-684 — 掷骰子处宁可不玩:同名插件不得"后写覆盖前写"。
 *
 * 钉的实测缺陷:`loader.ts` 原先用 `results.set(manifest.name, …)` 收集清单,
 * 于是两份清单撞同一个 name 时,**目录枚举顺序**决定了谁的 tools/hooks/凭据生效。
 * 扫描顺序不是任何人声明过的意图,所以这不是"冲突解决"而是"歧义被静默裁决"。
 * 现口径:同名多份 ⇒ **两个都不装载**,每份各留一条点名对方路径的诊断。
 *
 * 这组用例是 last-write-wins 的**变异对照**:把收集改回 `results.set(name, def)`
 * 之后,「返回集合不含该名」与「两条歧义诊断」会同时翻红 —— 不是只红一条文案断言。
 */

const AMBIGUOUS = 'dup';

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-ambiguity-');
});

afterEach(() => {
  rmScratch(root);
});

function writeManifest(dirName: string, text: string, file = 'plugin.json'): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  fs.writeFileSync(target, text, 'utf-8');
  return target;
}

function ambiguousOf(diagnostics: PluginDiagnostic[]): PluginDiagnostic[] {
  return diagnostics.filter((d) => d.code === 'manifest-name-ambiguous');
}

describe('G-684 同名插件不静默裁决:两个都不装载', () => {
  it('两份同名不同体清单 ⇒ 返回集合不含该名,且 diagnostics 点名两个路径', () => {
    const first = writeManifest('first', JSON.stringify({ name: AMBIGUOUS, version: '1.0.0', description: 'first body' }));
    const second = writeManifest('second', JSON.stringify({ name: AMBIGUOUS, version: '2.0.0', description: 'second body' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    // ① 装载面:一个都没装(既不是前者也不是后者)
    expect(result.plugins).toEqual([]);
    expect(result.plugins.map((p) => p.name)).not.toContain(AMBIGUOUS);
    // 兼容出口同形:旧的 PluginDefinition[] 契约里同样不得出现该名
    expect(loadPlugins({ pluginsDir: root })).toEqual([]);

    // ② 诊断面:两份各点名一条,并指出对方
    const ambiguous = ambiguousOf(result.diagnostics);
    expect(ambiguous).toHaveLength(2);
    const files = ambiguous.map((d) => d.file).sort();
    expect(files).toEqual([first, second].sort());
    expect(result.diagnostics).toHaveLength(2); // 被跳过的清单恰好各一条,不叠加

    for (const diagnostic of ambiguous) {
      expect(diagnostic.severity).toBe('error');
      expect(diagnostic.pluginName).toBe(AMBIGUOUS);
      const other = diagnostic.file === first ? second : first;
      expect(diagnostic.relatedFiles).toEqual([other]);
      expect(diagnostic.message).toContain(AMBIGUOUS);
    }
  });

  it('三份同名 ⇒ 三条诊断,每条点名其余两份', () => {
    const paths = ['a', 'b', 'c'].map((name) =>
      writeManifest(name, JSON.stringify({ name: AMBIGUOUS, version: `1.0.${name}` })),
    );

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    const ambiguous = ambiguousOf(result.diagnostics);
    expect(ambiguous).toHaveLength(3);
    expect(ambiguous.map((d) => d.file).sort()).toEqual([...paths].sort());
    for (const diagnostic of ambiguous) {
      const others = paths.filter((p) => p !== diagnostic.file).sort();
      expect([...(diagnostic.relatedFiles ?? [])].sort()).toEqual(others);
    }
  });

  it('正向对照:名字互不相同 ⇒ 全部装载且零歧义诊断(判据不得恒喊)', () => {
    writeManifest('first', JSON.stringify({ name: 'p1', version: '1.0.0' }));
    writeManifest('second', JSON.stringify({ name: 'p2', version: '2.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins.map((p) => p.name).sort()).toEqual(['p1', 'p2']);
    expect(ambiguousOf(result.diagnostics)).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('递归扫描下嵌套的同名同样算歧义', () => {
    const shallow = writeManifest('shallow', JSON.stringify({ name: AMBIGUOUS, version: '1.0.0' }));
    const deep = path.join(root, 'nested', 'deeper');
    fs.mkdirSync(deep, { recursive: true });
    const deepFile = path.join(deep, 'plugin.json');
    fs.writeFileSync(deepFile, JSON.stringify({ name: AMBIGUOUS, version: '9.9.9' }), 'utf-8');

    const result = loadPluginsWithDiagnostics({ pluginsDir: root, recursive: true });

    expect(result.plugins).toEqual([]);
    expect(ambiguousOf(result.diagnostics).map((d) => d.file).sort()).toEqual([shallow, deepFile].sort());
  });

  it('坏清单不参与歧义裁决:它已按 G-683 单独报名,好那份照常装载', () => {
    writeManifest('bad', '{ invalid');
    const good = writeManifest('good', JSON.stringify({ name: 'only-good', version: '1.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins.map((p) => p.name)).toEqual(['only-good']);
    expect(result.plugins[0]!.source).toBe(good);
    expect(ambiguousOf(result.diagnostics)).toEqual([]);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['manifest-json-invalid']);
  });

  it('顶层清单目录(目录本身就是一个插件)不受歧义判据影响', () => {
    const top = path.join(root, 'plugin.json');
    fs.writeFileSync(top, JSON.stringify({ name: 'top-level', version: '1.0.0' }), 'utf-8');

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins.map((p) => p.name)).toEqual(['top-level']);
    expect(result.diagnostics).toEqual([]);
  });

  it('歧义文案与环依赖判别码分家:同一次装载只产出歧义码', () => {
    writeManifest('first', JSON.stringify({ name: AMBIGUOUS, version: '1.0.0' }));
    writeManifest('second', JSON.stringify({ name: AMBIGUOUS, version: '2.0.0' }));

    const codes = loadPluginsWithDiagnostics({ pluginsDir: root }).diagnostics.map((d) => d.code);

    expect(new Set(codes)).toEqual(new Set(['manifest-name-ambiguous']));
    expect(codes).not.toContain('plugin-dependency-cycle');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
