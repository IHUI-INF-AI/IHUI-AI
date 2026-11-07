// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件扩展声明的汇总口取源(goal-b49/Z30 自 registry.ts 拆出,零行为变更)。
 *
 * 职责:五枚汇总口(`getToolExtensions` / `getHookExtensions` / `getCommandExtensions` /
 * `getTurnInputContributorExtensions` / `getCommandContributorExtensions`)共用的
 * **键集**与**取源**住这一档;`PluginRegistry` 的同名方法只做逐字转接
 * (AGENTS §0.6 单一真相源:同一件事写两遍必然漂)。
 *
 * 键集漂移的问责面:`declaration-consumers.ts` 的 `DeclarationFamily` 是本档
 * `ExtensionDeclarationKey` 的别名(它 import 的是 `registry.js` 的再导出,再导出仍指向本档);
 * 「键 ↔ 汇总口方法」的双射与「registry 内不留第二份汇总实现」由
 * `tests/plugin-extension-summary-lock.test.ts` 形状锁钉住。
 *
 * 顺序语义:`Set` 按插入序去重 ⇒ 汇总结果与拆分前**逐字一致**(既有测试钉的就是这些数组)。
 */

import type { PluginDefinition } from './types.js';

/**
 * 五枚汇总口对应的清单声明族(与 `PluginManifest` 的字段逐字同名)。
 * 键集只在这里列一次(goal-b49/Z13 立、Z30 迁入本档):两处各抄一遍键集是本仓反复记录过的漂移型。
 */
export type ExtensionDeclarationKey = 'tools' | 'hooks' | 'commands' | 'turnInputContributors' | 'commandContributors';

/** 键集的机读形态(与上面的类型联合逐字同序;形状锁钉这张表,不靠散文对账) */
export const EXTENSION_DECLARATION_KEYS: readonly ExtensionDeclarationKey[] = [
  'tools',
  'hooks',
  'commands',
  'turnInputContributors',
  'commandContributors',
];

/** 键 → `PluginRegistry` 汇总口方法名(公开面与键集钉在同一张表上:少一枚 getter 即红) */
export const EXTENSION_SUMMARY_GETTERS: Readonly<Record<ExtensionDeclarationKey, string>> = {
  tools: 'getToolExtensions',
  hooks: 'getHookExtensions',
  commands: 'getCommandExtensions',
  turnInputContributors: 'getTurnInputContributorExtensions',
  commandContributors: 'getCommandContributorExtensions',
};

/**
 * 五枚汇总口共用的一把尺:取该扩展族所有声明名并去重(保插入序)。
 *
 * 原先这段循环在 registry 里,五段逐字同形的循环被收成这一把尺(goal-b49/Z13),
 * Z30 把尺本身搬出注册表:注册表只管在册插件,不再自带汇总实现。
 */
export function collectExtensions(plugins: Iterable<PluginDefinition>, key: ExtensionDeclarationKey): string[] {
  const set = new Set<string>();
  for (const p of plugins) {
    const declared = p[key];
    if (declared) for (const name of declared) set.add(name);
  }
  return Array.from(set);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
