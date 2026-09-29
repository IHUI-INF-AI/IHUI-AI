// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  loadPlugins,
  loadPluginsWithDiagnostics,
  PLUGIN_DIAGNOSTIC_CODES,
  type PluginDiagnostic,
  type PluginDiagnosticCode,
} from '../src/plugins/index.js';

/**
 * G-683 — 坏清单不得静默吞。
 *
 * 钉的实测缺陷:`loader.ts` 的 `parseManifestFile` 原先是 `catch { return null }`,
 * 有隔离(单点坏清单不会让装载抛穿)但**零诊断** —— 用户侧表现只有"插件没生效",
 * 账面没有任何线索说明是哪一份、为什么。本文件断言的是"被跳过"与"留下线索"两件事
 * **必须同时成立**:只验前者,门可以一路绿地把诊断整块丢掉。
 *
 * 口径:
 *   - 每份被跳过的清单**恰好**一条诊断(不叠加、不重复计),含稳定 code 与文件路径;
 *   - 正常清单 ⇒ diagnostics 为空(正向对照 —— 否则"恒喊"与"从不喊"在账面上都一样);
 *   - `loadPlugins()` 的旧数组契约不得变(既有调用方 agent.ts 钉的就是它)。
 */

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-loader-diag-');
});

afterEach(() => {
  rmScratch(root);
});

/** 在夹具根下建一个插件子目录,返回其路径 */
function pluginDir(name: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 原样写入清单文本(不 JSON.stringify,以便造坏 JSON) */
function writeManifest(dir: string, text: string, file = 'plugin.json'): string {
  const target = path.join(dir, file);
  fs.writeFileSync(target, text, 'utf-8');
  return target;
}

/** 取本次装载的诊断里属于某个 code 的那些 */
function byCode(diagnostics: PluginDiagnostic[], code: PluginDiagnosticCode): PluginDiagnostic[] {
  return diagnostics.filter((d) => d.code === code);
}

/** 断言"恰好一条"并把它交出去 —— 任何多写/漏写都在这里翻红 */
function exactlyOne(diagnostics: PluginDiagnostic[]): PluginDiagnostic {
  expect(diagnostics).toHaveLength(1);
  const first = diagnostics[0];
  if (!first) throw new Error('unreachable: exactly one diagnostic expected');
  return first;
}

describe('G-683 坏清单装载诊断:被跳过必须报名', () => {
  it('坏 JSON ⇒ 该清单被跳过,且 diagnostics 恰 1 条含 code 与文件路径', () => {
    const dir = pluginDir('broken');
    const file = writeManifest(dir, '{ not valid json');

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    const diagnostic = exactlyOne(result.diagnostics);
    expect(diagnostic.code).toBe('manifest-json-invalid');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.file).toBe(file);
    expect(path.basename(diagnostic.file)).toBe('plugin.json');
    // 兼容出口:数组形态不得变(既有调用方按 PluginDefinition[] 写死)
    expect(loadPlugins({ pluginsDir: root })).toEqual([]);
  });

  it('缺 name ⇒ manifest-name-missing 恰 1 条', () => {
    const dir = pluginDir('no-name');
    const file = writeManifest(dir, JSON.stringify({ version: '1.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    const diagnostic = exactlyOne(result.diagnostics);
    expect(diagnostic.code).toBe('manifest-name-missing');
    expect(diagnostic.file).toBe(file);
    expect(diagnostic.message).toContain('name');
  });

  it('name 为空串与缺 name 同码(都是"必填身份缺席"),仍恰 1 条', () => {
    pluginDir('empty-name');
    writeManifest(path.join(root, 'empty-name'), JSON.stringify({ name: '', version: '1.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    expect(byCode(result.diagnostics, 'manifest-name-missing')).toHaveLength(1);
    expect(exactlyOne(result.diagnostics).code).toBe('manifest-name-missing');
  });

  it('缺 version ⇒ manifest-version-missing 恰 1 条', () => {
    const dir = pluginDir('no-version');
    const file = writeManifest(dir, JSON.stringify({ name: 'no-version' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    const diagnostic = exactlyOne(result.diagnostics);
    expect(diagnostic.code).toBe('manifest-version-missing');
    expect(diagnostic.file).toBe(file);
  });

  it.each([
    ['数组', '[1,2,3]'],
    ['字符串', '"just a string"'],
    ['数字', '123'],
    ['null', 'null'],
  ])('JSON 能解但形态不是普通对象(%s)⇒ manifest-not-object,不混进"字段缺失"', (_label, text) => {
    const dir = pluginDir('not-object');
    writeManifest(dir, text);

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    expect(exactlyOne(result.diagnostics).code).toBe('manifest-not-object');
  });

  it('清单路径读不出来(同名目录 ⇒ EISDIR)⇒ manifest-unreadable,且装载不抛穿', () => {
    const dir = pluginDir('unreadable');
    // 把 plugin.json 做成**目录**:existsSync 为真、readFileSync 必抛 —— 旧实现吞掉的就是这一类
    fs.mkdirSync(path.join(dir, 'plugin.json'), { recursive: true });

    expect(() => loadPlugins({ pluginsDir: root })).not.toThrow();
    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toEqual([]);
    const diagnostic = exactlyOne(result.diagnostics);
    expect(diagnostic.code).toBe('manifest-unreadable');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.file).toContain(path.join('unreadable', 'plugin.json'));
  });

  it('正向对照:正常清单 ⇒ plugins 在位且 diagnostics 为空(判据不是恒喊)', () => {
    const dir = pluginDir('good');
    writeManifest(
      dir,
      JSON.stringify({
        name: 'good',
        version: '1.0.0',
        description: 'ok manifest',
        tools: ['custom-tool'],
        hooks: ['preToolCall'],
        commands: ['/my-slash'],
      }),
    );

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.diagnostics).toEqual([]);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.name).toBe('good');
    expect(result.plugins[0]!.tools).toEqual(['custom-tool']);
    expect(result.plugins[0]!.source).toContain('plugin.json');
    // 旧数组出口给出同一份内容
    expect(loadPlugins({ pluginsDir: root })).toEqual(result.plugins);
  });

  it('高优先级压掉的另一份 ⇒ warning 一条并点名被忽略的文件,装载结果不变', () => {
    const dir = pluginDir('prio');
    const primary = writeManifest(dir, JSON.stringify({ name: 'from-json', version: '1.0.0' }));
    const shadowed = writeManifest(dir, JSON.stringify({ name: 'from-config', version: '1.0.0' }), 'plugin.config.json');

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.name).toBe('from-json');
    expect(result.plugins[0]!.source).toBe(primary);
    const diagnostic = exactlyOne(byCode(result.diagnostics, 'manifest-shadowed-by-priority'));
    expect(exactlyOne(result.diagnostics).severity).toBe('warning');
    expect(diagnostic.file).toBe(shadowed);
  });

  it('混合目录:一份好 + 两份坏 ⇒ 好的照旧装载,坏的两条诊断,整体不抛', () => {
    writeManifest(pluginDir('a-good'), JSON.stringify({ name: 'a-good', version: '1.0.0' }));
    writeManifest(pluginDir('b-broken'), '{ invalid');
    writeManifest(pluginDir('c-no-version'), JSON.stringify({ name: 'c-no-version' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.plugins.map((p) => p.name)).toEqual(['a-good']);
    expect(result.diagnostics).toHaveLength(2);
    expect(byCode(result.diagnostics, 'manifest-json-invalid')).toHaveLength(1);
    expect(byCode(result.diagnostics, 'manifest-version-missing')).toHaveLength(1);
  });

  it('recursive=true 时嵌套的坏清单同样逐份报名', () => {
    const deep = path.join(root, 'nested', 'deeper');
    fs.mkdirSync(deep, { recursive: true });
    writeManifest(deep, '{ invalid');

    const result = loadPluginsWithDiagnostics({ pluginsDir: root, recursive: true });

    expect(result.plugins).toEqual([]);
    expect(exactlyOne(result.diagnostics).code).toBe('manifest-json-invalid');
  });

  it('pluginsDir 不存在 / 不是目录 ⇒ 空集合且零诊断(不存在是常态,不造假噪声)', () => {
    const missing = loadPluginsWithDiagnostics({ pluginsDir: path.join(root, 'no-such-dir') });
    expect(missing).toEqual({ plugins: [], diagnostics: [] });

    const filePath = path.join(root, 'not-a-dir.txt');
    fs.writeFileSync(filePath, 'x', 'utf-8');
    const notDir = loadPluginsWithDiagnostics({ pluginsDir: filePath });
    expect(notDir.plugins).toEqual([]);
    expect(notDir.diagnostics).toEqual([]);
  });

  it('判别码是封闭集:每条产出的 code 都在 PLUGIN_DIAGNOSTIC_CODES 内', () => {
    const closed: readonly string[] = PLUGIN_DIAGNOSTIC_CODES;

    writeManifest(pluginDir('mix'), '{ invalid');
    writeManifest(pluginDir('dup'), JSON.stringify({ name: 'x', version: '1.0.0' }));
    writeManifest(path.join(root, 'dup'), JSON.stringify({ name: 'y', version: '2.0.0' }), 'plugin.config.json');

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });

    expect(result.diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of result.diagnostics) {
      expect(closed).toContain(diagnostic.code);
      expect(diagnostic.severity === 'error' || diagnostic.severity === 'warning').toBe(true);
      expect(typeof diagnostic.file).toBe('string');
      expect(diagnostic.file.length).toBeGreaterThan(0);
      expect(diagnostic.message.length).toBeGreaterThan(0);
    }
  });

  it('G-684 要求:环依赖有专属判别码,不复用同名歧义的码', () => {
    // 两条独立结论:① 集合里确有环依赖码;② 它与歧义码是**不同的两个**码,
    // 所以两条诊断的 code / 文案不可能互相顶替(排查方向被指错正是复用的代价)。
    expect(PLUGIN_DIAGNOSTIC_CODES).toContain('plugin-dependency-cycle');
    expect(PLUGIN_DIAGNOSTIC_CODES).toContain('plugin_ambiguous_name');
    expect(PLUGIN_DIAGNOSTIC_CODES.indexOf('plugin-dependency-cycle')).not.toBe(
      PLUGIN_DIAGNOSTIC_CODES.indexOf('plugin_ambiguous_name'),
    );
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
