// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 · 文本/文件/进程/设备档(sed … patch):文件系统与进程侧的写副作用命令。
 *
 * 由 goal-b49 Z14 机械拆分而来(逐字搬运,零改写):
 * 登记内容与拆前逐字节一致,只是分档到不同文件;基线效应/arity 的取值口径未动。
 */

import type { CommandSpec } from './types.js';
import { opt } from './syntax-options.js';
import { INFO_OPTIONS } from './syntax-options.js';
import { FS_MUTATION_OPTIONS } from './syntax-options.js';

export const FILE_SPECS: Readonly<Record<string, CommandSpec>> = {

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
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
