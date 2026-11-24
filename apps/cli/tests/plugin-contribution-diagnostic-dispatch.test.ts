// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTENSION_CONTRIBUTION_KINDS } from '@ihui/types';
import {
  PLUGIN_DIAGNOSTIC_CODES,
  classifyContributions,
  contributionDiagnosticsOf,
  loadPlugins,
  loadPluginsWithContributionAudit,
  loadPluginsWithDiagnostics,
  validateManifest,
  type PluginDiagnostic,
} from '../src/plugins/index.js';
import { reportPluginDiagnostics } from '../src/commands/agent.js';

/**
 * goal-b49 / W2 — 「插件贡献审计 + 默认拒」装车证据 + `loader.ts` 拆分的形状锁。
 *
 * 主席 2026-11-05 现读的缺陷:`loadPluginsWithContributionAudit` 既没从 `plugins/index.ts` 出去、
 * 生产面也零调用方(AGENTS §0.9「造好没装车」),而 `loader.ts` 已 533 行(超 §3 的 250 行上限)。
 * 本文件钉四件事:
 *   ① 拆分前后 `loader.ts` 的**导出集逐字不变**(名字集 + 引用同一实现 ⇒ 没有第二份判据,§0.6);
 *   ② `declined` 档被**诊断主通道**携带 —— 真跑 `setupAgentTools()` 那条腿并捕获 console.warn,
 *      不是只测函数本身(只测函数证不了人前可见);
 *   ③ 未知档 ⇒ 拒且点名(码专用、正文点名当前词表全量);
 *   ④ 缺权限声明 ⇒ 默认拒(正反对照:合法权限那一档必须 accepted 且**不出**拒档行,
 *      否则"恒拒"与"从不拒"在账面上长得一模一样)。
 */

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-contribution-dispatch-');
});

afterEach(() => {
  rmScratch(root);
});

/** 建一枚插件目录并写清单,返回清单文件绝对路径 */
function writePlugin(dirName: string, manifest: Record<string, unknown>): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'plugin.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf-8');
  return file;
}

function byCode(diagnostics: readonly PluginDiagnostic[], code: string): PluginDiagnostic[] {
  return diagnostics.filter((d) => d.code === code);
}

/**
 * 静态读一枚源文件的**导出名集合**(声明 + re-export 列表两类形态)。
 * 只认行首 `export`,所以水印横幅/注释里的字样不会被误收。
 */
function exportedNamesOf(source: string): string[] {
  const names = new Set<string>();
  for (const m of source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class|interface|type)\s+([A-Za-z0-9_]+)/gm)) {
    const name = m[1];
    if (name) names.add(name);
  }
  for (const m of source.matchAll(/^export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"]/gm)) {
    for (const piece of (m[1] ?? '').split(',')) {
      const token = (piece.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0] ?? '').trim();
      if (token) names.add(token);
    }
  }
  return [...names].sort();
}

function readSource(...segments: string[]): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, '..', 'src', ...segments), 'utf-8');
}

describe('① 形状锁 — loader.ts 拆分前后导出集逐字不变', () => {
  /** 拆分前(HEAD 面 533 行的 loader.ts)的导出名集合,逐字基线 */
  const LOADER_EXPORT_BASELINE = [
    'classifyContributions',
    'ContributionFinding',
    'ContributionInput',
    'ContributionSupport',
    'ContributionVerdict',
    'loadPlugins',
    'loadPluginsWithContributionAudit',
    'loadPluginsWithDiagnostics',
    'PluginContributionAudit',
    'ScanResult',
    'validateManifest',
  ].sort();

  it('源面:loader.ts 的导出名集合与拆分前逐字相等(既不增名也不掉名)', () => {
    expect(exportedNamesOf(readSource('plugins', 'loader.ts'))).toEqual(LOADER_EXPORT_BASELINE);
  });

  it('运行面:loader.js 的值导出集合与拆分前逐字相等', async () => {
    const loaderModule = (await import('../src/plugins/loader.js')) as Record<string, unknown>;
    expect(Object.keys(loaderModule).sort()).toEqual([
      'classifyContributions',
      'loadPlugins',
      'loadPluginsWithContributionAudit',
      'loadPluginsWithDiagnostics',
      'validateManifest',
    ]);
  });

  it('单一真相源:loader 只中转 contribution-audit 的实现,不是第二份判据(§0.6)', async () => {
    const loaderModule = (await import('../src/plugins/loader.js')) as Record<string, unknown>;
    const auditModule = (await import('../src/plugins/contribution-audit.js')) as Record<string, unknown>;
    expect(loaderModule.classifyContributions).toBe(auditModule.classifyContributions);
    // 装载与判定分住两处:审计层的判定不再寄住在 loader 里(拆分是真的,不是复制)
    expect(auditModule.contributionDiagnosticsOf).toBeTypeOf('function');
  });

  it('包口:plugins/index.ts 把审计公开面送出去(此前包口 0 命中 = §0.9 未装车)', async () => {
    const indexModule = (await import('../src/plugins/index.js')) as Record<string, unknown>;
    for (const name of ['classifyContributions', 'contributionDiagnosticsOf', 'loadPluginsWithContributionAudit']) {
      expect(indexModule[name], `包口缺少公开面 "${name}"`).toBeTypeOf('function');
    }
    const indexSource = readSource('plugins', 'index.ts');
    for (const typeName of [
      'ContributionFinding',
      'ContributionInput',
      'ContributionSupport',
      'ContributionVerdict',
      'PluginContributionAudit',
      'ScanResult',
    ]) {
      expect(indexSource, `包口未 re-export 类型 "${typeName}"`).toContain(typeName);
    }
  });

  it('装载器仍在 250 行以下(AGENTS §3 每页 <250 行)', () => {
    for (const file of ['loader.ts', 'contribution-audit.ts', 'manifest-scan.ts']) {
      // 与 `wc -l` 同口径：去掉文件末尾那个换行产生的空元素，否则 249 行的文件会被数成 250。
      const lines = readSource('plugins', file).replace(/\r?\n$/, '').split('\n').length;
      expect(lines, `apps/cli/src/plugins/${file} 现 ${lines} 行,超 §3 上限`).toBeLessThan(250);
    }
  });
});

describe('② 装车证明 — declined 档经 agent.ts 的诊断主通道到人前', () => {
  let tmpHome: string;
  let origHome: string;
  let origUserProfile: string | undefined;
  let origHooksConfig: string | undefined;

  beforeEach(() => {
    tmpHome = mkScratch('plugin-contribution-dispatch-home-');
    origHome = process.env.HOME ?? '';
    origUserProfile = process.env.USERPROFILE;
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    process.env.IHUI_HOOKS_CONFIG = path.join(root, 'no-hooks.json');
  });

  afterEach(() => {
    process.env.HOME = origHome;
    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
    else delete process.env.USERPROFILE;
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    rmScratch(tmpHome);
  });

  /** 把 tmpHome 的 settings.json 指向夹具插件目录(生产调用点读的就是这一份) */
  function enablePluginsFromRoot(): void {
    const settingsFile = path.join(tmpHome, '.ihui', 'settings.json');
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(
      settingsFile,
      JSON.stringify({ plugins: { enabled: true, pluginsDir: root } }),
      'utf-8',
    );
  }

  it('真跑 setupAgentTools:declined 档在 console.warn 里占一行,点名档名与清单路径', async () => {
    const manifestFile = writePlugin(
      'ui-only',
      { name: 'b49-ui-only', version: '1.0.0', permissions: ['agents:read'], contributes: { views: [{ name: 'v', capability: 'agents:read' }] } },
    );
    enablePluginsFromRoot();

    const warns: string[] = [];
    const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map((a) => String(a)).join(' '));
    });
    const { setupAgentTools } = await import('../src/commands/agent.js');
    try {
      const result = await setupAgentTools({ workspacePath: root, silent: false });
      expect(result.pluginRegistry?.has('b49-ui-only')).toBe(true);
    } finally {
      spy.mockRestore();
    }

    const declined = warns.filter((line) => line.includes('plugin-contribution-declined'));
    expect(declined, '拒档没有走到人前:agent.ts 的诊断主通道未携带贡献裁决').toHaveLength(1);
    expect(declined[0]).toContain('views');
    expect(declined[0]).toContain(manifestFile);
    // 不静默也不喧哗:未知档这次没出现,所以那条形态的不得连带冒出来
    expect(warns.some((line) => line.includes('plugin-contribution-unknown-kind'))).toBe(false);
  }, 90_000);

  it('正向对照:同一腿跑合法 wired 档 ⇒ 主通道零拒档行(否则"恒喊"与"从不喊"同形)', async () => {
    writePlugin(
      'wired-good',
      { name: 'b49-wired', version: '1.0.0', tools: ['todo_list'], permissions: ['agents:read'], contributes: { tools: [{ name: 'todo_list', capability: 'agents:read' }] } },
    );
    enablePluginsFromRoot();

    const warns: string[] = [];
    const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map((a) => String(a)).join(' '));
    });
    const { setupAgentTools } = await import('../src/commands/agent.js');
    try {
      const result = await setupAgentTools({ workspacePath: root, silent: false });
      expect(result.pluginRegistry?.has('b49-wired')).toBe(true);
    } finally {
      spy.mockRestore();
    }

    // 判的是"贡献裁决那两条码有没有出声",所以锚点必须是**码位在日志行里的形态** `[plugin:<code>]`,
    // 不是裸的 'plugin-contribution-' 子串 —— 诊断行会带上清单绝对路径,而本文件的夹具目录名
    // (mkScratch('plugin-contribution-dispatch-'))本身就含这个前缀,裸子串会把别家码的行也算进来
    // (goal-b49/Z1 的对账腿 `plugin-declaration-unconsumed` 一落地就撞上了这一格)。
    expect(warns.filter((line) => line.includes('[plugin:plugin-contribution-'))).toHaveLength(0);
  }, 90_000);

  it('派发面单测:两条贡献码都按 warning 送 logger.warn(不升任何档)', () => {
    const findings = classifyContributions({
      pluginName: 'p',
      file: 'plugin.json',
      permissions: ['agents:read'],
      contributes: { views: [{ name: 'v', capability: 'agents:read' }], bogusKind: [{ name: 'x', capability: 'agents:read' }] },
    }).findings;
    const { logger, calls } = makeCapturingLogger();
    reportPluginDiagnostics(contributionDiagnosticsOf(findings), logger);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.level === 'warn')).toBe(true);
    expect(calls.some((c) => c.msg.includes('plugin-contribution-declined') && c.msg.includes('"views"'))).toBe(true);
    expect(calls.some((c) => c.msg.includes('plugin-contribution-unknown-kind') && c.msg.includes('bogusKind'))).toBe(true);
  });
});

describe('③ 未知档 ⇒ 拒且点名(码专用 + 正文给全词表)', () => {
  it('装载结果里有一条 plugin-contribution-unknown-kind,点名该档与当前词表全量', () => {
    const manifestFile = writePlugin(
      'weird',
      { name: 'b49-weird', version: '1.0.0', permissions: ['agents:read'], contributes: { totallyBogusKind: [{ name: 'x', capability: 'agents:read' }] } },
    );
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    const unknown = byCode(result.diagnostics, 'plugin-contribution-unknown-kind');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.severity).toBe('warning');
    expect(unknown[0]?.file).toBe(manifestFile);
    expect(unknown[0]?.pluginName).toBe('b49-weird');
    expect(unknown[0]?.message).toContain('totallyBogusKind');
    for (const kind of EXTENSION_CONTRIBUTION_KINDS) {
      expect(unknown[0]?.message, `拒绝时未点名当前词表档位 "${kind}"`).toContain(kind);
    }
    // 与 declined 是两种形态,不得共用一条码(一种失效伪装成另一种 = 排查方向指错)
    expect(byCode(result.diagnostics, 'plugin-contribution-declined')).toHaveLength(0);
    // 判别码仍是封闭集
    for (const d of result.diagnostics) {
      expect(PLUGIN_DIAGNOSTIC_CODES).toContain(d.code);
    }
  });

  it('accepted 不占日志行(否则每轮造噪声),非 accepted 恰好一行', () => {
    const audit = classifyContributions({
      pluginName: 'p',
      file: 'plugin.json',
      permissions: ['agents:read'],
      contributes: { tools: [{ name: 't', capability: 'agents:read' }] },
    });
    expect(audit.acceptedCount).toBe(1);
    expect(contributionDiagnosticsOf(audit.findings)).toEqual([]);

    const declinedOnly = classifyContributions({ pluginName: 'p', file: 'plugin.json', contributes: { tools: [{ name: 't' }] } });
    expect(declinedOnly.declinedCount).toBe(1);
    expect(contributionDiagnosticsOf(declinedOnly.findings)).toHaveLength(1);
  });
});

describe('④ 缺权限声明 ⇒ 默认拒(正反对照,且拒档不阻断装载)', () => {
  it('反:声明了 wired 档但没有任何 permissions ⇒ declined + 数据类为空 + 一条 default deny 行', () => {
    const manifestFile = writePlugin(
      'no-perm',
      { name: 'b49-no-perm', version: '1.0.0', tools: ['todo_list'], contributes: { tools: [{ name: 'todo_list' }] } },
    );
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    const finding = result.contributions.findings.find((f) => f.kind === 'tools');
    expect(finding?.verdict).toBe('declined');
    expect(finding?.dataClasses).toEqual([]);

    const declined = byCode(result.diagnostics, 'plugin-contribution-declined');
    expect(declined).toHaveLength(1);
    expect(declined[0]?.file).toBe(manifestFile);
    expect(declined[0]?.message).toContain('default deny');
    // 默认拒只拒"这一档",不牵连装载本身(升档会把提示变成启动红旗)
    expect(result.plugins.map((p) => p.name)).toContain('b49-no-perm');
  });

  it('正:声明了目录里存在的权限 ⇒ accepted 且 diagnostics 零贡献行,插件照常装载', () => {
    writePlugin(
      'good',
      { name: 'b49-good', version: '1.0.0', tools: ['todo_list'], permissions: ['agents:read'], contributes: { tools: [{ name: 'todo_list', capability: 'agents:read' }] } },
    );
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    expect(result.contributions.acceptedCount).toBe(1);
    expect(byCode(result.diagnostics, 'plugin-contribution-declined')).toHaveLength(0);
    expect(byCode(result.diagnostics, 'plugin-contribution-unknown-kind')).toHaveLength(0);
    expect(result.plugins.map((p) => p.name)).toContain('b49-good');
  });

  it('既有契约不回归:两条装载出口仍可解构,薄封装仍只回数组', () => {
    writePlugin('plain', { name: 'b49-plain', version: '1.0.0' });
    const legacy = loadPluginsWithDiagnostics({ pluginsDir: root });
    expect(Object.keys(legacy).sort()).toEqual(['diagnostics', 'plugins']);
    expect(legacy.diagnostics).toEqual([]);
    expect(loadPlugins({ pluginsDir: root }).map((p) => p.name)).toEqual(['b49-plain']);
    expect(validateManifest({ name: 'x', version: '1' })).toBe(true);
  });
});

/** 捕获型 logger:每次派发改一条 {level, msg},断言只看这份记录 */
interface CapturedCall {
  level: 'info' | 'warn' | 'error';
  msg: string;
}
function makeCapturingLogger(): { logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void }; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  return {
    calls,
    logger: {
      info: (msg: string) => calls.push({ level: 'info', msg }),
      warn: (msg: string) => calls.push({ level: 'warn', msg }),
      error: (msg: string) => calls.push({ level: 'error', msg }),
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
