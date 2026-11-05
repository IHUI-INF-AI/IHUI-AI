// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 · git 族(GIT_SUBCOMMANDS + GIT_SPEC):结构化、必须带子命令才可判定。
 *
 * 由 goal-b49 Z14 机械拆分而来(逐字搬运,零改写):
 * 登记内容与拆前逐字节一致,只是分档到不同文件;基线效应/arity 的取值口径未动。
 */

import type { CommandSpec, SubcommandSpec } from './types.js';
import { opt } from './syntax-options.js';
import { INFO_OPTIONS } from './syntax-options.js';
import { GIT_DIFF_OPTIONS } from './syntax-options.js';

export const GIT_SUBCOMMANDS: Readonly<Record<string, SubcommandSpec>> = {
  status: {
    effects: ['read'],
    options: [opt('b'), opt('i'), opt('j', { arity: 'required' }), opt('n', { arity: 'optional' }), opt('o'), opt('s'), opt('u', { arity: 'optional' }), opt('uno'), opt('z'), opt('ahead-behind'), opt('no-ahead-behind'), opt('branch'), opt('ignored', { arity: 'optional' }), opt('ignore-submodules', { arity: 'optional' }), opt('no-ignore-submodules'), opt('null'), opt('porcelain', { arity: 'optional' }), opt('renames'), opt('no-renames'), opt('show-stash'), opt('short'), opt('untracked-files', { arity: 'optional' })],
  },
  log: {
    effects: ['read'],
    options: [opt('n', { arity: 'required' }), opt('abbrev', { arity: 'required' }), opt('after', { arity: 'required' }), opt('author', { arity: 'required' }), opt('bisect'), opt('branches', { arity: 'optional' }), opt('cherry-pick'), opt('date', { arity: 'required' }), opt('decorate', { arity: 'optional' }), opt('no-decorate'), opt('enclosing-merges'), opt('first-parent'), opt('follow'), opt('format', { arity: 'required' }), opt('full-history'), opt('grep', { arity: 'required' }), opt('graph'), opt('left-right'), opt('L', { arity: 'required' }), opt('merges'), opt('no-merges'), opt('oneline'), opt('patch-with-stat'), opt('pretty', { arity: 'optional' }), opt('reverse'), opt('since', { arity: 'required' }), opt('skip', { arity: 'required' }), opt('simplify-by-decoration'), opt('stat'), opt('until', { arity: 'required' }), opt('walk-reflogs'),
    ],
  },
  diff: { effects: ['read'], options: GIT_DIFF_OPTIONS },
  show: { effects: ['read'], options: GIT_DIFF_OPTIONS },
  'rev-parse': { effects: ['read'], options: [opt('q'), opt('verify'), opt('sq'), opt('sq-quote'), opt('short', { arity: 'optional' }), opt('git-dir'), opt('git-path', { arity: 'required' }), opt('show-toplevel'), opt('show-cdup'), opt('show-prefix'), opt('is-inside-work-tree'), opt('is-inside-git-dir'), opt('is-bare-repository'), opt('is-inside-git-dir'), opt('abbrev-ref', { arity: 'optional' }), opt('revs-only'), opt('no-revs'), opt('rev-only'), opt('unhide'), opt('date', { arity: 'required' }), opt('quiet')] },
  blame: { effects: ['read'], options: [opt('b'), opt('C'), opt('e'), opt('f'), opt('h'), opt('L', { arity: 'required' }), opt('M'), opt('p'), opt('s'), opt('t'), opt('w'), opt('p'), opt('incremental'), opt('line-porcelain'), opt('porcelain'), opt('root'), opt('show-numbers'), opt('score-debug'), opt('abbrev', { arity: 'required' }), opt('date', { arity: 'required' }), opt('ignore-rev', { arity: 'required' }), opt('color', { arity: 'optional' })] },
  'ls-files': { effects: ['read'], options: [opt('c'), opt('d'), opt('e'), opt('i'), opt('k'), opt('m'), opt('o'), opt('s'), opt('t'), opt('u'), opt('v'), opt('z'), opt('cached'), opt('directory'), opt('error-unmatch'), opt('exclude', { arity: 'required' }), opt('exclude-standard'), opt('full-name'), opt('modified'), opt('others'), opt('stage'), opt('sparse')] },
  describe: { effects: ['read'], options: [opt('a'), opt('all'), opt('always'), opt('contains'), opt('debug'), opt('exclude', { arity: 'required' }), opt('dirty', { arity: 'optional' }), opt('first-match'), opt('long'), opt('match', { arity: 'required' }), opt('tags'), opt('candidates', { arity: 'required' })] },
  shortlog: { effects: ['read'], options: [opt('c'), opt('e'), opt('k'), opt('n'), opt('s'), opt('w'), opt('email'), opt('force-email', { arity: 'optional' }), opt('group', { arity: 'required' }), opt('numbered'), opt('summary'), ...INFO_OPTIONS] },
  branch: {
    // 裸 `git branch` 是列出;带删除/改名/移动语义的选项不再免确认(旧实现对选项盲视)
    effects: ['read'],
    options: [
      opt('a'), opt('r'), opt('v', { arity: 'optional' }), opt('all'), opt('color', { arity: 'optional' }), opt('column', { arity: 'optional' }), opt('contains', { arity: 'required' }), opt('format', { arity: 'required' }), opt('list'), opt('merged', { arity: 'optional' }), opt('no-merged', { arity: 'optional' }), opt('points-at', { arity: 'required' }), opt('quiet'), opt('show-current'), opt('verbose', { arity: 'optional' }),
      opt('d', { arity: 'optional', breaksReadonly: true, effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git branch -d' }),
      opt('D', { breaksReadonly: true, effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git branch -D' }),
      opt('delete', { arity: 'optional', breaksReadonly: true, effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git branch --delete' }),
      opt('m', { arity: 'optional', breaksReadonly: true, effects: ['write'], rule: 'git branch -m' }),
      opt('M', { breaksReadonly: true, effects: ['write', 'destructive'], rule: 'git branch -M' }),
      opt('c', { arity: 'optional', breaksReadonly: true, effects: ['write'], rule: 'git branch -c' }),
      opt('C', { breaksReadonly: true, effects: ['write'], rule: 'git branch -C' }),
      opt('move', { arity: 'optional', breaksReadonly: true, effects: ['write'] }),
      opt('copy', { arity: 'optional', breaksReadonly: true, effects: ['write'] }),
      opt('set-upstream-to', { arity: 'required', breaksReadonly: true, effects: ['write'] }),
      opt('unset-upstream', { breaksReadonly: true, effects: ['write'] }),
      opt('create-reflog', { breaksReadonly: true, effects: ['write'] }),
      opt('edit-description', { breaksReadonly: true, effects: ['write'] }),
    ],
  },
  remote: {
    effects: ['read'],
    mutatingOperands: ['add', 'remove', 'rename', 'set-url', 'set-head', 'set-branches', 'prune', 'update', 'get-url'],
    options: [opt('v', { arity: 'optional' }), opt('n'), opt('fetch'), opt('push'), opt('tags'), opt('quiet'), opt('verbose', { arity: 'optional' }), opt('mirror', { arity: 'optional' })],
  },
  config: {
    // 写配置是默认态;只有显式读取形态才允许免确认(与旧两词白名单 `config --get` 同义)
    readGuardOptions: ['get', 'list', 'get-all', 'get-regexp'],
    options: [
      opt('get'), opt('list'), opt('get-all'), opt('get-regexp'),
      opt('add', { breaksReadonly: true, effects: ['write'] }),
      opt('unset', { breaksReadonly: true, effects: ['write'] }),
      opt('unset-all', { breaksReadonly: true, effects: ['write'] }),
      opt('rename-section', { breaksReadonly: true, effects: ['write'] }),
      opt('remove-section', { breaksReadonly: true, effects: ['write'] }),
      opt('bool'), opt('int'), opt('path'), opt('null'), opt('default', { arity: 'required' }), opt('type', { arity: 'required' }), opt('file', { arity: 'required' }), opt('global'), opt('local'), opt('system'), opt('worktree'), opt('fixed-value'), opt('includes'), opt('no-includes'), opt('comment', { arity: 'required' }),
    ],
  },
  push: {
    effects: ['write', 'network'],
    options: [
      opt('f', { effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git push --force' }),
      opt('force', { effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git push --force' }),
      opt('force-with-lease', { arity: 'optional', effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git push --force-with-lease' }),
      opt('force-if-includes', { effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git push --force-if-includes' }),
      opt('delete', { effects: ['destructive'], alwaysConfirm: true, rule: 'git push --delete' }),
      opt('all'), opt('atomic'), opt('dry-run', { arity: 'optional' }), opt('exec', { arity: 'required' }), opt('follow-tags'), opt('mirror'), opt('no-verify'), opt('porcelain', { arity: 'optional' }), opt('push-option', { arity: 'required' }), opt('quiet'), opt('receive-pack', { arity: 'required' }), opt('repo', { arity: 'required' }), opt('set-upstream'), opt('signed', { arity: 'optional' }), opt('tags'), opt('u'), opt('v'), opt('verbose'),
    ],
  },
  reset: {
    effects: ['write'],
    options: [opt('hard', { effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git reset --hard' }), opt('merge', { effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'git reset --merge' }), opt('keep', { effects: ['destructive'], rule: 'git reset --keep' }), opt('mixed'), opt('soft'), opt('q'), opt('quiet'), opt('no-refresh'), opt('recurse-submodules', { arity: 'optional' })],
  },
  clean: {
    effects: ['write', 'destructive'],
    alwaysConfirm: true,
    options: [opt('f', { danger: true, alwaysConfirm: true, rule: 'git clean -f' }), opt('force', { danger: true, alwaysConfirm: true, rule: 'git clean --force' }), opt('d'), opt('x'), opt('X'), opt('n'), opt('q'), opt('Q'), opt('e', { arity: 'required' }), opt('dry-run'), opt('exclude', { arity: 'required' })],
  },
  // 以下子命令登记为"有写语义",danger 一律不加(见文件头纪律 2)
  add: { effects: ['write'], options: [opt('A'), opt('a'), opt('e'), opt('f'), opt('n'), opt('p'), opt('u'), opt('all'), opt('dry-run'), opt('force'), opt('ignore-missing'), opt('ignore-removal'), opt('patch'), opt('renormalize'), opt('sparse')] },
  commit: { effects: ['write'], options: [opt('a'), opt('A'), opt('amend', { effects: ['destructive'], alwaysConfirm: true, rule: 'git commit --amend' }), opt('C', { arity: 'required' }), opt('c', { arity: 'required' }), opt('e'), opt('F', { arity: 'required' }), opt('m', { arity: 'required' }), opt('S'), opt('s'), opt('P'), opt('a'), opt('allow-empty'), opt('allow-empty-message'), opt('author', { arity: 'required' }), opt('cleanup', { arity: 'required' }), opt('date', { arity: 'required' }), opt('dry-run'), opt('edit'), opt('file', { arity: 'required' }), opt('fixup', { arity: 'required' }), opt('include', { arity: 'required' }), opt('interactive'), opt('message', { arity: 'required' }), opt('no-edit'), opt('no-verify'), opt('quiet'), opt('signoff'), opt('squash'), opt('trailer', { arity: 'required' }), opt('verbose')] },
  checkout: { effects: ['write'], options: [opt('b'), opt('B', { arity: 'required' }), opt('f'), opt('l'), opt('L'), opt('m'), opt('p'), opt('q'), opt('t'), opt('conflict', { arity: 'required' }), opt('detach'), opt('force'), opt('guess'), opt('ignore-skip-worktree-bits'), opt('merge'), opt('orphan', { arity: 'required' }), opt('ours'), opt('patch'), opt('quiet'), opt('theirs'), opt('track')] },
  switch: { effects: ['write'], options: [opt('c'), opt('C', { arity: 'required' }), opt('f'), opt('detach'), opt('force'), opt('guess'), opt('orphan', { arity: 'required' }), opt('quiet'), opt('track')] },
  restore: { effects: ['write'], options: [opt('S', { arity: 'required' }), opt('p'), opt('s', { arity: 'required' }), opt('source', { arity: 'required' }), opt('ignore-unmerged'), opt('overlay'), opt('quiet'), opt('staged'), opt('worktree')] },
  merge: { effects: ['write'], options: [opt('a'), opt('e'), opt('F', { arity: 'required' }), opt('f', { arity: 'required' }), opt('m', { arity: 'required' }), opt('n'), opt('O', { arity: 'required' }), opt('no-ff'), opt('no-commit'), opt('no-squash'), opt('abort'), opt('continue'), opt('quit'), opt('diff-algorithm', { arity: 'required' }), opt('edit'), opt('ff-only'), opt('gpg-sign', { arity: 'optional' }), opt('log', { arity: 'optional' }), opt('message', { arity: 'required' }), opt('no-edit'), opt('ours'), opt('rerere-autoupdate', { arity: 'optional' }), opt('signoff'), opt('squash'), opt('stat'), opt('strategy', { arity: 'required' }), opt('strategy-option', { arity: 'required' }), opt('theirs'), opt('verify-signatures')] },
  rebase: { effects: ['write'], alwaysConfirm: true, options: [opt('i'), opt('x', { arity: 'required' }), opt('X', { arity: 'required' }), opt('k'), opt('n'), opt('r'), opt('autosquash'), opt('continue'), opt('exec', { arity: 'required', effects: ['system'] }), opt('force-rebase'), opt('interactive'), opt('onto', { arity: 'required' }), opt('quit'), opt('root'), opt('skip'), opt('abort'), opt('no-edit'), opt('whitespace', { arity: 'required' })] },
  pull: { effects: ['write', 'network'], options: [opt('a'), opt('e'), opt('F', { arity: 'required' }), opt('f'), opt('n'), opt('no-rebase'), opt('all'), opt('autostash'), opt('commit'), opt('depth', { arity: 'required' }), opt('ff'), opt('no-ff'), opt('jobs', { arity: 'required' }), opt('no-commit'), opt('prune'), opt('quiet'), opt('rebase', { arity: 'optional' }), opt('shallow-submodules'), opt('squash'), opt('tags'), opt('verbose')] },
  fetch: { effects: ['write', 'network'], options: [opt('a'), opt('f'), opt('j', { arity: 'required' }), opt('p'), opt('q'), opt('t'), opt('all'), opt('depth', { arity: 'required' }), opt('force'), opt('jobs', { arity: 'required' }), opt('prune'), opt('prune-tags'), opt('quiet'), opt('recurse-submodules', { arity: 'optional' }), opt('refmap', { arity: 'required' }), opt('shallow-exclude', { arity: 'required' }), opt('shallow-since', { arity: 'required' }), opt('tags'), opt('unshallow'), opt('update-head-ok'), opt('verbose')] },
  stash: { mutatingOperands: ['pop', 'drop', 'clear', 'apply', 'create', 'branch', 'push', 'save'], readGuardOptions: ['list', 'show'], options: [opt('a'), opt('i'), opt('k'), opt('m', { arity: 'required' }), opt('p'), opt('q'), opt('u'), opt('all'), opt('include-untracked'), opt('keep-index'), opt('patch'), opt('quiet')] },
  clone: { effects: ['write', 'network'], options: [opt('b', { arity: 'required' }), opt('c', { arity: 'required' }), opt('j', { arity: 'required' }), opt('l'), opt('n'), opt('q'), opt('S', { arity: 'required' }), opt('bare'), opt('config', { arity: 'required' }), opt('depth', { arity: 'required' }), opt('origin', { arity: 'required' }), opt('mirror'), opt('no-checkout'), opt('quiet'), opt('recursive', { arity: 'optional' }), opt('separate-git-dir', { arity: 'required' }), opt('shared', { arity: 'optional' }), opt('single-branch'), opt('template', { arity: 'required' })] },
  init: { effects: ['write'], options: [opt('b'), opt('q'), opt('bare'), opt('initial-branch', { arity: 'required' }), opt('object-format', { arity: 'required' }), opt('quiet'), opt('separate-git-dir', { arity: 'required' }), opt('shared', { arity: 'optional' }), opt('template', { arity: 'required' })] },
  tag: { effects: ['write'], options: [opt('a'), opt('d', { effects: ['destructive'], alwaysConfirm: true }), opt('m', { arity: 'required' }), opt('n', { arity: 'optional' }), opt('s'), opt('v'), opt('cleanup', { arity: 'required' }), opt('columns', { arity: 'optional' }), opt('delete', { arity: 'optional', effects: ['destructive'], alwaysConfirm: true }), opt('force'), opt('list'), opt('sort', { arity: 'required' }), opt('sign')] },
  worktree: { mutatingOperands: ['add', 'remove', 'prune', 'move', 'lock', 'unlock'], readGuardOptions: ['list'], options: [opt('f'), opt('v', { arity: 'optional' }), opt('b', { arity: 'required' }), opt('detach'), opt('expire', { arity: 'required' }), opt('lock'), opt('porcelain'), opt('quiet'), opt('reason', { arity: 'required' }), opt('unlock'), opt('verbose')] },
  mv: { effects: ['write', 'destructive'], options: [opt('A'), opt('C', { arity: 'required' }), opt('f'), opt('k'), opt('M'), opt('n'), opt('v'), opt('dry-run'), opt('force'), opt('sparse'), opt('verbose')] },
  rm: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('c'), opt('f'), opt('n'), opt('q'), opt('r'), opt('cached'), opt('dry-run'), opt('force'), opt('quiet'), opt('ignore-unmatch'), opt('sparse')] },
  gc: { effects: ['write', 'destructive'], options: [opt('a'), opt('q'), opt('aggressive'), opt('auto'), opt('detach'), opt('prune', { arity: 'optional' }), opt('quiet'), opt('force'), opt('repack-early')] },
  prune: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('n'), opt('v'), opt('dry-run'), opt('expire', { arity: 'required' }), opt('no-remove'), opt('objects'), opt('verbose')] },
  apply: { effects: ['write'], options: [opt('C', { arity: 'required' }), opt('p', { arity: 'required' }), opt('R'), opt('3way'), opt('check'), opt('numstat'), opt('stat'), opt('summary'), opt('cached'), opt('directory', { arity: 'required' }), opt('exclude', { arity: 'required' }), opt('reject'), opt('unapply'), opt('whitespace', { arity: 'required' })] },
  'cherry-pick': { effects: ['write'], options: [opt('e'), opt('f'), opt('m', { arity: 'required' }), opt('n'), opt('ff'), opt('abort'), opt('allow-empty'), opt('continue'), opt('empty', { arity: 'required' }), opt('mainline', { arity: 'required' }), opt('skip'), opt('strategy', { arity: 'required' })] },
  revert: { effects: ['write'], options: [opt('E'), opt('m', { arity: 'required' }), opt('n'), opt('e'), opt('no-edit'), opt('abort'), opt('cleanup', { arity: 'required' }), opt('continue'), opt('reference'), opt('skip'), opt('S')] },
  'ls-remote': { effects: ['read', 'network'], options: [opt('h'), opt('s'), opt('t'), opt('exit-code'), opt('get-url'), opt('heads'), opt('refs'), opt('quiet'), opt('sorted', { arity: 'required' }), opt('symref'), opt('tags')] },
  'for-each-ref': { effects: ['read'], options: [opt('n', { arity: 'required' }), opt('contains', { arity: 'required' }), opt('no-contains', { arity: 'required' }), opt('count', { arity: 'required' }), opt('format', { arity: 'required' }), opt('merged', { arity: 'optional' }), opt('no-merged', { arity: 'optional' }), opt('sort', { arity: 'required' }), opt('color', { arity: 'optional' })] },
  'cat-file': { effects: ['read'], options: [opt('p'), opt('s'), opt('t'), opt('e'), opt('allow-unknown-type'), opt('buffer', { arity: 'optional' }), opt('use-mailmap')] },
  'hash-object': { effects: ['write'], options: [opt('w', { effects: ['write', 'destructive'] }), opt('t'), opt('p'), opt('stdin'), opt('stdin-paths'), opt('path', { arity: 'required' }), opt('literally')] },
  help: { effects: ['read'], options: [opt('a'), opt('i'), opt('g'), opt('m'), opt('h'), opt('web'), opt('guides'), opt('config')] },
};

export const GIT_SPEC: CommandSpec = {
  // git 必须带子命令才可判定 —— 裸 `git` / `git --version` 都不允许免确认
  effect: 'requires-subcommand',
  structured: true,
  globalOptions: [
    opt('C', { arity: 'required' }),
    opt('c', { arity: 'required', breaksReadonly: true, effects: ['write'] }),
    opt('git-dir', { arity: 'required', breaksReadonly: true }),
    opt('work-tree', { arity: 'required', breaksReadonly: true }),
    opt('namespace', { arity: 'required', breaksReadonly: true }),
    opt('super-prefix', { arity: 'required' }),
    opt('exec-path', { arity: 'optional' }),
    opt('no-pager'), opt('paginate'), opt('no-optional-locks'), opt('bare'), opt('literal-pathspecs'), opt('no-literal-pathspecs'),
    opt('version', { breaksReadonly: true }), opt('help'), opt('h'),
  ],
  subcommands: GIT_SUBCOMMANDS,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
