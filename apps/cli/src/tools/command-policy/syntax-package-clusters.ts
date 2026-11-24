// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 · 构建与包管理族(cargo + npm/pnpm 子命令表 + packageManagerSpec 工厂)。
 *
 * 由 goal-b49 Z14 机械拆分而来(逐字搬运,零改写):
 * 登记内容与拆前逐字节一致,只是分档到不同文件;基线效应/arity 的取值口径未动。
 */

import type { CommandSpec, OptionSpec, SubcommandSpec } from './types.js';
import { opt } from './syntax-options.js';
import { INSTALL_OPTIONS } from './syntax-options.js';

export const CARGO_SPEC: CommandSpec = {
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

export function packageManagerSpec(globalOptions: readonly OptionSpec[]): CommandSpec {
  return { effect: 'write', structured: true, globalOptions, subcommands: PACKAGE_MANAGER_SUBCOMMANDS };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
