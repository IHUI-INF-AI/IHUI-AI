// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * env-pin.mjs —— 进程级环境变量纠偏(全仓唯一实现)。
 *
 * 立因(2026-11-22):注册表里的用户/机器环境变量已改成系统盘值,但**长期驻留的父进程**
 * (桌面壳、自动化宿主、开机就活着的调度器)仍持有旧 D 盘 env。它们的子进程继承旧值,
 * 于是 `D:\caches\xdg\cache\pnpm`、`D:\caches\gradle` 这类目录被反复重建 —— 改注册表治不了这一层。
 *
 * 做法:入口脚本 import 本模块 ⇒ 本进程**及其全部子进程**在启动瞬间把 env 对齐注册表现值。
 * 只纠"指向不存在路径 或 指向非系统盘"的项;路径存在且就在系统盘上的现值一律不动(那是用户的刻意覆盖)。
 * 幂等:同一进程重复 import 只跑一次。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PINNED_NAMES = [
  'TEMP', 'TMP', 'TMPDIR',
  'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME',
  'PNPM_HOME', 'PNPM_CACHE_DIR',
  'GRADLE_USER_HOME', 'RUSTUP_HOME', 'CARGO_HOME', 'CARGO_TARGET_DIR',
  'UV_CACHE_DIR', 'PIP_CACHE_DIR', 'NUGET_PACKAGES',
  'GOPATH', 'GOMODCACHE', 'GOCACHE', 'PLAYWRIGHT_BROWSERS_PATH',
  'NODE_OPTIONS',
];

/** NODE_OPTIONS 不是路径,单独处理:现值空、注册表非空时才补齐。 */
const NON_PATH_NAMES = new Set(['NODE_OPTIONS']);

let pinnedOnce = false;

function readRegistryEnv() {
  const out = {};
  for (const hive of ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', 'HKCU\\Environment']) {
    const r = spawnSync('reg', ['query', hive], { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0 || !r.stdout) continue;
    for (const line of r.stdout.split(/\r?\n/)) {
      const m = /^\s{2,}(\S+)\s+REG_[A-Z_]+\s+(.*)$/.exec(line);
      if (!m) continue;
      const [, name, value] = m;
      // 用户级优先:先落机器级,再被 HKCU 覆盖
      out[name] = value.trim();
    }
  }
  return out;
}

/** 取值的盘符(认 `D:\` 与 `file:///D:/` 两种形态);非绝对路径返回 null。 */
function driveOf(value) {
  const v = value.replace(/^file:\/\/\//i, '').trim();
  const m = /^([A-Za-z]):[\\/]/.exec(v);
  return m ? m[1].toUpperCase() : null;
}

/** `%SystemRoot%` 这类注册表原样值要展开成实路径,否则子进程拿到的是字面量。 */
function expandVars(value) {
  return value.replace(/%([A-Za-z_][A-Za-z0-9_()]*?)%/g, (whole, name) => process.env[name] ?? whole);
}

/**
 * 现值是否"该被纠正":只在它指向**非系统盘**时才纠 —— 这正是"项目往 D 盘写"的病根。
 * 不拿"路径不存在"当判据:缓存目录本来就可能按需创建,那条规则会误伤用户刻意的临时覆盖。
 */
function isStale(value, systemDrive) {
  const drive = driveOf(value);
  return drive !== null && drive !== systemDrive.toUpperCase();
}

/**
 * 对齐当前进程 env(含派生链)。
 * @returns {{changed: Array<{name: string, from: string, to: string}>, skipped: string[]}}
 */
export function pinEnv() {
  const report = { changed: [], skipped: [] };
  if (process.platform !== 'win32' || pinnedOnce) return report;
  pinnedOnce = true;
  const systemDrive = (process.env.SystemDrive || 'C:').replace(/[\\:]/g, '').toUpperCase() || 'C';
  const registry = readRegistryEnv();

  for (const name of PINNED_NAMES) {
    const raw = registry[name];
    if (!raw) continue;
    const want = expandVars(raw);
    const current = process.env[name] ?? '';
    if (current === want) continue;

    // 注册表值本身也指向非系统盘(或 NODE_OPTIONS 指向不存在的钩子) ⇒ 拒绝搬运,免得把旧病复制一遍
    if (NON_PATH_NAMES.has(name)) {
      if (current) {
        report.skipped.push(name);
        continue;
      }
      const hook = /file:\/\/\/(.+?\.mjs)/.exec(want)?.[1];
      if (hook && !existsSync(hook.replace(/\//g, '\\'))) {
        report.skipped.push(name);
        continue;
      }
      process.env[name] = want;
      report.changed.push({ name, from: '(空)', to: want });
      continue;
    }

    if (isStale(want, systemDrive) || !isStale(current, systemDrive)) {
      report.skipped.push(name);
      continue;
    }
    process.env[name] = want;
    report.changed.push({ name, from: current || '(空)', to: want });
  }

  if (report.changed.length && process.env.IHUI_ENV_PIN_QUIET !== '1') {
    const lines = report.changed.map((c) => `  ${c.name}: ${c.from} -> ${c.to}`);
    process.stderr.write(`[env-pin] 已按注册表纠正 ${report.changed.length} 项:\n${lines.join('\n')}\n`);
  }
  return report;
}

/** CLI: node scripts/lib/env-pin.mjs [--check] —— 供自检与排障。 */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dry = process.argv.includes('--check');
  const report = dry ? { changed: [], skipped: PINNED_NAMES.map((n) => n) } : pinEnv();
  process.stdout.write(`${JSON.stringify({ platform: process.platform, dryRun: dry, ...report }, null, 2)}\n`);
}

pinEnv();
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
