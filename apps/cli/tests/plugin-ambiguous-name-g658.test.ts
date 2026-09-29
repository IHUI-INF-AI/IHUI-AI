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
 * G-658 — 插件同名 fail-closed + 结构化诊断面。
 *
 * 票面:同名不同 rootPath ⇒ 禁止 last-write-wins 与按显示名猜,diagnostics 随产物一起
 * 返回(不抛断流程);不得留"后扫到的覆盖前者"。验收:两同名夹具必出
 * **plugin_ambiguous_name**,且加载顺序翻转结论不变。
 *
 * 与 plugin-name-ambiguity.test.ts(G-684)钉同一裁决面的两侧:那张钉"装载体"
 * (同名一个不装、逐份点名、镜像对照),本张钉 G-658 点名的判别码本体
 * plugin_ambiguous_name 与「顺序翻转结论不变」。变异对照:把收集改回
 * results.set(name, def)(last-write-wins),①③的产物断言与②的"两序同形"同时翻红。
 */

const AMBIGUOUS = 'dup-g658';

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-ambiguous-g658-');
});

afterEach(() => {
  rmScratch(root);
});

/** 在夹具根下建一个同名插件子目录(不同 rootPath),返回其清单路径 */
function writeManifest(dirName: string, text: string): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'plugin.json');
  fs.writeFileSync(target, text, 'utf-8');
  return target;
}

/** G-658 点名的判别码过滤(按 code 断流程,不靠 message 文本猜) */
function ambiguousOf(diagnostics: PluginDiagnostic[]): PluginDiagnostic[] {
  return diagnostics.filter((d) => d.code === 'plugin_ambiguous_name');
}

describe('G-658 同名 fail-closed:plugin_ambiguous_name 随产物返回', () => {
  it('两同名夹具(不同 rootPath)⇒ 必出 plugin_ambiguous_name,且两份都不装载', () => {
    const first = writeManifest('first', JSON.stringify({ name: AMBIGUOUS, version: '1.0.0', description: 'first body' }));
    const second = writeManifest('second', JSON.stringify({ name: AMBIGUOUS, version: '2.0.0', description: 'second body' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    // ① 产物面:diagnostics 与 plugins 同体返回(结构化诊断面),同名一个都不装
    expect(result.plugins).toEqual([]);
    expect(loadPlugins({ pluginsDir: root })).toEqual([]); // 兼容出口同形,旧契约不得变
    // ② 诊断面:恰好两条 plugin_ambiguous_name,逐份点名双方路径
    const ambiguous = ambiguousOf(result.diagnostics);
    expect(ambiguous).toHaveLength(2);
    expect(ambiguous.map((d) => d.file).sort()).toEqual([first, second].sort());
    for (const diagnostic of ambiguous) {
      expect(diagnostic.severity).toBe('error');
      expect(diagnostic.pluginName).toBe(AMBIGUOUS);
      const other = diagnostic.file === first ? second : first;
      expect(diagnostic.relatedFiles).toEqual([other]);
    }
    // ③ 无胜者:两条诊断结构对称,没有任何"哪份生效"的信息(后扫到的不得覆盖前者)
    expect(result.plugins.some((p) => p.name === AMBIGUOUS)).toBe(false);
  });

  it('加载顺序翻转结论不变:镜像夹具(内容对调)两次装载逐字同形,不偏向任何一方', () => {
    const mirror = mkScratch('plugin-ambiguous-g658-mirror-');
    try {
      const write = (base: string, dirName: string, version: string): string => {
        const dir = path.join(base, dirName);
        fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, 'plugin.json');
        fs.writeFileSync(target, JSON.stringify({ name: AMBIGUOUS, version }), 'utf-8');
        return target;
      };
      // root:aaa(先扫到)=v1.0.0;mirror:内容对调 ⇒ 先扫到的换成 v2.0.0,
      // 两序的"枚举第一份"不同 —— last-write-wins 回潮时生效方必互换,本格必红。
      const rootFiles = [write(root, 'aaa', '1.0.0'), write(root, 'zzz', '2.0.0')].sort();
      const mirrorFiles = [write(mirror, 'aaa', '2.0.0'), write(mirror, 'zzz', '1.0.0')].sort();

      const a = loadPluginsWithDiagnostics({ pluginsDir: root });
      const b = loadPluginsWithDiagnostics({ pluginsDir: mirror });

      // 两次结论同形:都一个不装、各恰 2 条 plugin_ambiguous_name(error、点名同名)
      for (const result of [a, b]) {
        expect(result.plugins).toEqual([]);
        const ambiguous = ambiguousOf(result.diagnostics);
        expect(ambiguous).toHaveLength(2);
        for (const diagnostic of ambiguous) {
          expect(diagnostic.code).toBe('plugin_ambiguous_name');
          expect(diagnostic.severity).toBe('error');
          expect(diagnostic.pluginName).toBe(AMBIGUOUS);
        }
      }
      // 诊断只点名本目录树里的路径,互不串;两序文件集与内容落在哪个目录无关
      expect(ambiguousOf(a.diagnostics).map((d) => d.file).sort()).toEqual(rootFiles);
      expect(ambiguousOf(b.diagnostics).map((d) => d.file).sort()).toEqual(mirrorFiles);
    } finally {
      rmScratch(mirror);
    }
  });

  it('正向对照:名字互不相同 ⇒ 两份都装载且零 plugin_ambiguous_name(判据不恒喊)', () => {
    writeManifest('first', JSON.stringify({ name: 'p1-g658', version: '1.0.0' }));
    writeManifest('second', JSON.stringify({ name: 'p2-g658', version: '2.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins.map((p) => p.name).sort()).toEqual(['p1-g658', 'p2-g658']);
    expect(ambiguousOf(result.diagnostics)).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });
});
