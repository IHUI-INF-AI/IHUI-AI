// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 —— 查询出口(goal-b49 Z14 拆档后的唯一组装点)。
 *
 * 分档职责(一格一文件,逐字从本文件搬出,取值口径未动):
 *  - `syntax-options.ts` = arity 表:选项构造器与跨命令共用的选项簇 / 二级命令族模板
 *  - `syntax-readonly.ts` / `syntax-git.ts` / `syntax-docker-kubectl.ts` /
 *    `syntax-package-clusters.ts` / `syntax-files.ts` / `syntax-network.ts` = 基线效应表按命令族分档
 *  - 本文件 = 查询出口:`SYNTAX_TABLE`(登记面全集)+ `commandSpecOf`(求值器唯一的取条目入口)
 *
 * 原三条维护纪律全文见 `docs/` 与本目录头注的既有登记;拆档不改变任何一条:
 *  1. 只读面不得比旧实现更宽;2. danger 档只对应旧危险模式表;3. 没登记的选项 = 判不出 = 不放行。
 *
 * 键序 = 拆前的登记顺序(只读档 → git/docker/kubectl/cargo → npm/pnpm → gh → 文件与进程档 → 网络档)。
 */

import type { CommandSpec } from './types.js';
import { opt } from './syntax-options.js';
import { READ_ONLY_SIMPLE } from './syntax-readonly.js';
import { GIT_SPEC } from './syntax-git.js';
import { DOCKER_SPEC, KUBECTL_SPEC } from './syntax-docker-kubectl.js';
import { CARGO_SPEC, packageManagerSpec } from './syntax-package-clusters.js';
import { FILE_SPECS } from './syntax-files.js';
import { GH_TABLE, NETWORK_SPECS } from './syntax-network.js';

export const SYNTAX_TABLE: Readonly<Record<string, CommandSpec>> = {
  ...READ_ONLY_SIMPLE,
  git: GIT_SPEC,
  docker: DOCKER_SPEC,
  kubectl: KUBECTL_SPEC,
  cargo: CARGO_SPEC,
  npm: packageManagerSpec([opt('C', { arity: 'required' }), opt('loglevel', { arity: 'required' }), opt('prefix', { arity: 'required' }), opt('color', { arity: 'required' }), opt('no-color'), opt('global'), opt('version'), opt('help')]),
  pnpm: packageManagerSpec([opt('C', { arity: 'required' }), opt('r'), opt('recursive'), opt('filter', { arity: 'required' }), opt('dir', { arity: 'required' }), opt('workspace-root'), opt('frozen-lockfile'), opt('no-frozen-lockfile'), opt('loglevel', { arity: 'required' }), opt('reporter', { arity: 'required' }), opt('version'), opt('help')]),
  ...GH_TABLE,
  ...FILE_SPECS,
  ...NETWORK_SPECS,
};

/**
 * 查询出口:按 basename 取登记条目。取不到 ⇒ undefined(= 未登记,由调用方落 `unknown` +
 * `unregistered-command`,§0.3「不知道」绝不折成「允许」)。
 * 用 `hasOwnProperty` 而不是下标读:下标读会把 `constructor`/`toString` 这类原型键当成"有条目"。
 */
export function commandSpecOf(basename: string): CommandSpec | undefined {
  return Object.prototype.hasOwnProperty.call(SYNTAX_TABLE, basename) ? SYNTAX_TABLE[basename] : undefined;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
