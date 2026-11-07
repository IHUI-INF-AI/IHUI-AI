// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 / Z1 — 扩展声明**对账腿到人前**的装车证明(2026-11-05)。
 *
 * 与 `contribution-declaration-audit.test.ts` 的分工:那一份测判定本身,这一份测
 * "判定真的挂在生产链路上" —— 真跑 `setupAgentTools()`(settings.plugins.enabled 那条腿),
 * 捕获 `console.warn`,断言未消费的声明逐行点名、合法的那份零行。
 * 桩形态与 HOME 隔离沿用 tests/plugin-contribution-diagnostic-dispatch.test.ts 那一套:
 * 只把 settings.json 指向夹具目录,不 mock 装载器,免得"人前可见"退化成"函数被调过"。
 */
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { PluginRegistry } from '../src/plugins/registry.js';
import { loadPlugins } from '../src/plugins/loader.js';
import {
  auditDeclarationConsumers,
  declarationDiagnosticsOf,
} from '../src/plugins/declaration-consumers.js';

let root: string;
let tmpHome: string;
let origHome: string;
let origUserProfile: string | undefined;

beforeEach(() => {
  root = mkScratch('z1-audit-to-person-');
  tmpHome = mkScratch('z1-audit-to-person-home-');
  origHome = process.env.HOME ?? '';
  origUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  fs.mkdirSync(path.join(tmpHome, '.ihui'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpHome, '.ihui', 'settings.json'),
    JSON.stringify({ plugins: { enabled: true, pluginsDir: root } }),
    'utf-8',
  );
});

afterEach(() => {
  process.env.HOME = origHome;
  if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
  else delete process.env.USERPROFILE;
  rmScratch(root);
  rmScratch(tmpHome);
});

function writePlugin(dirName: string, manifest: Record<string, unknown>): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'plugin.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf-8');
  return file;
}

describe('setupAgentTools 的对账腿:未消费的声明逐行到人前', () => {
  it('ghost 工具名与 ghost 命令名各占一行 warning;同批的合法 hook 声明零行(不是恒喊)', async () => {
    writePlugin('ghost', {
      name: 'z1-ghost',
      version: '1.0.0',
      tools: ['ghost-tool'],
      commands: ['ghost-slash'],
    });
    writePlugin('hooked', { name: 'z1-hooked', version: '1.0.0', hooks: ['preToolCall'] });

    const warns: string[] = [];
    const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map((a) => String(a)).join(' '));
    });
    const { setupAgentTools } = await import('../src/commands/agent.js');
    try {
      const result = await setupAgentTools({ workspacePath: root, silent: false });
      expect(result.pluginRegistry?.size()).toBe(2);
    } finally {
      spy.mockRestore();
    }

    const unconsumed = warns.filter((line) => line.includes('[plugin:plugin-declaration-unconsumed]'));
    expect(unconsumed, '对账腿没挂上生产链路:声明被读到却没有一行到人前').toHaveLength(2);
    expect(unconsumed.some((line) => line.includes('tools:ghost-tool'))).toBe(true);
    expect(unconsumed.some((line) => line.includes('commands:ghost-slash'))).toBe(true);
    // 同一次对账里合法的那份必须零行:否则"恒喊"也能过上面三行。
    // 按"结论点名的声明"判,不按正文是否出现过事件名判(未派发那条的原因里要列在册事件)。
    expect(unconsumed.some((line) => line.includes('hooks:preToolCall'))).toBe(false);
  }, 120_000);

  it('silent 模式压的是人前那一半,对账本身照跑(不把静默重新变回静默)', async () => {
    const file = writePlugin('ghost', { name: 'z1-quiet', version: '1.0.0', tools: ['ghost-tool'] });
    const { setupAgentTools } = await import('../src/commands/agent.js');
    const result = await setupAgentTools({ workspacePath: root, silent: true });
    expect(result.pluginRegistry?.size()).toBe(1);

    // 同一份清单直接对账 ⇒ 恰好一条未消费结论,路径点的就是那份清单
    const registry = new PluginRegistry({ workingDir: root });
    registry.registerAll(loadPlugins({ pluginsDir: root }));
    const findings = auditDeclarationConsumers(registry, { toolNames: ['read'], commandNames: [] });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.file).toBe(file);
    const diagnostics = declarationDiagnosticsOf(findings);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('plugin-declaration-unconsumed');
    expect(diagnostics[0]!.severity).toBe('warning');
  }, 120_000);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
