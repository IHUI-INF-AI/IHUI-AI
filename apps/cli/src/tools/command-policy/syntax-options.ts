// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 · 共用选项/arity 原语(arity 表):opt 构造器、INFO/GIT_DIFF/FS_MUTATION/INSTALL 选项簇、二级命令族模板。
 *
 * 由 goal-b49 Z14 机械拆分而来(逐字搬运,零改写):
 * 登记内容与拆前逐字节一致,只是分档到不同文件;基线效应/arity 的取值口径未动。
 */

import type { OptionSpec, SubcommandSpec } from './types.js';

export const opt = (name: string, extra: Partial<OptionSpec> = {}): OptionSpec => ({ name, arity: 'none', ...extra });

/** `--help` / `--version` 只打印信息,不产生副作用 */
export const INFO_OPTIONS: readonly OptionSpec[] = [opt('help'), opt('h'), opt('version'), opt('v')];

/** git diff / git show 共用一组输出选项 */
export const GIT_DIFF_OPTIONS: readonly OptionSpec[] = [
  opt('b'), opt('B'), opt('c'), opt('C', { arity: 'required' }), opt('d'), opt('f'), opt('F', { arity: 'required' }), opt('l'), opt('m'), opt('M'), opt('p'), opt('R'), opt('r'), opt('s'), opt('S', { arity: 'required' }), opt('U', { arity: 'required' }), opt('u'), opt('w'), opt('cached'), opt('color', { arity: 'optional' }), opt('no-color'), opt('context', { arity: 'required' }), opt('dirstat', { arity: 'optional' }), opt('ext-diff'), opt('no-ext-diff'), opt('find-copies'), opt('find-renames', { arity: 'optional' }), opt('ignore-all-space'), opt('ignore-space-at-eol'), opt('ignore-space-change'), opt('inter-hunk-context', { arity: 'required' }), opt('name-only'), opt('name-status'), opt('no-index'), opt('numstat'), opt('patch'), opt('patch-with-stat'), opt('quiet'), opt('renames'), opt('shortstat'), opt('src-prefix', { arity: 'required' }), opt('dst-prefix', { arity: 'required' }), opt('staged'), opt('stat'), opt('summary'), opt('word-diff', { arity: 'optional' }), opt('unified', { arity: 'required' }),
  // `--output=<file>` 把 diff 写到文件,不是只读
  opt('output', { arity: 'required', effects: ['write'], breaksReadonly: true }),
];

export const NESTED_READ_ONLY: readonly string[] = ['ls', 'list', 'view', 'inspect', 'show', 'status', 'df', 'describe', 'diff', 'history', 'logs', 'ps', 'top', 'port', 'stats', 'wait', 'export', 'get', 'current-context', 'privileges', 'token'];

/** 二级命令族(docker volume ls / kubectl rollout status)共用的登记模板 */
export function nestedSpec(mutating: readonly string[], extra: readonly OptionSpec[] = []): SubcommandSpec {
  return {
    mutatingOperands: mutating,
    readGuardOptions: NESTED_READ_ONLY,
    options: [opt('a'), opt('q'), opt('v'), opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('filter', { arity: 'required' }), ...extra],
  };
}

export const INSTALL_OPTIONS: readonly OptionSpec[] = [
  opt('D'), opt('E'), opt('F'), opt('O'), opt('P'), opt('C', { arity: 'required' }), opt('dev'), opt('dir', { arity: 'required' }), opt('frozen-lockfile'), opt('global'), opt('g'), opt('ignore-scripts'), opt('legacy-peer-deps'), opt('lockfile-only'), opt('no-audit'), opt('no-fund'), opt('no-save'), opt('prefix', { arity: 'required' }), opt('production'), opt('reporter', { arity: 'required' }), opt('save'), opt('save-dev'), opt('save-exact'), opt('save-optional'), opt('save-prod'), opt('workspace', { arity: 'required' }),
];

export const FS_MUTATION_OPTIONS: readonly OptionSpec[] = [
  opt('b'), opt('d'), opt('f'), opt('F', { arity: 'required' }), opt('i'), opt('k'), opt('l'), opt('L'), opt('n'), opt('p'), opt('P'), opt('R'), opt('r'), opt('S', { arity: 'required' }), opt('s'), opt('t', { arity: 'required' }), opt('T'), opt('u'), opt('v'), opt('V'), opt('a'), opt('backup', { arity: 'optional' }), opt('copy-contents'), opt('dereference'), opt('interactive', { arity: 'optional' }), opt('link'), opt('no-clobber'), opt('no-dereference'), opt('no-preserve', { arity: 'required' }), opt('preserve', { arity: 'required' }), opt('recursive'), opt('reflink', { arity: 'required' }), opt('remove-destination', { effects: ['destructive'] }), opt('sparse', { arity: 'optional' }), opt('suffix', { arity: 'required' }), opt('target-directory', { arity: 'required' }), opt('update'), opt('verbose'),
];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
