// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 / Z30 — 汇总口「键集 ↔ 公开面」形状锁(2026-11-06)。
 *
 * 拆档本身不是交付:把五枚汇总口的取源搬到 `plugin-extensions.ts` 之后,必须有人钉住
 * 「键集没漂、汇总口没少、注册表没留下第二份实现」(AGENTS §0.6 / §0.9「造好没装车=没有」)。
 * 本用例钉四件事,全是零行为变更的账面自证:
 *   ① `EXTENSION_DECLARATION_KEYS` 逐字 = 五枚清单声明族(与 PluginManifest 字段同名);
 *   ② 每个键都有**且只有一个**汇总口方法,且该方法在 `PluginRegistry` 的真实例子上可取;
 *   ③ `registry.ts` 对汇总的引用只剩逐字转接:出现 5 次 `collectExtensions(this.plugins.values(), …)`,
 *      且档内不再出现第二份 Set 汇总实现(转接不留第二份实现);
 *   ④ 两档都仍在 AGENTS §3 的 <250 行档内(拆档目标本身由用例钉住,不靠本轮 wc 读数)。
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PluginRegistry } from '../src/plugins/registry.js';
import {
  EXTENSION_DECLARATION_KEYS,
  EXTENSION_SUMMARY_GETTERS,
  collectExtensions,
} from '../src/plugins/plugin-extensions.js';

const registrySource = readFileSync(new URL('../src/plugins/registry.ts', import.meta.url), 'utf-8');
const extensionsSource = readFileSync(new URL('../src/plugins/plugin-extensions.ts', import.meta.url), 'utf-8');

describe('Z30 汇总口键集形状锁', () => {
  it('① 键集逐字 = 五枚清单声明族(顺序即公开面顺序,改名/加族都得先过本用例)', () => {
    expect([...EXTENSION_DECLARATION_KEYS]).toEqual([
      'tools',
      'hooks',
      'commands',
      'turnInputContributors',
      'commandContributors',
    ]);
  });

  it('② 键 ↔ 汇总口方法双射:一张表里不多不少,且方法真的挂在注册表实例上', () => {
    const getters = EXTENSION_DECLARATION_KEYS.map((key) => EXTENSION_SUMMARY_GETTERS[key]);
    // 双射:任何一键缺表值或两键共用一枚方法名 ⇒ size 不等 ⇒ 红
    expect(new Set(getters).size).toBe(EXTENSION_DECLARATION_KEYS.length);
    expect(getters.every((g) => typeof g === 'string' && g.length > 0)).toBe(true);
    const registry = new PluginRegistry({ workingDir: process.cwd() });
    for (const getter of getters) {
      expect(typeof Reflect.get(registry, getter), `汇总口 ${getter} 不在公开面上`).toBe('function');
    }
    // 表里不得藏着键集之外的方法(第 6 枚方法名会从这里漏出来)
    expect(new Set(Object.values(EXTENSION_SUMMARY_GETTERS)).size).toBe(5);
  });

  it('③ registry.ts 只留转接:5 次转接调用 + 档内零第二份汇总实现', () => {
    const calls = registrySource.match(/collectExtensions\(this\.plugins\.values\(\),\s*'[a-zA-Z]+'\)/g) ?? [];
    expect(calls).toHaveLength(5);
    // 逐字转接的实参集合必须等于键集(把 'tools' 改成 'tool' 这类漂动当场红)
    expect(calls.map((c) => c.match(/'([a-zA-Z]+)'/)?.[1]).sort()).toEqual([...EXTENSION_DECLARATION_KEYS].sort());
    // 转接不留第二份实现:注册表里不得再有 Set 形态的汇总循环,也不得自带 collectExtensions
    expect(registrySource).not.toContain('new Set<string>()');
    expect(registrySource).not.toMatch(/function collectExtensions|private collectExtensions/);
    expect(registrySource).toContain("from './plugin-extensions.js'");
    // 反向钉:取源只有一份实现(住在 plugin-extensions.ts)
    expect(extensionsSource.match(/export function collectExtensions/g)).toHaveLength(1);
  });

  it('④ 两档各 <250 行(AGENTS §3;拆档目标本身)', () => {
    for (const [file, src] of [
      ['apps/cli/src/plugins/registry.ts', registrySource],
      ['apps/cli/src/plugins/plugin-extensions.ts', extensionsSource],
    ] as const) {
      const lines = src.split(/\r?\n/).length;
      expect(lines, `${file} 现 ${lines} 行,超 §3 上限`).toBeLessThan(250);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
