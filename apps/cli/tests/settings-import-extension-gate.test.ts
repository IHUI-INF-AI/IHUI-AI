// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导入期「扩展 ID 集合」过滤接线锁(goal-b49 Z27b)。
 *
 * 证的是:项目层(= 仓库内容)settings 的 `plugins.extensions` 在**两条真在产导入路径**上,
 * 都会按当前产品形态过 `@ihui/types` 的单源门 —— 命中未开/未判定的具名跳过并**不落进生效配置**
 * (副作用未发生),名外扩展与非字符串项零回归。
 *
 * 反向牙(摘掉接线即翻红):第 1/3 例在"未过滤"实现下必红(被跳过的 id 会留在结果里);
 * 第 4/5 例是正向对照,证明修法没有顺手砍掉合法内容(cli 形态 / 名外 id / 非字符串项)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { evaluateExtensionImportGate } from '@ihui/types';
import {
  filterImportedExtensionIds,
  gateImportedExtensionsForProjectLayer,
  type ExtensionImportGateResult,
} from '../src/config/extension-import-gate.js';
import { filterProjectLayerSettings } from '../src/config/layer-policy.js';
import { mergeSettingsFromCwd } from '../src/commands/settings.js';

const LOCAL_WS = 'com.ihui.local-workspace';
const LOCAL_HOOKS = 'com.ihui.local-hooks';
const BROWSER_RT = 'com.ihui.browser-runtime';
const UNLISTED = 'com.other.unlisted-ext';

/** 取合并后 plugins.extensions 里的字符串 id 集合(用于断言"被跳过的没落盘")。 */
function landedIds(plugins: unknown): string[] {
  const ext = (plugins as { extensions?: unknown } | undefined)?.extensions;
  return Array.isArray(ext) ? ext.filter((x): x is string => typeof x === 'string') : [];
}

describe('单源评价器 evaluateExtensionImportGate(判据本体,零复算)', () => {
  it('cli 形态:三面全开 ⇒ 名内扩展一律 kept', () => {
    for (const id of [LOCAL_WS, LOCAL_HOOKS, BROWSER_RT]) {
      expect(evaluateExtensionImportGate(id, 'cli').decision).toBe('kept');
    }
  });

  it('web 形态:localWorkspace/localHooks 判关 ⇒ skipped;browserRuntime 未登记 ⇒ unjudged(不放行)', () => {
    expect(evaluateExtensionImportGate(LOCAL_WS, 'web').decision).toBe('skipped');
    expect(evaluateExtensionImportGate(LOCAL_HOOKS, 'web').decision).toBe('skipped');
    expect(evaluateExtensionImportGate(BROWSER_RT, 'web').decision).toBe('unjudged');
  });

  it('未登记形态 ⇒ 名内扩展 unjudged(取不到判定绝不记绿,§0.3)', () => {
    expect(evaluateExtensionImportGate(LOCAL_WS, 'not-a-form').decision).toBe('unjudged');
  });

  it('名外扩展 ⇒ kept(不受形态门管辖,零回归)', () => {
    expect(evaluateExtensionImportGate(UNLISTED, 'web').decision).toBe('kept');
  });

  it('集合取不到(null)⇒ unjudged 不放行(§0.3)', () => {
    expect(evaluateExtensionImportGate(LOCAL_WS, 'cli', null).decision).toBe('unjudged');
  });
});

describe('项目层过滤 filterImportedExtensionIds(纯函数)', () => {
  const web = { form: 'web', source: 'declared', reason: '' } as const;
  const cli = { form: 'cli', source: 'declared', reason: '' } as const;

  it('web:命中的 localWorkspace 被摘出 extensions,名外的照常留', () => {
    const r = filterImportedExtensionIds({ enabled: true, extensions: [LOCAL_WS, UNLISTED] }, web);
    expect(landedIds(r.value)).toEqual([UNLISTED]);
    expect(r.skipped.map((s) => s.id)).toEqual([LOCAL_WS]);
  });

  it('cli:全部 kept ⇒ value 逐字原样(零回归)', () => {
    const plugins = { enabled: true, extensions: [LOCAL_WS, LOCAL_HOOKS] };
    const r = filterImportedExtensionIds(plugins, cli);
    expect(r.skipped).toHaveLength(0);
    expect(r.value).toEqual(plugins);
  });

  it('非字符串项原样保留,不被顺手丢弃', () => {
    const r = filterImportedExtensionIds({ extensions: [123, LOCAL_WS, { keep: true }] }, web);
    const ext = (r.value as { extensions: unknown[] }).extensions;
    expect(ext).toEqual([123, { keep: true }]);
  });

  it('没有 extensions / plugins 不是对象 ⇒ 逐字原样返回', () => {
    expect(filterImportedExtensionIds({ enabled: true }, web).skipped).toHaveLength(0);
    expect(filterImportedExtensionIds('nope', web).value).toBe('nope');
  });
});

describe('具名出声 gateImportedExtensionsForProjectLayer', () => {
  it('跳过必须点名被跳过的 id(带 id 与形态)', () => {
    const lines: string[] = [];
    const res = gateImportedExtensionsForProjectLayer(
      { extensions: [LOCAL_WS] },
      { form: 'web', source: 'declared', reason: '' },
      (line) => lines.push(line),
    );
    const text = lines.join('\n');
    expect(text).toContain(LOCAL_WS);
    expect(text).toContain('web');
    expect(text).toContain('未合入配置');
    expect((res as ExtensionImportGateResult).skipped[0]?.decision).toBe('skipped');
  });

  it('无跳过 ⇒ 不出声', () => {
    const lines: string[] = [];
    gateImportedExtensionsForProjectLayer({ extensions: [] }, { form: 'cli', source: 'declared', reason: '' }, (l) =>
      lines.push(l),
    );
    expect(lines).toHaveLength(0);
  });
});

describe('filterProjectLayerSettings 接线(共用导入判据,不新增第二份门)', () => {
  it('project plugins.extensions 命中门 ⇒ accepted 里摘掉并计入 skippedExtensions', () => {
    const r = filterProjectLayerSettings(
      { plugins: { enabled: true, extensions: [LOCAL_WS, UNLISTED] } },
      { form: 'web', source: 'declared', reason: '' },
    );
    expect(landedIds(r.accepted.plugins)).toEqual([UNLISTED]);
    expect(r.skippedExtensions.map((s) => s.id)).toEqual([LOCAL_WS]);
  });

  it('没带 plugins 的项目层配置 ⇒ 既有 accepted/rejected 语义一字不动', () => {
    const r = filterProjectLayerSettings({ allowDangerous: true, defaultModel: 'fast' });
    expect(r.accepted.defaultModel).toBe('fast');
    expect(r.rejected.map((x) => x.key)).toContain('allowDangerous');
    expect(r.skippedExtensions).toEqual([]);
  });
});

// —— 真在产路径(mergeSettingsFromCwd)——落盘文件 → 生效配置——
const tmpRoots: string[] = [];
function sandboxProjectSettings(content: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-extgate-'));
  tmpRoots.push(root);
  const cwd = path.join(root, 'repo');
  fs.mkdirSync(path.join(cwd, '.ihui'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.ihui', 'settings.json'), JSON.stringify(content), 'utf-8');
  return cwd;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.IHUI_PRODUCT_FORM;
  for (const r of tmpRoots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

describe('真实导入路径 mergeSettingsFromCwd:命中形态门的扩展不落进生效配置', () => {
  it('web 形态:localWorkspace 被过滤(反例),名外扩展照常合入(正向对照)', () => {
    process.env.IHUI_PRODUCT_FORM = 'web';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cwd = sandboxProjectSettings({
      plugins: { enabled: true, extensions: [LOCAL_WS, UNLISTED] },
    });
    const merged = mergeSettingsFromCwd(cwd) as Record<string, unknown>;
    expect(landedIds(merged.plugins)).toEqual([UNLISTED]);
    const text = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(text).toContain(LOCAL_WS);
  });

  it('cli 形态(缺省):三面全开 ⇒ 名内扩展照常合入(零回归)', () => {
    process.env.IHUI_PRODUCT_FORM = 'cli';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cwd = sandboxProjectSettings({ plugins: { enabled: true, extensions: [LOCAL_WS] } });
    const merged = mergeSettingsFromCwd(cwd) as Record<string, unknown>;
    expect(landedIds(merged.plugins)).toEqual([LOCAL_WS]);
  });

  it('未登记形态 ⇒ 名内扩展 unjudged 不放行(§0.3)并点名', () => {
    process.env.IHUI_PRODUCT_FORM = 'not-a-form';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cwd = sandboxProjectSettings({ plugins: { enabled: true, extensions: [LOCAL_WS] } });
    const merged = mergeSettingsFromCwd(cwd) as Record<string, unknown>;
    expect(landedIds(merged.plugins)).toEqual([]);
    const text = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(text).toContain(LOCAL_WS);
    expect(text).toContain('未判定⇒不放行');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
