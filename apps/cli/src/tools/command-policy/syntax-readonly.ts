// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 · 只读命令档(READ_ONLY_SIMPLE):基线效应全为 read 的简单命令。
 *
 * 由 goal-b49 Z14 机械拆分而来(逐字搬运,零改写):
 * 登记内容与拆前逐字节一致,只是分档到不同文件;基线效应/arity 的取值口径未动。
 */

import type { CommandSpec } from './types.js';
import { opt } from './syntax-options.js';
import { INFO_OPTIONS } from './syntax-options.js';

export const READ_ONLY_SIMPLE: Readonly<Record<string, CommandSpec>> = {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
