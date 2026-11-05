// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 / Z13 — 插件工具/命令的「真装载」今天**做不到**的一手证据锁(反空壳锁)。
 *
 * 结论(Z1 未竟 1/2 的现读复判):清单声明的 `tools` / `commands` 名字**不能**接进宿主工具表或
 * slash 表,因为声明背后拿不出可执行入口。三条实测证据(本用例各钉一条,任何一条翻红=前提变了):
 *   ① 契约禁字段:共享层 `packages/types/src/capability-extensions.ts` 的 `FORBIDDEN_EXECUTABLE_FIELDS`
 *      (exec/script/command/shell/bin/main/run/…)由同一文件的 manifest 校验器强制,正文写明
 *      「manifest 只允许声明式配置」——插件清单**按契约**带不了入口。
 *   ② 装载器白名单式取字段:`normalizeManifest` 只拷贝 schema 内的 9 个键,`main`/`entry`/`module`
 *      写进 plugin.json 也在装载层被静默丢掉 ⇒ 到不了 registry(见下面那条断言)。
 *   ③ 装载路径零代码执行:`loader.ts` / `manifest-scan.ts` 里没有 `import(`/`require(`/`node:vm`
 *      /`child_process` —— 唯一可能承载可执行体的 git-runner 只跑 git,不跑插件代码。
 *
 * 解锁真装载需要的前置(全在本席白名单外,不由本票顺手造通道):
 *   a. 产品/安全裁决:放开(或另立)可执行入口字段,并给插件代码一条**信任门 + 落盘来源核验**
 *      (可参照 `src/hooks/` 的 trust gate 形态)——§1 契约级动作,归 packages/**。
 *   b. 宿主消费侧:工具表 `apps/cli/src/tools/index.ts#registerTools(Tool[])` 与
 *      slash 通道 `apps/cli/src/commands/slash-registry.ts` + `repl.ts`(Z2 席射程)。
 *   c. 同批把 `ACTIVATION_POLICY.onCommand` 由 `reject` 翻成 `defer`(带真调用点),否则对账层
 *      与派发层口径漂开(§0.6)。
 *
 * 本用例同时钉死「严禁造假消费者」:插件层**不得**因为本票而开始 import 宿主工具表/slash 表,
 * 且声明名在吃不下的宿主里仍逐条出声(`no-host-implementation` / `no-command-channel`)。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import type { PluginRegistry } from '../src/plugins/registry.js';
import { normalizeManifest } from '../src/plugins/manifest-scan.js';
import { auditDeclarationConsumers } from '../src/plugins/declaration-consumers.js';

/** 装载路径上的源文件(取源码文本,不执行)。 */
function sourceOf(file: string): string {
  return fs.readFileSync(new URL(`../src/plugins/${file}`, import.meta.url), 'utf-8');
}

function findingOf(registry: PluginRegistry, family: 'tools' | 'commands', name: string) {
  return auditDeclarationConsumers(registry, { toolNames: ['read_file'], commandNames: ['/help'] }).find(
    (f) => f.family === family && f.declaration === name,
  );
}

describe('证据②:清单声明式契约 —— 可执行入口字段到不了注册表面', () => {
  it('normalizeManifest 只保 schema 内的键;main/entry/module/exec/bin 一律不落 definition', () => {
    const raw = {
      name: 'would-be-code-plugin',
      version: '1.0.0',
      tools: ['plugin-tool'],
      commands: ['plugin-cmd'],
      // 以下四枚均非 PluginManifest 字段(schema 里没有入口位;契约把它们列为禁止项)
      main: './index.js',
      entry: './entry.mjs',
      module: './lib.js',
      bin: './run.exe',
    };
    const def = normalizeManifest(raw, '/plugins/would-be-code-plugin/plugin.json');
    for (const forbidden of ['main', 'entry', 'module', 'bin', 'exec', 'script', 'shell', 'run']) {
      expect(Object.prototype.hasOwnProperty.call(def, forbidden)).toBe(false);
    }
    // 声明名透传(所以它们只能被"对账",不能被"执行")
    expect(def.tools).toEqual(['plugin-tool']);
    expect(def.commands).toEqual(['plugin-cmd']);
  });
});

describe('证据③:装载路径不执行任何代码', () => {
  it('loader.ts / manifest-scan.ts 没有动态 import、require、vm、child_process', () => {
    for (const file of ['loader.ts', 'manifest-scan.ts']) {
      const text = sourceOf(file);
      expect({ file, dynamicImport: /\bimport\s*\(/.test(text) }).toEqual({ file, dynamicImport: false });
      expect({ file, requireCall: /\brequire\s*\(/.test(text) }).toEqual({ file, requireCall: false });
      expect({ file, nativeVm: text.includes('node:vm') }).toEqual({ file, nativeVm: false });
      expect({ file, childProcess: text.includes('node:child_process') }).toEqual({ file, childProcess: false });
    }
  });
});

describe('反空壳锁:本票没有把声明名接成假消费者', () => {
  it('插件层不 import 宿主工具表 / slash 注册通道(接进去就是只被测试喂数据的空壳,§0.9)', () => {
    const faces = {
      'declaration-consumers.ts': sourceOf('declaration-consumers.ts'),
      'registry.ts': sourceOf('registry.ts'),
      'plugin-dispatch.ts': sourceOf('plugin-dispatch.ts'),
      'loader.ts': sourceOf('loader.ts'),
    };
    for (const [file, text] of Object.entries(faces)) {
      expect({ file, toolTableImport: /from '\.\.\/tools\//.test(text) }).toEqual({ file, toolTableImport: false });
      expect({ file, slashImport: /slash-registry/.test(text) }).toEqual({ file, slashImport: false });
    }
  });

  it('工具名/命令名在吃不下的宿主里仍逐条出声(reasonCode 现读,不冒绿)', async () => {
    const { PluginRegistry } = await import('../src/plugins/registry.js');
    const registry = new PluginRegistry({ workingDir: process.cwd() });
    registry.register({ name: 'p', version: '1.0.0', tools: ['plugin-tool'], commands: ['plugin-cmd'] });
    expect(findingOf(registry, 'tools', 'plugin-tool')?.consumed).toBe(false);
    expect(findingOf(registry, 'tools', 'plugin-tool')?.reasonCode).toBe('no-host-implementation');
    expect(findingOf(registry, 'commands', 'plugin-cmd')?.consumed).toBe(false);
    expect(findingOf(registry, 'commands', 'plugin-cmd')?.reasonCode).toBe('no-command-channel');
    // 正向对照:宿主工具表真有的名字才叫"被消费"(它可以当 hook matcher 的名字用)。
    // 「没有把任何插件名注册进工具表」这一条由上面那把静态尺子钉(插件层不得 import ../tools/),
    // 这里刻意不 import tools/index.js —— 那枚动态 import 把本用例从 40ms 拖到 43s。
    registry.register({ name: 'q', version: '1.0.0', tools: ['read_file'] });
    expect(findingOf(registry, 'tools', 'read_file')?.consumed).toBe(true);
    expect(findingOf(registry, 'tools', 'read_file')?.reasonCode).toBe('host-table-hit');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
