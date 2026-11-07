// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlugins, loadPluginsWithDiagnostics, type PluginDefinition } from '../src/plugins/index.js';
import { isFolderTrusted, saveTrustedFolderRecord } from '../src/hooks/trust.js';

/**
 * goal-b49 / Z31 —— 「插件能不能带可执行入口」当场代裁后的**行为级反向牙**(裁决 = 今天不开,已裁未开)。
 *
 * Z13 那把锁(`plugin-entry-channel-lock.test.ts`)钉的是**静态文本**:loader.ts/manifest-scan.ts 里
 * 出现 `import(`/`require(` 就红。静态尺有一个打不中的方向 —— 有人可以用 `createRequire`、
 * `Module._load`、或改个字面量拼法绕过去,文本照样干净、代码照跑。本文件补的就是那一格:
 * **真装载一份带约定入口件(`index.js`)的插件,断言副作用没发生**(§5「越权用例必须断言
 * 副作用没发生」+ 正向对照成对留)。
 *
 * 三条现读事实(本文件的射程边界,逐条有对应用例):
 *   ① 入口件**本身可被执行**(正向对照 —— 不先证这一条,下面所有"未置位"都毫无意义);
 *   ② 目录**未**被显式信任 ⇒ 装载零执行(默认拒那一档);
 *   ③ 目录**已**被显式信任(经 `hooks/trust.ts` 的正规写点登记,带内容摘要)⇒ 装载**仍**零执行,
 *      因为 `LoadPluginsOptions` 根本没有信任/摘要入参,装载器从不问信任面 ——
 *      这一条就是"最小执行通道今天缺的那一环"的机器可见形态:**信任面已在(可 import)、
 *      执行面未接(装载器无从信任与否都走同一条静默忽略)**。
 *   ④ 现状审计:入口件既不生成诊断、也不改变诊断(与无入口件的那份清单逐字同形)——
 *      将来谁开通道,必须**当场**改这一条用例,不许让它静默变成"默默执行"。
 */

/** 入口件被求值时挂到 globalThis 的标记名(CJS/ESM 两形通用,不依赖模块格式) */
const MARKER_GLOBAL = '__IHUI_B49_Z31_ENTRY_RAN__';
const ENTRY_TEXT = `globalThis.${MARKER_GLOBAL} = true;\n`;

/** 装载器结构上给不出的那五枚回调位(PluginDefinition 里唯一的"可执行"槽位) */
const CALLABLE_SLOTS = ['setup', 'teardown', 'onHook', 'onTurnInputContribute', 'onCommandContribute'] as const;

function markerRan(): boolean {
  return (globalThis as Record<string, unknown>)[MARKER_GLOBAL] === true;
}
function clearMarker(): void {
  delete (globalThis as Record<string, unknown>)[MARKER_GLOBAL];
}

let root: string;
let trustFile: string;

beforeEach(() => {
  root = mkScratch('plugin-load-entry-');
  trustFile = path.join(root, 'trusted-folders');
  clearMarker();
});

afterEach(() => {
  clearMarker();
  rmScratch(root);
});

/** 在 base 下建一枚插件目录;entry=true 时在同目录放一份真可执行的约定入口件 */
function makePlugin(dir: string, entry: boolean): string {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'plugin.json'),
    JSON.stringify({ name: path.basename(dir), version: '1.0.0', tools: ['plugin-tool'] }, null, 2),
    'utf-8',
  );
  if (entry) fs.writeFileSync(path.join(dir, 'index.js'), ENTRY_TEXT, 'utf-8');
  return dir;
}

describe('正向对照:入口件本身真的可被执行', () => {
  it('直接 import 那份 index.js ⇒ 标记置位(否则本文件的"未置位"全是空断言)', async () => {
    const dir = makePlugin(path.join(root, 'z31-direct'), true);
    expect(markerRan()).toBe(false);
    await import(pathToFileURL(path.join(dir, 'index.js')).href);
    expect(markerRan()).toBe(true);
  });
});

describe('反例①:目录未被显式信任 ⇒ 零动态 import、零副作用', () => {
  it('清单在盘、插件在册,但约定入口件从未被求值', () => {
    const dir = makePlugin(path.join(root, 'z31-untrusted'), true);
    expect(isFolderTrusted(dir, undefined, trustFile)).toBe(false);
    const plugins = loadPlugins({ pluginsDir: root });
    expect(plugins.map((p) => p.name)).toEqual(['z31-untrusted']);
    expect(markerRan()).toBe(false);
  });
});

describe('反例②:目录已被显式信任 ⇒ 今天仍然零执行(缺的是执行面,不是信任面)', () => {
  it('信任登记成功(信任面现读可用),装载结论与未信任时逐字同形', () => {
    const dir = makePlugin(path.join(root, 'z31-trusted'), true);
    expect(saveTrustedFolderRecord(dir, 'z31-fixture-bundle-digest', {}, trustFile)).toBe(true);
    expect(isFolderTrusted(dir, undefined, trustFile)).toBe(true);
    const plugins = loadPlugins({ pluginsDir: root });
    expect(plugins).toHaveLength(1);
    expect(markerRan()).toBe(false);
    // 装载出口给不出一份 definition 自带的可执行体:JSON 清单路径结构上产不出回调
    const def: PluginDefinition | undefined = plugins[0];
    expect(def).toBeDefined();
    for (const slot of CALLABLE_SLOTS) {
      expect({ slot, kind: typeof def?.[slot] }).toEqual({ slot, kind: 'undefined' });
    }
  });
});

describe('现状审计:入口件既不生成诊断、也不改变诊断', () => {
  it('同内容清单「有 index.js」与「无 index.js」两次装载的 diagnostics 逐字同形', () => {
    const withRoot = path.join(root, 'face-with-entry');
    const plainRoot = path.join(root, 'face-no-entry');
    makePlugin(path.join(withRoot, 'z31-audit'), true);
    makePlugin(path.join(plainRoot, 'z31-audit'), false);
    const withEntry = loadPluginsWithDiagnostics({ pluginsDir: withRoot });
    const withoutEntry = loadPluginsWithDiagnostics({ pluginsDir: plainRoot });
    // 正向对照:两边都真装载了 ⇒ "诊断同形"不是因为两边都失败
    expect(withEntry.plugins.map((p) => p.name)).toEqual(['z31-audit']);
    expect(withoutEntry.plugins.map((p) => p.name)).toEqual(['z31-audit']);
    expect(markerRan()).toBe(false);
    const shape = (list: typeof withEntry.diagnostics) =>
      list.map((d) => ({ code: d.code, severity: d.severity, pluginName: d.pluginName }));
    expect(shape(withEntry.diagnostics)).toEqual(shape(withoutEntry.diagnostics));
    // 今天这一形只可能是"两边都零诊断"。谁开通了道(执行 or 至少出声),都必须当场改这一条 ——
    // 不允许把"默默执行了入口件"写成对账上的绿(§0.10 失效方向)。
    expect(withEntry.diagnostics).toHaveLength(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
