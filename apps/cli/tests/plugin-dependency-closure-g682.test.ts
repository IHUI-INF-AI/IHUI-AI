// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-682:插件依赖闭包在安装期定型。
//
// 钉的票面:清单加 `dependencies?: string[]`,注册前做拓扑+闭包校验并拒绝未声明依赖;
// 运行期只做"在不在",不再决定"谁先谁后"。
//
// 用例与票面验收对应:
//   ① 主验收用例:B 未装而 A 声明依赖 B ⇒ 注册被拒(registry 无 A);
//   ② 同批乱序 registerAll([A(依赖B), B]) ⇒ 拓扑定型,两个都装上;
//   ③ 环 X⇒Y⇒X 与自依赖 ⇒ 全部拒绝;
//   ④ 无 dependencies 的既有插件行为不变(回归);
//   ⑤ JSON 清单路径:loader 透传 dependencies,声明能到 registry 的校验。

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { PluginRegistry } from '../src/plugins/registry.js';
import { loadPluginsWithDiagnostics } from '../src/plugins/loader.js';
import type { PluginDefinition } from '../src/plugins/types.js';

function mkPlugin(name: string, deps?: string[]): PluginDefinition {
  const p: PluginDefinition = { name, version: '1.0.0' };
  if (deps) p.dependencies = deps;
  return p;
}

describe('G-682 插件依赖闭包(安装期定型)', () => {
  it('① B 未装而 A 声明依赖 B ⇒ A 注册被拒', () => {
    const reg = new PluginRegistry();
    expect(reg.register(mkPlugin('a', ['b']))).toBe(false);
    expect(reg.has('a')).toBe(false);
  });

  it('①b 依赖满足后 A 可注册', () => {
    const reg = new PluginRegistry();
    expect(reg.register(mkPlugin('b'))).toBe(true);
    expect(reg.register(mkPlugin('a', ['b']))).toBe(true);
    expect(reg.has('a')).toBe(true);
  });

  it('② 同批乱序 registerAll ⇒ 拓扑定型,两个都装上,与入参顺序无关', () => {
    for (const order of [
      [mkPlugin('a', ['b']), mkPlugin('b')],
      [mkPlugin('b'), mkPlugin('a', ['b'])],
    ]) {
      const reg = new PluginRegistry();
      expect(reg.registerAll(order)).toBe(2);
      expect(reg.has('a')).toBe(true);
      expect(reg.has('b')).toBe(true);
      // 运行期只查"在不在"
      expect(reg.get('a')?.dependencies).toEqual(['b']);
    }
  });

  it('③ 依赖不在批内也不在册 ⇒ registerAll 拒绝 A', () => {
    const reg = new PluginRegistry();
    expect(reg.registerAll([mkPlugin('a', ['b'])])).toBe(0);
    expect(reg.has('a')).toBe(false);
  });

  it('③b 环 X⇒Y⇒X ⇒ 全部拒绝,不掷骰子选赢家', () => {
    const reg = new PluginRegistry();
    expect(reg.registerAll([mkPlugin('x', ['y']), mkPlugin('y', ['x'])])).toBe(0);
    expect(reg.size()).toBe(0);
  });

  it('③c 自依赖 ⇒ 拒绝', () => {
    const reg = new PluginRegistry();
    expect(reg.register(mkPlugin('s', ['s']))).toBe(false);
    expect(reg.has('s')).toBe(false);
  });

  it('③d 环上插件被拒不影响批内无依赖插件正常注册', () => {
    const reg = new PluginRegistry();
    expect(reg.registerAll([mkPlugin('x', ['y']), mkPlugin('y', ['x']), mkPlugin('solo')])).toBe(1);
    expect(reg.has('solo')).toBe(true);
    expect(reg.has('x')).toBe(false);
  });

  it('④ 无 dependencies 的既有插件行为不变(回归)', () => {
    const reg = new PluginRegistry();
    expect(reg.register(mkPlugin('p'))).toBe(true);
    expect(reg.registerAll([mkPlugin('q'), mkPlugin('r')])).toBe(2);
    expect(reg.size()).toBe(3);
  });

  it('⑤ JSON 清单声明的 dependencies 被 loader 透传到 definition', () => {
    const dir = mkScratch('g682-deps-loader-');
    try {
      const pluginDir = path.join(dir, 'a');
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({ name: 'a', version: '1.0.0', dependencies: ['b'] }),
      );
      const result = loadPluginsWithDiagnostics({ pluginsDir: dir });
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0]!.dependencies).toEqual(['b']);
      // 该声明进 registry 时 b 不在册 ⇒ 注册被拒(端到端同一条链)
      const reg = new PluginRegistry();
      expect(reg.registerAll(result.plugins)).toBe(0);
    } finally {
      rmScratch(dir);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
