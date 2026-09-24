// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CommandSpec, OptionSpec, SubcommandSpec } from './types.js';

/**
 * 命令语法表 —— 我方自己维护的数据(不引第三方生成物、不加新依赖)。
 *
 * 三条维护纪律:
 *  1. **只读面不得比旧实现更宽**。旧 `isReadonlyCommand` 的免确认集合 = 只读 basename 白名单 +
 *     git/cargo/kubectl/docker 的子命令白名单,且**对选项完全盲视**。本表把"盲视"这一漏洞收窄
 *     (`git branch -d`、`sort -o out.txt` 一类不再免确认),不新增任何免确认命令。
 *  2. **danger 档只对应旧危险模式表**。新增的破坏性知识(kubectl delete、docker system prune、
 *     find -delete 等)走 `destructive` / `alwaysConfirm` 两档,由新 API 暴露,不塞进
 *     `matchDangerousCommand` —— 否则逃生舱档位(IHUI_YOLO)的既有拦截语义会被这次重构顺带改掉。
 *  3. **没登记的选项 = 判不出 = 不放行**。求值器遇到未登记选项就把只读结论降级为 unknown,
 *     因此新增一条选项登记属于"放宽"动作,必须显式写在这里。
 */

const opt = (name: string, extra: Partial<OptionSpec> = {}): OptionSpec => ({ name, arity: 'none', ...extra });

/** `--help` / `--version` 只打印信息,不产生副作用 */
const INFO_OPTIONS: readonly OptionSpec[] = [opt('help'), opt('h'), opt('version'), opt('v')];

const READ_ONLY_SIMPLE: Readonly<Record<string, CommandSpec>> = {
  pwd: { effect: 'read', options: INFO_OPTIONS },
  whoami: { effect: 'read', options: INFO_OPTIONS },
  uptime: { effect: 'read', options: INFO_OPTIONS },
  date: {
    effect: 'read',
    options: [opt('s', { arity: 'required', effects: ['system'], breaksReadonly: true }), opt('u', { effects: ['system'], breaksReadonly: true }), opt('r'), opt('f', { arity: 'required' }), ...INFO_OPTIONS],
  },
  hostname: {
    // 带操作数的 `hostname foo` 是"设置主机名",与只读的裸 `hostname`(查询)同名
    effect: 'read',
    operandsBreakReadonly: true,
    options: [opt('i'), opt('f'), opt('d'), opt('b'), opt('A'), opt('I'), opt('s', { arity: 'required' }), ...INFO_OPTIONS],
  },
  ls: {
    effect: 'read',
    options: [
      opt('a'), opt('A'), opt('b'), opt('B', { arity: 'required' }), opt('c'), opt('C', { arity: 'required' }), opt('d'), opt('D', { arity: 'required' }), opt('f'), opt('F', { arity: 'optional' }), opt('g'), opt('h'), opt('H'), opt('i'), opt('k'), opt('l'), opt('m'), opt('n'), opt('o'), opt('p'), opt('q'), opt('Q'), opt('r'), opt('R'), opt('s'), opt('S'), opt('t'), opt('T', { arity: 'required' }), opt('u'), opt('U'), opt('v'), opt('w'), opt('x'), opt('X', { arity: 'required' }), opt('1'), opt('Z'),
      opt('all'), opt('directory'), opt('human-readable'), opt('long'), opt('recursive'), opt('reverse'), opt('sort', { arity: 'required' }), opt('time', { arity: 'required' }), opt('classify', { arity: 'optional' }), opt('color', { arity: 'optional' }), opt('format', { arity: 'required' }), opt('group-directories-first'), opt('ignore', { arity: 'required' }), opt('time-style', { arity: 'required' }), ...INFO_OPTIONS,
    ],
  },
  cat: {
    effect: 'read',
    options: [opt('A'), opt('b'), opt('e'), opt('E'), opt('n'), opt('s'), opt('T'), opt('t'), opt('u'), opt('v'), opt('number'), opt('number-noblank'), opt('show-all'), opt('show-nonprinting'), opt('squeeze-blank'), ...INFO_OPTIONS],
  },
  head: { effect: 'read', options: [opt('n', { arity: 'required' }), opt('c', { arity: 'required' }), opt('q'), opt('v'), opt('z'), opt('lines', { arity: 'required' }), opt('bytes', { arity: 'required' }), opt('quiet'), opt('verbose'), ...INFO_OPTIONS] },
  tail: {
    effect: 'read',
    // `tail -f` 只是不退出,不写任何东西
    options: [opt('c', { arity: 'required' }), opt('F'), opt('f'), opt('n', { arity: 'required' }), opt('q'), opt('s', { arity: 'required' }), opt('v'), opt('z'), opt('bytes', { arity: 'required' }), opt('follow', { arity: 'optional' }), opt('lines', { arity: 'required' }), opt('max-unicode-chars', { arity: 'required' }), opt('pid', { arity: 'required' }), opt('quiet'), opt('retry'), opt('verbose'), ...INFO_OPTIONS],
  },
  wc: { effect: 'read', options: [opt('c'), opt('l'), opt('L'), opt('m'), opt('w'), opt('z'), opt('bytes'), opt('chars'), opt('files0-from', { arity: 'required' }), opt('lines'), opt('words'), ...INFO_OPTIONS] },
  sort: {
    effect: 'read',
    options: [
      opt('b'), opt('c'), opt('C', { arity: 'required' }), opt('d'), opt('f'), opt('g'), opt('h'), opt('i'), opt('k', { arity: 'required' }), opt('M'), opt('m'), opt('n'), opt('o', { arity: 'required', effects: ['write'], breaksReadonly: true }), opt('R'), opt('s'), opt('t', { arity: 'required' }), opt('T', { arity: 'required' }), opt('u'), opt('V'),
      opt('batch-size', { arity: 'required' }), opt('check'), opt('compress-prog', { arity: 'required' }), opt('dictionary-order'), opt('field-separator', { arity: 'required' }), opt('general-numeric-sort'), opt('human-numeric-sort'), opt('ignore-case'), opt('key', { arity: 'required' }), opt('merge'), opt('numeric-key-alignment', { arity: 'required' }), opt('numeric-sort'), opt('output', { arity: 'required', effects: ['write'], breaksReadonly: true }), opt('random-source', { arity: 'required' }), opt('reverse'), opt('stable'), opt('unique'), ...INFO_OPTIONS,
    ],
  },
  // `uniq IN OUT` 的第二个操作数是输出文件
  uniq: { effect: 'read', outputOperandIndex: 1, options: [opt('c'), opt('d'), opt('D', { arity: 'optional' }), opt('f', { arity: 'required' }), opt('i'), opt('s', { arity: 'required' }), opt('u'), opt('w', { arity: 'required' }), opt('all-repeated', { arity: 'optional' }), opt('count'), opt('ignore-case'), opt('repeated'), opt('skip-fields', { arity: 'required' }), ...INFO_OPTIONS] },
  tr: { effect: 'read', options: [opt('c'), opt('C'), opt('d'), opt('s'), opt('t'), opt('complement'), opt('delete'), opt('squeeze-repeats'), opt('truncate-set1'), ...INFO_OPTIONS] },
  cut: { effect: 'read', options: [opt('b', { arity: 'required' }), opt('c', { arity: 'required' }), opt('d', { arity: 'required' }), opt('f', { arity: 'required' }), opt('n'), opt('s'), opt('z'), opt('complement'), opt('output-delimiter', { arity: 'required' }), ...INFO_OPTIONS] },
  ps: {
    effect: 'read',
    options: [opt('a'), opt('A'), opt('c'), opt('C', { arity: 'required' }), opt('d'), opt('e'), opt('f'), opt('g'), opt('G', { arity: 'required' }), opt('h'), opt('H'), opt('j'), opt('k', { arity: 'required' }), opt('l'), opt('m'), opt('n', { arity: 'required' }), opt('N', { arity: 'required' }), opt('o', { arity: 'required' }), opt('O', { arity: 'required' }), opt('p', { arity: 'required' }), opt('P'), opt('q', { arity: 'required' }), opt('r'), opt('s'), opt('Session'), opt('t'), opt('T'), opt('u', { arity: 'required' }), opt('U', { arity: 'required' }), opt('v'), opt('w'), opt('x'), opt('y'), opt('Z'), opt('aux'), opt('ax'), opt('ef'), opt('l'), opt('pid', { arity: 'required' }), opt('format', { arity: 'required' }), opt('sort', { arity: 'required' }), opt('forest'), opt('headers'), opt('no-headers'), opt('width', { arity: 'required' }), ...INFO_OPTIONS],
  },
  grep: {
    effect: 'read',
    options: [
      opt('a'), opt('A', { arity: 'required' }), opt('b'), opt('B', { arity: 'required' }), opt('c'), opt('C', { arity: 'required' }), opt('d', { arity: 'required' }), opt('e', { arity: 'required' }), opt('E'), opt('f', { arity: 'required' }), opt('F'), opt('G'), opt('h'), opt('H'), opt('i'), opt('L'), opt('l'), opt('m', { arity: 'required' }), opt('n'), opt('o'), opt('P'), opt('q'), opt('r'), opt('R'), opt('s'), opt('v'), opt('w'), opt('x'), opt('z'), opt('Z'),
      opt('after-context', { arity: 'required' }), opt('before-context', { arity: 'required' }), opt('binary-files', { arity: 'required' }), opt('color', { arity: 'optional' }), opt('context', { arity: 'optional' }), opt('count'), opt('exclude', { arity: 'required' }), opt('exclude-dir', { arity: 'required' }), opt('files-without-match'), opt('files-with-matches'), opt('ignore-case'), opt('include', { arity: 'required' }), opt('line-number'), opt('max-count', { arity: 'required' }), opt('null'), opt('recursive'), opt('regexp', { arity: 'required' }), opt('silent'), opt('text'), opt('verbose'), ...INFO_OPTIONS,
    ],
  },
  rg: {
    effect: 'read',
    options: [opt('A', { arity: 'required' }), opt('a'), opt('B', { arity: 'required' }), opt('b'), opt('C', { arity: 'required' }), opt('c'), opt('e', { arity: 'required' }), opt('E'), opt('F'), opt('g', { arity: 'required' }), opt('h'), opt('i'), opt('I'), opt('j', { arity: 'required' }), opt('L'), opt('l'), opt('m', { arity: 'required' }), opt('n'), opt('N'), opt('o'), opt('P'), opt('p'), opt('r'), opt('S'), opt('s'), opt('T'), opt('t', { arity: 'required' }), opt('u'), opt('U'), opt('w'), opt('x'), opt('z'), opt('count'), opt('context', { arity: 'required' }), opt('files'), opt('files-with-matches'), opt('follow'), opt('glob', { arity: 'required' }), opt('ignore-file', { arity: 'required' }), opt('json'), opt('line-number'), opt('max-depth', { arity: 'required' }), opt('pretty'), opt('regexp', { arity: 'required' }), opt('sort', { arity: 'required' }), opt('type', { arity: 'required' }), opt('type-not', { arity: 'required' }), opt('vimgrep'), ...INFO_OPTIONS],
  },
  ag: { effect: 'read', options: [opt('A', { arity: 'required' }), opt('a'), opt('B', { arity: 'required' }), opt('C', { arity: 'required' }), opt('c'), opt('G', { arity: 'required' }), opt('g', { arity: 'required' }), opt('i'), opt('l'), opt('n'), opt('numbers'), opt('nocolor'), opt('count'), opt('depth', { arity: 'required' }), opt('files-with-matches'), opt('ignore', { arity: 'required' }), opt('silent'), opt('stats'), opt('W'), opt('w'), ...INFO_OPTIONS] },
};

/** git diff / git show 共用一组输出选项 */
const GIT_DIFF_OPTIONS: readonly OptionSpec[] = [
  opt('b'), opt('B'), opt('c'), opt('C', { arity: 'required' }), opt('d'), opt('f'), opt('F', { arity: 'required' }), opt('l'), opt('m'), opt('M'), opt('p'), opt('R'), opt('r'), opt('s'), opt('S', { arity: 'required' }), opt('U', { arity: 'required' }), opt('u'), opt('w'), opt('cached'), opt('color', { arity: 'optional' }), opt('no-color'), opt('context', { arity: 'required' }), opt('dirstat', { arity: 'optional' }), opt('ext-diff'), opt('no-ext-diff'), opt('find-copies'), opt('find-renames', { arity: 'optional' }), opt('ignore-all-space'), opt('ignore-space-at-eol'), opt('ignore-space-change'), opt('inter-hunk-context', { arity: 'required' }), opt('name-only'), opt('name-status'), opt('no-index'), opt('numstat'), opt('patch'), opt('patch-with-stat'), opt('quiet'), opt('renames'), opt('shortstat'), opt('src-prefix', { arity: 'required' }), opt('dst-prefix', { arity: 'required' }), opt('staged'), opt('stat'), opt('summary'), opt('word-diff', { arity: 'optional' }), opt('unified', { arity: 'required' }),
  // `--output=<file>` 把 diff 写到文件,不是只读
  opt('output', { arity: 'required', effects: ['write'], breaksReadonly: true }),
];

const GIT_SUBCOMMANDS: Readonly<Record<string, SubcommandSpec>> = {
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

const GIT_SPEC: CommandSpec = {
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

const NESTED_READ_ONLY: readonly string[] = ['ls', 'list', 'view', 'inspect', 'show', 'status', 'df', 'describe', 'diff', 'history', 'logs', 'ps', 'top', 'port', 'stats', 'wait', 'export', 'get', 'current-context', 'privileges', 'token'];

/** 二级命令族(docker volume ls / kubectl rollout status)共用的登记模板 */
function nestedSpec(mutating: readonly string[], extra: readonly OptionSpec[] = []): SubcommandSpec {
  return {
    mutatingOperands: mutating,
    readGuardOptions: NESTED_READ_ONLY,
    options: [opt('a'), opt('q'), opt('v'), opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('filter', { arity: 'required' }), ...extra],
  };
}

const DOCKER_SPEC: CommandSpec = {
  effect: 'write',
  structured: true,
  globalOptions: [opt('H', { arity: 'required' }), opt('D'), opt('config', { arity: 'required' }), opt('context', { arity: 'required' }), opt('host', { arity: 'required' }), opt('log-level', { arity: 'required' }), opt('tlsverify'), opt('tlscacert', { arity: 'required' }), opt('tlscert', { arity: 'required' }), opt('tlskey', { arity: 'required' }), opt('debug'), opt('version'), opt('help')],
  subcommands: {
    ps: { effects: ['read'], options: [opt('a'), opt('l'), opt('n', { arity: 'required' }), opt('q'), opt('all'), opt('filter', { arity: 'required' }), opt('format', { arity: 'required' }), opt('last', { arity: 'required' }), opt('latest'), opt('no-trunc'), opt('quiet'), opt('size')] },
    logs: { effects: ['read'], options: [opt('f'), opt('t'), opt('details'), opt('follow'), opt('since', { arity: 'required' }), opt('tail', { arity: 'required' }), opt('timestamps'), opt('until', { arity: 'required' })] },
    inspect: { effects: ['read'], options: [opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('size'), opt('type', { arity: 'required' }), opt('verbose'), opt('go-template', { arity: 'required' })] },
    version: { effects: ['read'], options: [opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('short')] },
    info: { effects: ['read'], options: [opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('debug')] },
    images: { effects: ['read'], options: [opt('a'), opt('q'), opt('all'), opt('digests'), opt('filter', { arity: 'required' }), opt('format', { arity: 'required' }), opt('no-trunc'), opt('quiet'), opt('tree')] },
    top: { effects: ['read'], options: [] },
    port: { effects: ['read'], options: [] },
    diff: { effects: ['read'], options: [] },
    events: { effects: ['read'], options: [opt('since', { arity: 'required' }), opt('until', { arity: 'required' }), opt('filter', { arity: 'required' }), opt('format', { arity: 'required' })] },
    wait: { effects: ['read'], options: [opt('p'), opt('condition', { arity: 'required' })] },
    history: { effects: ['read'], options: [opt('q'), opt('no-trunc'), opt('quiet'), opt('format', { arity: 'required' })] },
    stats: { effects: ['read'], options: [opt('a'), opt('no-stream'), opt('all'), opt('no-trunc'), opt('format', { arity: 'required' })] },
    run: {
      effects: ['write', 'network', 'system'],
      options: [
        opt('privileged', { effects: ['destructive', 'system'], alwaysConfirm: true, rule: 'docker run --privileged' }),
        opt('v', { arity: 'required', effects: ['write'] }), opt('volume', { arity: 'required', effects: ['write'] }), opt('mount', { arity: 'required', effects: ['write'] }), opt('device', { arity: 'required', effects: ['write'] }),
        opt('p', { arity: 'required' }), opt('P'), opt('publish', { arity: 'required' }), opt('publish-all'), opt('e', { arity: 'required' }), opt('env', { arity: 'required' }), opt('env-file', { arity: 'required' }),
        opt('d'), opt('i'), opt('it'), opt('t'), opt('rm'), opt('detach'), opt('interactive'), opt('name', { arity: 'required' }), opt('net', { arity: 'required' }), opt('network', { arity: 'required' }), opt('u', { arity: 'required' }), opt('user', { arity: 'required' }), opt('w', { arity: 'required' }), opt('workdir', { arity: 'required' }),
        opt('entrypoint', { arity: 'required' }), opt('add-host', { arity: 'required' }), opt('label', { arity: 'required' }), opt('pid', { arity: 'required' }), opt('ipc', { arity: 'required' }), opt('uts', { arity: 'required' }), opt('security-opt', { arity: 'required' }), opt('cap-add', { arity: 'required' }), opt('cap-drop', { arity: 'required' }), opt('ulimit', { arity: 'required' }), opt('memory', { arity: 'required' }), opt('cpus', { arity: 'required' }), opt('restart', { arity: 'required' }),
      ],
    },
    create: { effects: ['write'], options: [opt('name', { arity: 'required' }), opt('entrypoint', { arity: 'required' }), opt('e', { arity: 'required' }), opt('v', { arity: 'required' }), opt('p', { arity: 'required' })] },
    start: { effects: ['system', 'write'], options: [opt('a'), opt('i'), opt('attach'), opt('interactive'), opt('check', { arity: 'required' })] },
    stop: { effects: ['system', 'write'], options: [opt('t', { arity: 'required' }), opt('time', { arity: 'required' })] },
    restart: { effects: ['system', 'write'], options: [opt('t', { arity: 'required' }), opt('time', { arity: 'required' })] },
    kill: { effects: ['system', 'destructive'], options: [opt('s', { arity: 'required' }), opt('signal', { arity: 'required' })] },
    rm: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('f'), opt('v'), opt('force'), opt('link'), opt('volumes'), opt('no-index')] },
    rmi: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('f'), opt('force'), opt('no-prune')] },
    build: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('t', { arity: 'required' }), opt('file', { arity: 'required' }), opt('tag', { arity: 'required' }), opt('build-arg', { arity: 'required' }), opt('label', { arity: 'required' }), opt('no-cache'), opt('platform', { arity: 'required' }), opt('progress', { arity: 'required' }), opt('pull'), opt('quiet'), opt('secret', { arity: 'required' }), opt('ssh', { arity: 'required' }), opt('target', { arity: 'required' })] },
    pull: { effects: ['write', 'network'], options: [opt('a'), opt('q'), opt('all-tags'), opt('disable-content-trust', { arity: 'optional' }), opt('platform', { arity: 'required' }), opt('quiet')] },
    push: { effects: ['network', 'write'], options: [opt('a'), opt('q'), opt('all-tags'), opt('quiet'), opt('tag', { arity: 'required' })] },
    exec: { effects: ['system', 'write'], options: [opt('i'), opt('it'), opt('t'), opt('d'), opt('u', { arity: 'required' }), opt('w', { arity: 'required' }), opt('e', { arity: 'required' }), opt('env', { arity: 'required' }), opt('privileged', { effects: ['destructive'], alwaysConfirm: true }), opt('user', { arity: 'required' }), opt('workdir', { arity: 'required' }), opt('detach-keys', { arity: 'required' })] },
    cp: { effects: ['write'], options: [opt('a'), opt('L'), opt('archive'), opt('follow-likelihood')] },
    tag: { effects: ['write'], options: [] },
    save: { effects: ['write'], options: [opt('o', { arity: 'required' }), opt('output', { arity: 'required' })] },
    load: { effects: ['write'], options: [opt('i', { arity: 'required' }), opt('q'), opt('input', { arity: 'required' }), opt('quiet')] },
    import: { effects: ['write'], options: [opt('c', { arity: 'required' }), opt('m', { arity: 'required' }), opt('change', { arity: 'required' }), opt('message', { arity: 'required' })] },
    export: { effects: ['write'], options: [opt('o', { arity: 'required' })] },
    login: { effects: ['network', 'write'], options: [opt('p', { arity: 'required' }), opt('u', { arity: 'required' }), opt('password', { arity: 'required' }), opt('password-stdin'), opt('username', { arity: 'required' })] },
    logout: { effects: ['write'], options: [] },
    attach: { effects: ['system'], options: [opt('no-stdin'), opt('sig-keys', { arity: 'required' })] },
    commit: { effects: ['write'], options: [opt('a'), opt('c', { arity: 'required' }), opt('m', { arity: 'required' }), opt('author', { arity: 'required' }), opt('change', { arity: 'required' }), opt('message', { arity: 'required' })] },
    compose: nestedSpec(['up', 'down', 'build', 'restart', 'kill', 'rm', 'create', 'pull', 'push', 'stop', 'run'], [opt('f', { arity: 'required' }), opt('file', { arity: 'required' }), opt('env-file', { arity: 'required' }), opt('profile', { arity: 'required' })]),
    container: nestedSpec(['run', 'create', 'remove', 'rm', 'start', 'stop', 'restart', 'kill', 'cp', 'commit', 'update', 'prune', 'pause', 'unpause']),
    image: nestedSpec(['build', 'pull', 'push', 'rm', 'remove', 'tag', 'save', 'load', 'import', 'prune']),
    volume: nestedSpec(['create', 'rm', 'remove', 'prune']),
    network: nestedSpec(['create', 'rm', 'remove', 'connect', 'disconnect', 'prune']),
    builder: nestedSpec(['prune', 'build', 'discard'], [opt('a'), opt('ff', { arity: 'required' }), opt('keep-duration', { arity: 'required' }), opt('filter', { arity: 'required' })]),
    system: nestedSpec(['prune', 'df'], [opt('a'), opt('all'), opt('volumes'), opt('force'), opt('filter', { arity: 'required' })]),
    node: nestedSpec(['demote', 'promote', 'update']),
    plugin: nestedSpec(['install', 'enable', 'disable', 'rm', 'remove', 'set', 'upgrade', 'push', 'create', 'configure']),
    secret: nestedSpec(['create', 'rm', 'remove']),
    config: nestedSpec(['create', 'rm', 'remove']),
    stack: nestedSpec(['deploy', 'rm', 'remove', 'up', 'down']),
    service: nestedSpec(['create', 'update', 'rm', 'remove', 'scale']),
    swarm: nestedSpec(['init', 'join', 'leave', 'update']),
    trust: nestedSpec(['sign', 'revoke']),
    manifest: nestedSpec(['create', 'annotate', 'rm', 'remove', 'push', 'inspect', 'rm']),
  },
};

const KUBECTL_SPEC: CommandSpec = {
  effect: 'write',
  structured: true,
  globalOptions: [
    opt('A'), opt('a'), opt('n', { arity: 'required' }), opt('N', { arity: 'required' }), opt('all-namespaces'), opt('as', { arity: 'required' }), opt('as-group', { arity: 'required' }), opt('cache-dir', { arity: 'required' }), opt('certificate-authority', { arity: 'required' }), opt('client'), opt('cluster', { arity: 'required' }), opt('context', { arity: 'required' }), opt('field-manager', { arity: 'required' }), opt('insecure-skip-tls-verify'), opt('kubeconfig', { arity: 'required' }), opt('log-file', { arity: 'required', effects: ['write'] }), opt('log-flush-frequency', { arity: 'required' }), opt('log-level', { arity: 'required' }), opt('namespace', { arity: 'required' }), opt('profile', { arity: 'required' }), opt('profile-output', { arity: 'required' }), opt('request-timeout', { arity: 'required' }), opt('server', { arity: 'required' }), opt('skip-headers'), opt('token', { arity: 'required' }), opt('user', { arity: 'required' }), opt('v', { arity: 'required' }), opt('verbosity', { arity: 'required' }), opt('warn-only'),
  ],
  subcommands: {
    get: { effects: ['read'], options: [opt('A'), opt('a'), opt('o', { arity: 'required' }), opt('w'), opt('allow-missing-template-keys'), opt('all-namespaces'), opt('chunk-size', { arity: 'required' }), opt('field-selector', { arity: 'required' }), opt('ignore-not-found'), opt('l', { arity: 'required' }), opt('no-headers'), opt('output', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('server-print'), opt('show-kind'), opt('show-labels'), opt('show-managed-fields'), opt('sort-by', { arity: 'required' }), opt('template', { arity: 'required' }), opt('watch'), opt('watch-only')] },
    describe: { effects: ['read'], options: [opt('s'), opt('A'), opt('all-namespaces'), opt('filename', { arity: 'required' }), opt('l', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('show-events'), opt('show-labels')] },
    explain: { effects: ['read'], options: [opt('api-version', { arity: 'required' }), opt('recursive')] },
    logs: { effects: ['read'], options: [opt('c', { arity: 'required' }), opt('f'), opt('p'), opt('prefix'), opt('timestamps'), opt('all-containers'), opt('container', { arity: 'required' }), opt('ignore-errors'), opt('insecure-skip-tls-verify-backend'), opt('l', { arity: 'required' }), opt('max-log-bytes', { arity: 'required' }), opt('previous'), opt('selector', { arity: 'required' }), opt('since', { arity: 'required' }), opt('since-time', { arity: 'required' }), opt('tail', { arity: 'required' })] },
    top: { effects: ['read'], options: [opt('no-headers'), opt('containers'), opt('sort-by', { arity: 'required' })] },
    version: { effects: ['read'], options: [opt('o', { arity: 'required' }), opt('short'), opt('output', { arity: 'required' })] },
    'api-resources': { effects: ['read'], options: [opt('api-group', { arity: 'required' }), opt('cached'), opt('namespaced'), opt('output', { arity: 'required' }), opt('verbs')] },
    'api-versions': { effects: ['read'], options: [] },
    diff: { effects: ['read', 'network'], options: [opt('f', { arity: 'required' }), opt('R'), opt('filename', { arity: 'required' }), opt('field-manager', { arity: 'required' }), opt('recursive'), opt('server-side')] },
    auth: { effects: ['read', 'network'], options: [opt('canonical'), opt('silent')] },
    completion: { effects: ['read'], options: [opt('no-descriptions')] },
    wait: { effects: ['read', 'network'], options: [opt('a'), opt('all'), opt('for', { arity: 'required' }), opt('overwrite'), opt('timeout', { arity: 'required' })] },
    apply: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('l', { arity: 'required' }), opt('R'), opt('filename', { arity: 'required' }), opt('force-conflicts'), opt('field-manager', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('o', { arity: 'required' }), opt('output', { arity: 'required' }), opt('record'), opt('recursive'), opt('server-side')] },
    delete: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('a'), opt('all'), opt('f', { arity: 'required' }), opt('l', { arity: 'required' }), opt('now'), opt('wait'), opt('all-local'), opt('cascade', { arity: 'required' }), opt('field-manager', { arity: 'required' }), opt('field-selector', { arity: 'required' }), opt('force'), opt('grace-period', { arity: 'required' }), opt('ignore-not-found'), opt('keep-phase', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('timeout', { arity: 'required' })] },
    'delete-collection': { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('field-selector', { arity: 'required' }), opt('timeout', { arity: 'required' }), opt('grace-period', { arity: 'required' })] },
    create: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('R'), opt('allow-missing-template-keys'), opt('filename', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('o', { arity: 'required' }), opt('output', { arity: 'required' }), opt('record'), opt('recursive'), opt('validate')] },
    replace: { effects: ['write', 'destructive'], options: [opt('f', { arity: 'required' }), opt('F', { arity: 'required' }), opt('force'), opt('filename', { arity: 'required' }), opt('grace-period', { arity: 'required' }), opt('o', { arity: 'required' })] },
    patch: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('p', { arity: 'required' }), opt('type', { arity: 'required' }), opt('allow-missing-template-keys'), opt('dry-run', { arity: 'optional' }), opt('field-manager', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('local'), opt('no-headers'), opt('overwrite'), opt('patch', { arity: 'required' }), opt('record')] },
    scale: { effects: ['write', 'network'], options: [opt('r', { arity: 'required' }), opt('allow-missing-template-keys'), opt('current-replicas', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('filename', { arity: 'required' }), opt('o', { arity: 'required' }), opt('replicas', { arity: 'required' }), opt('resource-version', { arity: 'required' }), opt('timeout', { arity: 'required' })] },
    rollout: nestedSpec(['undo', 'pause', 'resume', 'restart', 'history'], [opt('w'), opt('to-revision', { arity: 'required' }), opt('watch'), opt('watch=false'), opt('timeout', { arity: 'required' }), opt('revision', { arity: 'required' }), opt('dry-run', { arity: 'optional' })]),
    label: { effects: ['write', 'network'], options: [opt('l', { arity: 'required' }), opt('list'), opt('all'), opt('allow-missing-template-keys'), opt('dry-run', { arity: 'optional' }), opt('field-manager', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('local'), opt('overwrite'), opt('resource-version', { arity: 'required' }), opt('selector', { arity: 'required' })] },
    annotate: { effects: ['write', 'network'], options: [opt('l', { arity: 'required' }), opt('list'), opt('field-manager', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('overwrite'), opt('local')] },
    taint: { effects: ['write', 'network'], options: [opt('all'), opt('overwrite'), opt('allow-missing-template-keys'), opt('field-manager', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('resource-version', { arity: 'required' })] },
    cordon: { effects: ['write', 'network'], options: [opt('dry-run', { arity: 'optional' })] },
    uncordon: { effects: ['write', 'network'], options: [opt('dry-run', { arity: 'optional' })] },
    drain: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('f'), opt('force'), opt('grace-period', { arity: 'required' }), opt('ignore-daemonsets'), opt('delete-emptydir-data'), opt('disable-eviction'), opt('pod-selector', { arity: 'required' }), opt('skip-wait-for-delete-timeout', { arity: 'required' }), opt('timeout', { arity: 'required' })] },
    exec: { effects: ['system', 'network'], options: [opt('c', { arity: 'required' }), opt('i'), opt('p'), opt('q'), opt('t'), opt('container', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('pod-running-timeout', { arity: 'required' }), opt('stdin'), opt('stdout'), opt('quiet')] },
    'port-forward': { effects: ['network', 'system'], options: [opt('address', { arity: 'required' }), opt('arguments'), opt('env-var', { arity: 'required' }), opt('pod-running-timeout', { arity: 'required' })] },
    attach: { effects: ['system'], options: [opt('c', { arity: 'required' }), opt('i'), opt('q'), opt('t'), opt('container', { arity: 'required' }), opt('quiet')] },
    run: { effects: ['write', 'network', 'system'], options: [opt('i'), opt('it'), opt('rm'), opt('t'), opt('allow-missing-template-keys'), opt('attach'), opt('command'), opt('dry-run', { arity: 'optional' }), opt('env', { arity: 'required' }), opt('expose'), opt('image', { arity: 'required' }), opt('labels', { arity: 'required' }), opt('overrides', { arity: 'required' }), opt('port', { arity: 'required' }), opt('restart', { arity: 'required' }), opt('serviceaccount', { arity: 'required' })] },
    expose: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('name', { arity: 'required' }), opt('protocol', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('external-ip', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('load-balancer-ip', { arity: 'required' }), opt('o', { arity: 'required' }), opt('port', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('target-port', { arity: 'required' }), opt('type', { arity: 'required' })] },
    proxy: { effects: ['network', 'system'], options: [opt('address', { arity: 'required' }), opt('port', { arity: 'required' })] },
    config: {
      readGuardOptions: ['view', 'current-context', 'get-contexts', 'describe'],
      mutatingOperands: ['set-context', 'use-context', 'set-credentials', 'delete-context', 'unset', 'rename-context', 'set', 'set-cluster'],
      options: [opt('o', { arity: 'required' }), opt('output', { arity: 'required' }), opt('flatten'), opt('minify'), opt('raw-bytes')],
    },
  },
};

const CARGO_SPEC: CommandSpec = {
  effect: 'write',
  structured: true,
  globalOptions: [opt('v', { arity: 'optional' }), opt('q'), opt('color', { arity: 'required' }), opt('config', { arity: 'required' }), opt('frozen'), opt('future-incompat-report'), opt('locked'), opt('manifest-path', { arity: 'required' }), opt('offline'), opt('version'), opt('help'), opt('Z', { arity: 'required' })],
  subcommands: {
    check: { effects: ['read'], options: [opt('p', { arity: 'required' }), opt('a'), opt('all-targets'), opt('all-features'), opt('benches'), opt('bins'), opt('doc'), opt('examples'), opt('features', { arity: 'required' }), opt('keep-going'), opt('lib'), opt('no-default-features'), opt('package', { arity: 'required' }), opt('profile', { arity: 'required' }), opt('quiet'), opt('release'), opt('target', { arity: 'required' }), opt('tests'), opt('verbose'), opt('workspace')] },
    tree: { effects: ['read'], options: [opt('d'), opt('e', { arity: 'required' }), opt('f', { arity: 'required' }), opt('i', { arity: 'required' }), opt('p', { arity: 'required' }), opt('a'), opt('build'), opt('depth', { arity: 'required' }), opt('dev'), opt('duplicates'), opt('edges', { arity: 'required' }), opt('features', { arity: 'required' }), opt('invert', { arity: 'required' }), opt('no-dedupe'), opt('offline'), opt('pkgs', { arity: 'required' }), opt('prefix', { arity: 'required' }), opt('prune', { arity: 'required' }), opt('target', { arity: 'required' }), opt('workspace')] },
    metadata: { effects: ['read'], options: [opt('a'), opt('no-deps'), opt('format-version', { arity: 'required' }), opt('filter-platform', { arity: 'required' }), opt('features', { arity: 'required' })] },
    build: {
      effects: ['write'],
      // `cargo build` 会落产物,只有 --dry-run 形态免确认(与旧两词白名单 `build --dry-run` 同义)
      readGuardOptions: ['dry-run'],
      options: [opt('p', { arity: 'required' }), opt('a'), opt('all-targets'), opt('all-features'), opt('bin', { arity: 'required' }), opt('benches'), opt('colors', { arity: 'optional' }), opt('doc'), opt('example', { arity: 'required' }), opt('examples'), opt('features', { arity: 'required' }), opt('jobs', { arity: 'required' }), opt('lib'), opt('no-default-features'), opt('offline'), opt('package', { arity: 'required' }), opt('profile', { arity: 'required' }), opt('quiet'), opt('release'), opt('target', { arity: 'required' }), opt('tests'), opt('verbose'), opt('workspace'), opt('dry-run')],
    },
    test: { effects: ['write'], readGuardOptions: ['no-run'], options: [opt('p', { arity: 'required' }), opt('a'), opt('all-features'), opt('benches'), opt('doc'), opt('examples'), opt('features', { arity: 'required' }), opt('lib'), opt('no-default-features'), opt('no-fail-fast'), opt('no-run'), opt('package', { arity: 'required' }), opt('profile', { arity: 'required' }), opt('quiet'), opt('release'), opt('target', { arity: 'required' }), opt('workspace'), opt('doc') ] },
    // 以下一律非只读:会改文件、装包或执行代码
    clippy: { effects: ['write'], options: [opt('fix', { effects: ['write', 'destructive'], alwaysConfirm: true, rule: 'cargo clippy --fix' }), opt('a'), opt('allow-dirty'), opt('allow-staged'), opt('all-targets'), opt('features', { arity: 'required' }), opt('offline'), opt('package', { arity: 'required' })] },
    fmt: { effects: ['write'], options: [opt('a'), opt('all'), opt('check'), opt('color', { arity: 'required' }), opt('config-path', { arity: 'required' }), opt('config', { arity: 'required' })] },
    run: { effects: ['write', 'system'], options: [opt('b', { arity: 'required' }), opt('bin', { arity: 'required' }), opt('example', { arity: 'required' }), opt('features', { arity: 'required' }), opt('package', { arity: 'required' }), opt('release')] },
    add: { effects: ['write', 'network'], options: [opt('b', { arity: 'required' }), opt('D'), opt('F'), opt('O'), opt('p', { arity: 'required' }), opt('build'), opt('dev'), opt('dry-run'), opt('features', { arity: 'required' }), opt('git', { arity: 'required' }), opt('no-default-features'), opt('optional'), opt('path', { arity: 'required' }), opt('rename', { arity: 'required' }), opt('registry', { arity: 'required' })] },
    remove: { effects: ['write'], options: [opt('p', { arity: 'required' }), opt('dependency', { arity: 'required' }), opt('dev'), opt('dry-run'), opt('optional'), opt('package', { arity: 'required' })] },
    update: { effects: ['write', 'network'], options: [opt('a'), opt('p', { arity: 'required' }), opt('aggressive'), opt('breaking'), opt('dry-run'), opt('package', { arity: 'required' }), opt('precise', { arity: 'required' }), opt('to-lockfile'), opt('workspace')] },
    'generate-lockfile': { effects: ['write'], options: [opt('dry-run')] },
    install: { effects: ['write', 'network'], options: [opt('b', { arity: 'required' }), opt('f'), opt('g'), opt('bin', { arity: 'required' }), opt('debug'), opt('example', { arity: 'required' }), opt('features', { arity: 'required' }), opt('force'), opt('git', { arity: 'required' }), opt('list'), opt('locked'), opt('path', { arity: 'required' }), opt('root', { arity: 'required' }), opt('version', { arity: 'required' })] },
    uninstall: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [] },
    publish: { effects: ['network', 'write'], alwaysConfirm: true, options: [opt('a'), opt('allow-dirty'), opt('dry-run'), opt('features', { arity: 'required' }), opt('no-verify'), opt('registry', { arity: 'required' }), opt('token', { arity: 'required' })] },
    clean: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('p', { arity: 'required' }), opt('offline'), opt('package', { arity: 'required' }), opt('profile', { arity: 'required' }), opt('release'), opt('targets')] },
    doc: { effects: ['write'], options: [opt('o'), opt('open'), opt('no-deps'), opt('release'), opt('package', { arity: 'required' }), opt('features', { arity: 'required' })] },
    fix: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('a'), opt('all'), opt('edition'), opt('dry-run'), opt('migration', { arity: 'required' })] },
    new: { effects: ['write'], options: [opt('b'), opt('vcs', { arity: 'required' }), opt('name', { arity: 'required' })] },
    init: { effects: ['write'], options: [opt('b'), opt('vcs', { arity: 'required' }), opt('name', { arity: 'required' })] },
    vendor: { effects: ['write', 'network'], options: [opt('o', { arity: 'required' }), opt('sync', { arity: 'required' }), opt('manifest-path', { arity: 'required' })] },
    report: { effects: ['read'], options: [opt('future-incompat')] },
    search: { effects: ['network'], options: [opt('limit', { arity: 'required' })] },
    'locate-project': { effects: ['read'], options: [opt('workspace')] },
  },
};

const INSTALL_OPTIONS: readonly OptionSpec[] = [
  opt('D'), opt('E'), opt('F'), opt('O'), opt('P'), opt('C', { arity: 'required' }), opt('dev'), opt('dir', { arity: 'required' }), opt('frozen-lockfile'), opt('global'), opt('g'), opt('ignore-scripts'), opt('legacy-peer-deps'), opt('lockfile-only'), opt('no-audit'), opt('no-fund'), opt('no-save'), opt('prefix', { arity: 'required' }), opt('production'), opt('reporter', { arity: 'required' }), opt('save'), opt('save-dev'), opt('save-exact'), opt('save-optional'), opt('save-prod'), opt('workspace', { arity: 'required' }),
];

const PACKAGE_MANAGER_SUBCOMMANDS: Readonly<Record<string, SubcommandSpec>> = {
  install: { effects: ['write', 'network'], options: INSTALL_OPTIONS },
  i: { effects: ['write', 'network'], options: INSTALL_OPTIONS },
  add: { effects: ['write', 'network'], options: INSTALL_OPTIONS },
  ci: { effects: ['write', 'network'], options: [opt('frozen-lockfile'), opt('no-audit'), opt('ignore-scripts')] },
  'frozen-lockfile': { effects: ['write', 'network'], options: INSTALL_OPTIONS },
  uninstall: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('global'), opt('g'), opt('no-audit')] },
  remove: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('global'), opt('g')] },
  rm: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('global'), opt('g')] },
  update: { effects: ['write', 'network'], options: [opt('i'), opt('latest'), opt('interactive'), opt('global'), opt('g'), opt('no-audit'), opt('workspace')] },
  upgrade: { effects: ['write', 'network'], options: [opt('i'), opt('interactive'), opt('latest')] },
  publish: { effects: ['network', 'write'], alwaysConfirm: true, options: [opt('access', { arity: 'required' }), opt('dry-run'), opt('provenance'), opt('tag', { arity: 'required' })] },
  run: { effects: ['system', 'write'], options: [opt('C', { arity: 'required' }), opt('if-present'), opt('report-summary'), opt('silent'), opt('workspace', { arity: 'required' })] },
  exec: { effects: ['system', 'network', 'write'], options: [opt('c', { arity: 'required' }), opt('package', { arity: 'required' }), opt('yes')] },
  dlx: { effects: ['system', 'network', 'write'], options: [opt('package', { arity: 'required' }), opt('yes')] },
  link: { effects: ['write'], options: [opt('all'), opt('global')] },
  unlink: { effects: ['write'], options: [] },
  rebuild: { effects: ['write'], options: [opt('global')] },
  audit: { effects: ['network'], options: [opt('fix', { effects: ['write'], rule: 'npm audit fix' }), opt('json'), opt('audit-level', { arity: 'required' })] },
  config: { readGuardOptions: ['get', 'list'], mutatingOperands: ['set', 'delete', 'edit'], options: [opt('json'), opt('list'), opt('location', { arity: 'required' }), opt('global')] },
  init: { effects: ['write'], options: [opt('f', { arity: 'required' }), opt('scope', { arity: 'required' }), opt('yes')] },
  create: { effects: ['write', 'network'], options: [] },
  dedupe: { effects: ['write'], options: [opt('global')] },
  prune: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('global'), opt('dry-run')] },
  store: { readGuardOptions: ['path'], mutatingOperands: ['prune', 'add'], options: [] },
  patch: { effects: ['write'], options: [] },
  deploy: { effects: ['write', 'network'], options: [opt('outDir', { arity: 'required' })] },
  restart: { effects: ['system', 'write'], options: [] },
  stop: { effects: ['system', 'write'], options: [] },
  list: { effects: ['network'], options: [opt('global'), opt('long')] },
};

function packageManagerSpec(globalOptions: readonly OptionSpec[]): CommandSpec {
  return { effect: 'write', structured: true, globalOptions, subcommands: PACKAGE_MANAGER_SUBCOMMANDS };
}

const FS_MUTATION_OPTIONS: readonly OptionSpec[] = [
  opt('b'), opt('d'), opt('f'), opt('F', { arity: 'required' }), opt('i'), opt('k'), opt('l'), opt('L'), opt('n'), opt('p'), opt('P'), opt('R'), opt('r'), opt('S', { arity: 'required' }), opt('s'), opt('t', { arity: 'required' }), opt('T'), opt('u'), opt('v'), opt('V'), opt('a'), opt('backup', { arity: 'optional' }), opt('copy-contents'), opt('dereference'), opt('interactive', { arity: 'optional' }), opt('link'), opt('no-clobber'), opt('no-dereference'), opt('no-preserve', { arity: 'required' }), opt('preserve', { arity: 'required' }), opt('recursive'), opt('reflink', { arity: 'required' }), opt('remove-destination', { effects: ['destructive'] }), opt('sparse', { arity: 'optional' }), opt('suffix', { arity: 'required' }), opt('target-directory', { arity: 'required' }), opt('update'), opt('verbose'),
];

export const SYNTAX_TABLE: Readonly<Record<string, CommandSpec>> = {
  ...READ_ONLY_SIMPLE,
  git: GIT_SPEC,
  docker: DOCKER_SPEC,
  kubectl: KUBECTL_SPEC,
  cargo: CARGO_SPEC,
  npm: packageManagerSpec([opt('C', { arity: 'required' }), opt('loglevel', { arity: 'required' }), opt('prefix', { arity: 'required' }), opt('color', { arity: 'required' }), opt('no-color'), opt('global'), opt('version'), opt('help')]),
  pnpm: packageManagerSpec([opt('C', { arity: 'required' }), opt('r'), opt('recursive'), opt('filter', { arity: 'required' }), opt('dir', { arity: 'required' }), opt('workspace-root'), opt('frozen-lockfile'), opt('no-frozen-lockfile'), opt('loglevel', { arity: 'required' }), opt('reporter', { arity: 'required' }), opt('version'), opt('help')]),

  gh: {
    effect: 'write',
    structured: true,
    globalOptions: [opt('R', { arity: 'required' }), opt('repo', { arity: 'required' }), opt('hostname', { arity: 'required' }), opt('version'), opt('help')],
    subcommands: {
      pr: { readGuardOptions: ['list', 'view', 'status', 'diff', 'checkout'], mutatingOperands: ['create', 'merge', 'close', 'review', 'ready', 'reopen', 'edit', 'comment', 'delete'], options: [opt('web'), opt('json', { arity: 'required' }), opt('jq', { arity: 'required' }), opt('number', { arity: 'required' }), opt('body', { arity: 'required' }), opt('title', { arity: 'required' }), opt('base', { arity: 'required' }), opt('delete-branch'), opt('merge-method', { arity: 'required' }), opt('rebase', { arity: 'optional' }), opt('repo', { arity: 'required' })] },
      issue: { readGuardOptions: ['list', 'view', 'status'], mutatingOperands: ['create', 'close', 'comment', 'edit', 'reopen', 'delete', 'transfer', 'lock'], options: [opt('web'), opt('json', { arity: 'required' }), opt('jq', { arity: 'required' }), opt('state', { arity: 'required' }), opt('label', { arity: 'required' }), opt('assignee', { arity: 'required' }), opt('milestone', { arity: 'required' }), opt('title', { arity: 'required' }), opt('body', { arity: 'required' })] },
      release: { readGuardOptions: ['list', 'view'], mutatingOperands: ['create', 'edit', 'delete', 'upload', 'download'], options: [opt('web'), opt('latest'), opt('draft'), opt('prerelease'), opt('notes', { arity: 'required' }), opt('notes-file', { arity: 'required' }), opt('title', { arity: 'required' }), opt('target', { arity: 'required' })] },
      api: { effects: ['network', 'write'], options: [opt('X', { arity: 'required', rule: 'gh api -X' }), opt('method', { arity: 'required' }), opt('cache', { arity: 'required' }), opt('f', { arity: 'required' }), opt('field', { arity: 'required' }), opt('input', { arity: 'required' }), opt('jq', { arity: 'required' }), opt('paginate'), opt('slurp'), opt('include'), opt('silent'), opt('preview', { arity: 'required' })] },
      auth: { readGuardOptions: ['status'], mutatingOperands: ['login', 'logout', 'refresh', 'token'], options: [opt('git-protocol', { arity: 'required' }), opt('hostname', { arity: 'required' }), opt('scopes', { arity: 'required' }), opt('web'), opt('with-token')] },
      workflow: { readGuardOptions: ['list', 'view'], mutatingOperands: ['run', 'enable', 'disable', 'delete'], options: [opt('log'), opt('watch'), opt('failed'), opt('attempt', { arity: 'required' }), opt('jq', { arity: 'required' })] },
      repo: { readGuardOptions: ['view', 'clone', 'fork', 'list'], mutatingOperands: ['create', 'sync', 'delete', 'archive', 'rename', 'unarchive'], options: [opt('clone'), opt('fork'), opt('private'), opt('public'), opt('source', { arity: 'required' }), opt('description', { arity: 'required' })] },
      codespaces: { readGuardOptions: ['list', 'view'], mutatingOperands: ['create', 'ssh', 'code', 'stop', 'delete', 'set'], options: [] },
      browse: { effects: ['network'], options: [] },
      search: { effects: ['network'], options: [opt('limit', { arity: 'required' }), opt('json', { arity: 'required' })] },
      status: { effects: ['network'], options: [opt('repo', { arity: 'required' }), opt('jq', { arity: 'required' })] },
      alias: { readGuardOptions: ['list'], mutatingOperands: ['set', 'delete'], options: [] },
      gpg: { readGuardOptions: ['list'], mutatingOperands: ['key'], options: [] },
    },
  },

  // 文本与文件处理
  sed: {
    effect: 'read',
    // 脚本体里可以出现 `w file` / `e cmd`,静态上判不出 -> 只读结论一律降级为 unknown
    opaqueOperands: true,
    options: [
      opt('i', { arity: 'optional', effects: ['write'], breaksReadonly: true, rule: 'sed -i' }),
      opt('in-place', { arity: 'optional', effects: ['write'], breaksReadonly: true, rule: 'sed --in-place' }),
      opt('b'), opt('d'), opt('E'), opt('f', { arity: 'required' }), opt('l', { arity: 'required' }), opt('n'), opt('r'), opt('s', { arity: 'required' }), opt('z'), opt('e', { arity: 'required' }), opt('expression', { arity: 'required' }), opt('file', { arity: 'required' }), opt('follow-symlinks'), opt('line-length', { arity: 'required' }), opt('posix'), opt('quiet'), opt('separate'), opt('silent'), opt('debug'), ...INFO_OPTIONS,
    ],
  },
  awk: {
    effect: 'read',
    opaqueOperands: true,
    options: [
      opt('b'), opt('c'), opt('d'), opt('E'), opt('e', { arity: 'required' }), opt('f', { arity: 'required' }), opt('i'), opt('L'), opt('M'), opt('p', { arity: 'required' }), opt('W', { arity: 'required' }), opt('assign', { arity: 'required' }), opt('bignum'), opt('copyright'), opt('dump-variables'), opt('exec'), opt('file', { arity: 'required' }), opt('help'), opt('in-place', { arity: 'optional', effects: ['write'], breaksReadonly: true }), opt('lint', { arity: 'optional' }), opt('no-lc-numbers'), opt('prof', { arity: 'required' }), opt('safe'), opt('timing'), opt('version'),
      opt('v', { arity: 'required' }),
      opt('i', { arity: 'required', effects: ['write'], breaksReadonly: true, rule: 'awk -i inplace' }),
    ],
  },
  find: {
    effect: 'read',
    options: [
      opt('A'), opt('H'), opt('L'), opt('O', { arity: 'required' }), opt('P'), opt('daystart'), opt('delete', { effects: ['destructive'], breaksReadonly: true, alwaysConfirm: true, rule: 'find -delete' }),
      opt('empty'), opt('executable'), opt('exit', { arity: 'required' }), opt('follow'), opt('fstype', { arity: 'required' }), opt('group', { arity: 'required' }), opt('help'), opt('iname', { arity: 'required' }), opt('inum', { arity: 'required' }), opt('ipath', { arity: 'required' }), opt('iregex', { arity: 'required' }), opt('links', { arity: 'required' }), opt('ls'), opt('lname', { arity: 'required' }), opt('lstat'), opt('maxdepth', { arity: 'required' }), opt('mindepth', { arity: 'required' }), opt('mmin', { arity: 'required' }), opt('mount'), opt('mtime', { arity: 'required' }), opt('name', { arity: 'required' }), opt('newer', { arity: 'required' }), opt('newermt', { arity: 'required' }), opt('noleaf'), opt('path', { arity: 'required' }), opt('perm', { arity: 'required' }), opt('print'), opt('print0'), opt('printf', { arity: 'required' }), opt('prune'), opt('quit'), opt('readable'), opt('regex', { arity: 'required' }), opt('regextype', { arity: 'required' }), opt('samefile', { arity: 'required' }), opt('size', { arity: 'required' }), opt('type', { arity: 'required' }), opt('uid', { arity: 'required' }), opt('user', { arity: 'required' }), opt('version'), opt('writable'), opt('xtype', { arity: 'required' }),
      opt('fprint', { arity: 'required', effects: ['write'], breaksReadonly: true }), opt('fprint0', { arity: 'required', effects: ['write'], breaksReadonly: true }), opt('fls', { arity: 'required', effects: ['write'], breaksReadonly: true }), opt('fprintf', { arity: 'required', effects: ['write'], breaksReadonly: true }),
      opt('exec', { arity: 'required', effects: ['system'], breaksReadonly: true, rule: 'find -exec' }), opt('execdir', { arity: 'required', effects: ['system'], breaksReadonly: true }), opt('ok', { arity: 'required', effects: ['system'], breaksReadonly: true }), opt('okdir', { arity: 'required', effects: ['system'], breaksReadonly: true }),
    ],
  },
  xargs: { effect: 'system', opaqueOperands: true, options: [opt('a', { arity: 'required' }), opt('d', { arity: 'required' }), opt('E', { arity: 'required' }), opt('e', { arity: 'optional' }), opt('I', { arity: 'required' }), opt('L', { arity: 'required' }), opt('n', { arity: 'required' }), opt('P', { arity: 'required' }), opt('0'), opt('t'), opt('x'), opt('append'), opt('delimiter', { arity: 'required' }), opt('exec', { arity: 'required' }), opt('limit-args', { arity: 'required' }), opt('no-run-if-empty'), opt('null'), opt('open3'), opt('process-slot-var', { arity: 'required' }), opt('shell-command', { arity: 'required' }), opt('verbose')] },
  rm: {
    effect: 'write',
    operandGuards: [{ kind: 'root-target' }],
    options: [
      opt('r', { effects: ['destructive'], danger: true, rule: 'rm -r' }),
      opt('R', { effects: ['destructive'], danger: true, rule: 'rm -r' }),
      opt('recursive', { effects: ['destructive'], danger: true, rule: 'rm --recursive' }),
      opt('f', { effects: ['destructive'] }),
      opt('force', { effects: ['destructive'] }),
      opt('no-preserve-root', { effects: ['destructive'], danger: true, alwaysConfirm: true, rule: 'rm --no-preserve-root' }),
      opt('d'), opt('dir'), opt('i'), opt('I'), opt('v'), opt('verbose'), opt('z'), opt('interactive', { arity: 'optional' }), opt('preserve-root'), opt('one-file-system'), opt('unlink'), ...INFO_OPTIONS,
    ],
  },
  mv: { effect: 'write', operandGuards: [{ kind: 'root-target' }], options: FS_MUTATION_OPTIONS },
  cp: { effect: 'write', operandGuards: [{ kind: 'root-target' }], options: FS_MUTATION_OPTIONS },
  ln: { effect: 'write', options: FS_MUTATION_OPTIONS },
  mkdir: { effect: 'write', options: [opt('p'), opt('v'), opt('Z', { arity: 'required' }), opt('context', { arity: 'required' }), opt('mode', { arity: 'required' }), opt('parents'), opt('verbose'), ...INFO_OPTIONS] },
  rmdir: { effect: 'write', alwaysConfirm: true, options: [opt('p'), opt('v'), opt('ignore-fail-on-non-empty'), opt('parents'), opt('verbose'), ...INFO_OPTIONS] },
  touch: { effect: 'write', options: [opt('a'), opt('c'), opt('d', { arity: 'required' }), opt('h'), opt('m'), opt('r', { arity: 'required' }), opt('t', { arity: 'required' }), opt('no-create'), opt('no-dereference'), ...INFO_OPTIONS] },
  tee: { effect: 'write', options: [opt('a'), opt('i'), opt('p'), opt('append'), opt('ignore-interrupts'), opt('output-error', { arity: 'required' }), ...INFO_OPTIONS] },
  truncate: { effect: 'write', options: [opt('a'), opt('c'), opt('r', { arity: 'required' }), opt('s', { arity: 'required' }), opt('size', { arity: 'required' }), opt('reference', { arity: 'required' }), ...INFO_OPTIONS] },
  chmod: {
    effect: 'write',
    operandGuards: [{ kind: 'permission-mode' }, { kind: 'root-target' }],
    options: [opt('c'), opt('f'), opt('R', { effects: ['destructive'] }), opt('v'), opt('changes'), opt('nochanges'), opt('reference', { arity: 'required' }), opt('recursive', { effects: ['destructive'] }), opt('silent'), opt('verbose'), opt('preserve-root'), opt('no-preserve-root', { effects: ['destructive'], alwaysConfirm: true }), opt('mode', { arity: 'required' }), ...INFO_OPTIONS],
  },
  chown: {
    effect: 'write',
    danger: true,
    rule: 'chown',
    options: [opt('c'), opt('f'), opt('R', { effects: ['destructive'] }), opt('v'), opt('changes'), opt('from', { arity: 'required' }), opt('no-preserve-root', { effects: ['destructive'], alwaysConfirm: true }), opt('preserve-root'), opt('reference', { arity: 'required' }), opt('recursive', { effects: ['destructive'] }), opt('silent'), opt('verbose'), ...INFO_OPTIONS],
  },
  chgrp: { effect: 'write', danger: true, rule: 'chgrp', options: [opt('c'), opt('f'), opt('R', { effects: ['destructive'] }), opt('v'), opt('changes'), opt('preserve-root'), opt('reference', { arity: 'required' }), opt('recursive', { effects: ['destructive'] }), opt('silent'), opt('verbose'), ...INFO_OPTIONS] },
  chattr: { effect: 'system', danger: true, rule: 'chattr', options: [opt('R', { effects: ['destructive'] }), opt('V'), opt('e', { arity: 'required' }), opt('f'), opt('p', { arity: 'required' }), opt('v', { arity: 'required' })] },
  setfacl: { effect: 'write', options: [opt('b'), opt('d'), opt('m', { arity: 'required' }), opt('n'), opt('R'), opt('x', { arity: 'required' }), opt('modify', { arity: 'required' }), opt('remove', { arity: 'required' }), opt('test')] },
  shred: { effect: 'write', alwaysConfirm: true, rule: 'shred', options: [opt('f'), opt('n', { arity: 'required' }), opt('s', { arity: 'required' }), opt('u'), opt('v'), opt('z'), opt('remove'), opt('verbose')] },
  kill: {
    effect: 'system',
    options: [
      opt('9', { effects: ['destructive'], danger: true, rule: 'kill -9' }),
      opt('KILL', { effects: ['destructive'], danger: true, rule: 'kill -KILL' }),
      opt('L'), opt('l', { arity: 'optional' }), opt('n', { arity: 'required' }), opt('q', { arity: 'required' }), opt('r', { arity: 'required' }), opt('s', { arity: 'required' }), opt('signal', { arity: 'required' }), opt('list'),
    ],
  },
  killall: {
    effect: 'system',
    options: [
      opt('9', { effects: ['destructive'], danger: true, rule: 'killall -9' }),
      opt('KILL', { effects: ['destructive'], danger: true, rule: 'killall -KILL' }),
      opt('e'), opt('g', { arity: 'required' }), opt('i'), opt('I'), opt('o', { arity: 'required' }), opt('q'), opt('r', { arity: 'required' }), opt('s', { arity: 'required' }), opt('t', { arity: 'required' }), opt('v'), opt('w'), opt('y'), opt('quiet'), opt('regex', { arity: 'required' }), opt('signal', { arity: 'required' }), opt('verbose'),
    ],
  },
  pkill: { effect: 'system', danger: true, rule: 'pkill', options: [opt('c'), opt('F', { arity: 'required' }), opt('f'), opt('g', { arity: 'required' }), opt('i'), opt('l'), opt('L'), opt('n'), opt('o'), opt('O', { arity: 'required' }), opt('P', { arity: 'required' }), opt('r'), opt('s', { arity: 'required' }), opt('t', { arity: 'required' }), opt('u', { arity: 'required' }), opt('v'), opt('signal', { arity: 'required' }), opt('full')] },
  shutdown: { effect: 'system', danger: true, alwaysConfirm: true, rule: 'shutdown', options: [opt('a'), opt('h'), opt('k'), opt('P'), opt('r'), opt('t', { arity: 'required' }), opt('w'), opt('now')] },
  reboot: { effect: 'system', danger: true, alwaysConfirm: true, rule: 'reboot', options: [opt('d'), opt('f'), opt('n'), opt('w'), opt('force')] },
  halt: { effect: 'system', alwaysConfirm: true, rule: 'halt', options: [opt('d'), opt('f'), opt('n'), opt('w'), opt('force')] },
  poweroff: { effect: 'system', alwaysConfirm: true, rule: 'poweroff', options: [opt('f'), opt('n'), opt('w'), opt('force')] },
  mkfs: { effect: 'system', danger: true, alwaysConfirm: true, rule: 'mkfs', options: [opt('f'), opt('L', { arity: 'required' }), opt('q'), opt('t', { arity: 'required' }), opt('U', { arity: 'required' }), opt('v'), opt('V')] },
  dd: {
    effect: 'write',
    operandGuards: [{ kind: 'write-to-device' }, { kind: 'root-target' }],
    options: [opt('bs', { arity: 'required' }), opt('cbs', { arity: 'required' }), opt('conv', { arity: 'required' }), opt('ibs', { arity: 'required' }), opt('if', { arity: 'required' }), opt('obs', { arity: 'required' }), opt('of', { arity: 'required' }), opt('skip', { arity: 'required' }), opt('seek', { arity: 'required' }), opt('count', { arity: 'required' }), opt('status', { arity: 'required' })],
  },
  tar: { effect: 'write', options: [opt('c'), opt('x'), opt('t'), opt('z'), opt('j'), opt('J'), opt('C', { arity: 'required' }), opt('f', { arity: 'required' }), opt('v'), opt('create'), opt('directory', { arity: 'required' }), opt('extract'), opt('file', { arity: 'required' }), opt('gzip'), opt('keep-newer-files'), opt('list'), opt('no-same-owner'), opt('overwrite'), opt('to-command', { arity: 'required', effects: ['system'] }), opt('to-stdout'), opt('delete', { effects: ['destructive'], alwaysConfirm: true })] },
  unzip: { effect: 'write', options: [opt('j'), opt('l'), opt('n'), opt('o'), opt('P', { arity: 'required' }), opt('q'), opt('v'), opt('LL'), opt('UU'), opt('qq')] },
  zip: { effect: 'write', options: [opt('9'), opt('f'), opt('j'), opt('P', { arity: 'required' }), opt('q'), opt('r'), opt('T'), opt('u'), opt('v'), opt('x')] },
  patch: { effect: 'write', options: [opt('p', { arity: 'required' }), opt('i', { arity: 'required' }), opt('R'), opt('e'), opt('n'), opt('f', { arity: 'required' }), opt('dry-run'), opt('git'), opt('forward')] },
  curl: {
    effect: 'network',
    options: [
      opt('d', { arity: 'required', effects: ['write'], rule: 'curl -d' }), opt('D', { arity: 'required', effects: ['write'] }), opt('F', { arity: 'required' }), opt('H', { arity: 'required' }), opt('I'), opt('k'), opt('L'), opt('o', { arity: 'required', effects: ['write'] }), opt('O'), opt('P', { arity: 'required' }), opt('q'), opt('r'), opt('S'), opt('s'), opt('T', { arity: 'required', effects: ['write'] }), opt('u', { arity: 'required' }), opt('v'), opt('X', { arity: 'required', rule: 'curl -X' }),
      opt('append'), opt('compressed'), opt('connect-timeout', { arity: 'required' }), opt('cookie', { arity: 'required' }), opt('cookie-jar', { arity: 'required', effects: ['write'] }), opt('data', { arity: 'required' }), opt('data-ascii', { arity: 'required' }), opt('data-binary', { arity: 'required' }), opt('data-raw', { arity: 'required' }), opt('disable'), opt('form', { arity: 'required' }), opt('header', { arity: 'required' }), opt('head'), opt('insecure'), opt('location'), opt('location-trusted'), opt('max-filesize', { arity: 'required' }), opt('max-redirs', { arity: 'required' }), opt('max-time', { arity: 'required' }), opt('output-dir', { arity: 'required', effects: ['write'] }), opt('proxy', { arity: 'required' }), opt('remote-name', { effects: ['write'] }), opt('request', { arity: 'required' }), opt('retry', { arity: 'required' }), opt('show-error'), opt('silent'), opt('trace', { arity: 'required', effects: ['write'] }), opt('trace-ascii', { arity: 'required', effects: ['write'] }), opt('upload-file', { arity: 'required', effects: ['write'] }), opt('user', { arity: 'required' }), opt('verbose'), opt('config', { arity: 'required' }),
    ],
  },
  wget: {
    effect: 'write',
    options: [opt('a', { arity: 'required' }), opt('c'), opt('e', { arity: 'required' }), opt('nv'), opt('o', { arity: 'required' }), opt('O', { arity: 'required' }), opt('P', { arity: 'required' }), opt('q'), opt('r'), opt('S'), opt('t', { arity: 'required' }), opt('v'), opt('Y', { arity: 'required' }), opt('b'), opt('background'), opt('continue'), opt('directory-prefix', { arity: 'required' }), opt('header', { arity: 'required' }), opt('level', { arity: 'required' }), opt('mirror'), opt('no-check-certificate'), opt('no-clobber'), opt('no-parents'), opt('output-document', { arity: 'required' }), opt('output-file', { arity: 'required' }), opt('post-data', { arity: 'required' }), opt('quiet'), opt('recursive'), opt('restrict-file-names', { arity: 'required' }), opt('server-response'), opt('spider'), opt('timeout', { arity: 'required' }), opt('tries', { arity: 'required' }), opt('user-agent', { arity: 'required' })],
  },
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
