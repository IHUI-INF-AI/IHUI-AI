// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 / Z1 — 扩展声明对账腿的用例(2026-11-05)。
 *
 * 钉的是"这条声明最后真的被**读到**了",不是"registry 返回了字符串数组"(那是 X2 已经钉过的一格):
 * 夹具是一份真在盘上的 `plugin.json`,走真装载器 → 真 registry → 真对账函数 → 真诊断构造,
 * 断言落在**到人前那一行**的内容上。正向对照同样关键:名字在宿主名面里时必须**零行**,
 * 否则"恒喊"与"真判过"在账面上同形。
 *
 * 命令族只许读 `ACTIVATION_POLICY.onCommand`(§0.6 判据单源),本用例把"逐字来自那一份"钉死 ——
 * 将来谁在对账层里另写一份命令裁决,这里第一个红。
 */
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ACTIVATION_POLICY } from '../src/plugins/activation-events.js';
import { loadPlugins } from '../src/plugins/loader.js';
import { PluginRegistry } from '../src/plugins/registry.js';
import { PLUGIN_HOOK_EVENTS, auditDeclarationConsumers, declarationDiagnosticsOf } from '../src/plugins/declaration-consumers.js';
import type { DeclarationFinding, HostNameSurface } from '../src/plugins/declaration-consumers.js';

let root: string;

beforeEach(() => {
  root = mkScratch('z1-declaration-audit-');
});

afterEach(() => {
  rmScratch(root);
});

/** 宿主名面的夹具替身(真调用点交给 setupAgentTools:工具表 = listTools(),命令表 = getAllSlashNames()) */
const HOST: HostNameSurface = { toolNames: ['read', 'write'], commandNames: ['/help', '/model'] };

function writePlugin(dirName: string, manifest: Record<string, unknown>): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'plugin.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf-8');
  return file;
}

function registryOf(...definitions: Parameters<PluginRegistry['register']>[0][]): PluginRegistry {
  const registry = new PluginRegistry({ workingDir: root });
  registry.registerAll(definitions);
  return registry;
}

function findingFor(findings: readonly DeclarationFinding[], family: string, declaration: string): DeclarationFinding {
  const hit = findings.find((f) => f.family === family && f.declaration === declaration);
  expect(hit, `对账没有读到 ${family}:${declaration}`).toBeTruthy();
  return hit as DeclarationFinding;
}

describe('① 最后一公里:盘上清单 → 装载 → 注册 → 对账 → 到人前的那一行', () => {
  it('声明了宿主没有的工具名 ⇒ 恰好一条 plugin-declaration-unconsumed,点名族名/名字/清单路径', () => {
    const file = writePlugin('ghost', { name: 'z1-ghost', version: '1.0.0', tools: ['ghost-tool'] });
    const registry = registryOf(...loadPlugins({ pluginsDir: root }));

    const findings = auditDeclarationConsumers(registry, HOST);
    const finding = findingFor(findings, 'tools', 'ghost-tool');
    expect(finding.consumed).toBe(false);
    expect(finding.reasonCode).toBe('no-host-implementation');
    expect(finding.pluginNames).toEqual(['z1-ghost']);
    expect(finding.file).toBe(file);

    const diagnostics = declarationDiagnosticsOf(findings);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('plugin-declaration-unconsumed');
    // 被本宿主吃不下 ≠ 装载失败:与 contribution/activation 两族同训,刻意不升 error(§12e)
    expect(diagnostics[0]!.severity).toBe('warning');
    expect(diagnostics[0]!.file).toBe(file);
    expect(diagnostics[0]!.message).toContain('tools:ghost-tool');
    expect(diagnostics[0]!.message).toContain('no runtime consumer');
  });

  it('正向对照:名字命中宿主工具表 ⇒ consumed 且零诊断(否则"恒喊"与"真判"同形)', () => {
    writePlugin('hit', { name: 'z1-hit', version: '1.0.0', tools: ['read'] });
    const registry = registryOf(...loadPlugins({ pluginsDir: root }));
    const findings = auditDeclarationConsumers(registry, HOST);
    expect(findingFor(findings, 'tools', 'read').consumed).toBe(true);
    expect(declarationDiagnosticsOf(findings)).toEqual([]);
  });
});

describe('② hook 事件段:只认 PLUGIN_HOOK_EVENTS 这一份单源', () => {
  const registry = () =>
    registryOf(
      { name: 'p-hook', version: '1.0.0', hooks: ['preToolCall', 'postToolCall:read', 'onFileChanged'] },
    );

  it('纯事件名与带 matcher 的写法都算被派发;词表外的事件段逐条点名', () => {
    const findings = auditDeclarationConsumers(registry(), HOST);
    expect(findingFor(findings, 'hooks', 'preToolCall').consumed).toBe(true);
    expect(findingFor(findings, 'hooks', 'postToolCall:read').consumed).toBe(true);
    const dead = findingFor(findings, 'hooks', 'onFileChanged');
    expect(dead.consumed).toBe(false);
    expect(dead.reasonCode).toBe('event-never-dispatched');
    expect(dead.reasons.join(' ')).toContain(PLUGIN_HOOK_EVENTS.join('/'));
  });

  it('未派发的声明出恰好一行,已派发的不得连带冒出来', () => {
    const diagnostics = declarationDiagnosticsOf(auditDeclarationConsumers(registry(), HOST));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('onFileChanged');
    // 已派发的那两条不得连带出声(按"结论里点名的声明"判,不按正文是否出现过事件名判 ——
    // 未派发那条的原因里本来就要列出在册事件清单)
    expect(diagnostics.some((d) => d.message.includes('hooks:preToolCall'))).toBe(false);
    expect(diagnostics.some((d) => d.message.includes('hooks:postToolCall'))).toBe(false);
  });
});

describe('③ 命令族:裁决只读 ACTIVATION_POLICY,本层不得有第二份', () => {
  it('插件命令没有注册通道 ⇒ 未消费,且原因逐字来自 ACTIVATION_POLICY.onCommand', () => {
    const registry = registryOf({ name: 'z1-cmd', version: '1.0.0', commands: ['my-cmd'] });
    const finding = findingFor(auditDeclarationConsumers(registry, HOST), 'commands', 'my-cmd');
    expect(finding.consumed).toBe(false);
    expect(finding.reasonCode).toBe('no-command-channel');
    expect(finding.reasons).toContain(ACTIVATION_POLICY.onCommand.reason);
  });

  it('撞了宿主在册命令名(两侧归一前导斜杠)⇒ 另一条原因码,不混成"没有通道"', () => {
    const registry = registryOf({ name: 'z1-cmd', version: '1.0.0', commands: ['/help', 'model'] });
    const findings = auditDeclarationConsumers(registry, HOST);
    for (const name of ['/help', 'model']) {
      expect(findingFor(findings, 'commands', name).reasonCode).toBe('command-name-belongs-to-host');
    }
  });
});

describe('④ contributor 两族:回调在宿主代码里才算数', () => {
  it('程序化注册带了回调 ⇒ consumed 且零诊断', () => {
    const registry = registryOf({
      name: 'z1-cb',
      version: '1.0.0',
      turnInputContributors: ['ctx-loader'],
      commandContributors: ['lint'],
      onTurnInputContribute: () => 'x',
      onCommandContribute: () => {},
    });
    const findings = auditDeclarationConsumers(registry, HOST);
    expect(findingFor(findings, 'turnInputContributors', 'ctx-loader').reasonCode).toBe('callback-registered');
    expect(findingFor(findings, 'commandContributors', 'lint').consumed).toBe(true);
    expect(declarationDiagnosticsOf(findings)).toEqual([]);
  });

  it('清单声明(永远给不出回调)⇒ callback-missing,两族各出一行', () => {
    writePlugin('contrib', {
      name: 'z1-contrib',
      version: '1.0.0',
      turnInputContributors: ['ctx-loader'],
      commandContributors: ['lint'],
    });
    const registry = registryOf(...loadPlugins({ pluginsDir: root }));
    const findings = auditDeclarationConsumers(registry, HOST);
    expect(findingFor(findings, 'turnInputContributors', 'ctx-loader').reasonCode).toBe('callback-missing');
    expect(findingFor(findings, 'commandContributors', 'lint').consumed).toBe(false);
    expect(declarationDiagnosticsOf(findings)).toHaveLength(2);
  });
});

describe('⑤ 汇总口的"去重"这一维真的被用了', () => {
  it('两份清单声明同一个工具名 ⇒ 一条结论、两个归属插件(按名排序稳定)', () => {
    writePlugin('a', { name: 'aa-plug', version: '1.0.0', tools: ['shared-ghost'] });
    writePlugin('b', { name: 'bb-plug', version: '1.0.0', tools: ['shared-ghost'] });
    const registry = registryOf(...loadPlugins({ pluginsDir: root }));
    const findings = auditDeclarationConsumers(registry, HOST);
    const shared = findings.filter((f) => f.family === 'tools' && f.declaration === 'shared-ghost');
    expect(shared).toHaveLength(1);
    expect(shared[0]!.pluginNames).toEqual(['aa-plug', 'bb-plug']);
    expect(declarationDiagnosticsOf(findings)).toHaveLength(1);
  });

  it('零声明的 registry ⇒ 零结论(不把"没判"写成"判过")', () => {
    expect(auditDeclarationConsumers(registryOf(), HOST)).toEqual([]);
    expect(declarationDiagnosticsOf([])).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
