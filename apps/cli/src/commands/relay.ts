// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Relay CLI —— 把仓内「号池 → 本机客户端」切号能力封装成**稳定、可被其它程序调用**的命令面。
 *
 * 为什么落在 CLI 而不是桌面端 Tauri 命令:
 *  桌面端是薄壳,主窗口与 admin 窗口都加载远程 https://aizhs.top;capabilities/default.json 的
 *  BUG-17 加固(2026-11-06)已把「spawn 子进程 / 文件读写 / 键鼠 / 剪贴板」这类高危族**主动移出
 *  remote 授权面**,理由写明「线上页(含任意 XSS)可直调」。在 Rust 里 spawn node/pwsh 跑仓内脚本
 *  属 RCE 级,若挂到远程 web 设置页按钮,等于把这轮 P0 加固反向推翻。CLI 是本机原生程序、由
 *  操作员自己执行,是这类「本机运维动作」的正确落点,也天然可被其它程序以子进程调用。
 *
 * 分层纪律(§0.6 单一真相源):
 *  - 列池 / 切号判据一律取 scripts/switch-client-account.mjs(唯一切号编排口);
 *  - 快捷方式安装一律取 scripts/install-relay-shortcut.ps1(路径无关安装器);
 *  - 本文件只做「仓库定位 + 前置探测 + 子进程派发 + 退出码透传」,不查库、不碰凭据、不发明判据。
 *
 * 输出约定:本层自己的话一律走 stderr,stdout 只留给被派发脚本 —— `--json` 时 stdout 必须是
 * 纯机读 JSON,不能被本层的提示语污染。
 *
 * 用法:
 *   ihui relay status [--repo <path>] [--json]
 *   ihui relay install-shortcut [--repo <path>] [--desktop <dir>] [--skip-old] [--what-if] [--json]
 *   ihui relay list [--repo <path>] [--counts] [--provider <平台>] [--with-quota] [--json]
 *   ihui relay switch --provider <平台> --to <uid|名称> [--repo <path>] [--dry-run] [--force] [--no-launch] [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveBinaryPath } from '../lsp/probe.js';

/** 唯一切号编排口(本层只派发) */
const SWITCH_ENTRY_REL = path.join('scripts', 'switch-client-account.mjs');
/** 桌面快捷方式安装器(路径无关,从自身位置推算仓库根) */
const INSTALLER_REL = path.join('scripts', 'install-relay-shortcut.ps1');
/** 派发超时:切号整条往返实测约 9s,列池带额度查询更慢;给足 180s 但不无限挂 */
const DISPATCH_TIMEOUT_MS = 180_000;

/**
 * 仓库根识别口径(唯一):同时具备根 package.json 与切号编排口。
 * 只判「像不像本仓」,不判版本、不判分支 —— 那属于别的门。
 */
export function isRepoRoot(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, SWITCH_ENTRY_REL))
  );
}

export interface RepoResolution {
  root: string | null;
  /** 已尝试过的绝对路径(未去重前按优先级),未命中时用于诊断 */
  tried: string[];
}

/**
 * 定位 IHUI-AI 仓库根。优先级:
 *   1. 显式 --repo
 *   2. 环境变量 IHUI_AI_REPO(换机/服务化场景的稳定锚点)
 *   3. 从 cwd 逐级向上(最多 8 层)
 *   4. 常见默认位置(G:\IHUI-AI、~/IHUI-AI)
 * 命中第一个 isRepoRoot 即返回;全未命中返回 root:null(由调用方落未判定,不猜)。
 */
export function resolveRepoRoot(explicit?: string): RepoResolution {
  const tried: string[] = [];
  const push = (value?: string | null): void => {
    if (!value) return;
    const abs = path.resolve(value);
    if (!tried.includes(abs)) tried.push(abs);
  };

  push(explicit);
  push(process.env.IHUI_AI_REPO);

  let cursor = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    push(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  push('G:\\IHUI-AI');
  push(path.join(os.homedir(), 'IHUI-AI'));

  const root = tried.find((dir) => isRepoRoot(dir)) ?? null;
  return { root, tried };
}

/**
 * 当前是否跑在 SEA 单文件 exe 里。
 * SEA 下 process.execPath 指向 ihui(.exe),不能拿它当 node 用;源码/tsx 下它就是 node。
 */
function runningAsSea(): boolean {
  const base = path.basename(process.execPath).toLowerCase().replace(/\.exe$/, '');
  return base !== 'node' && base !== 'nodejs';
}

/**
 * 解析 Node 可执行文件:
 *  - 显式 IHUI_NODE_BIN 优先;
 *  - 非 SEA(源码/tsx)直接用 process.execPath;
 *  - SEA 下从 PATH 找 node(找不到 ⇒ null,由调用方落未判定)。
 */
export function resolveNodeBin(): string | null {
  const override = process.env.IHUI_NODE_BIN;
  if (override && fs.existsSync(override)) return override;
  if (!runningAsSea()) return process.execPath;
  const fromPath = resolveBinaryPath('node');
  return fromPath && fs.existsSync(fromPath) ? fromPath : null;
}

/** 解析 PowerShell:pwsh(PowerShell 7)优先,退回 powershell(安装器带 #requires -Version 7) */
function resolvePowerShell(): string | null {
  for (const name of ['pwsh', 'powershell']) {
    const hit = resolveBinaryPath(name);
    if (hit && fs.existsSync(hit)) return hit;
  }
  return null;
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  error: string | null;
}

/**
 * 把子进程输出字节解码成字符串。
 *
 * 为什么不能直接 `encoding: 'utf8'`:Windows PowerShell 5.1 / 控制台宿主的 Write-Host 中文
 * 走本机代码页(简中 936=GBK),按 UTF-8 硬解会得到一屏乱码(实测 `relay install-shortcut`
 * 的 WhatIf 行)。先严格 UTF-8 解、失败才回退 GBK:UTF-8 合法时不会误判成 GBK
 * (GBK 双字节几乎覆盖任意字节对,先试 GBK 会把正常 UTF-8 中文撕成乱码)。
 */
function decodeChildOutput(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch {
      return buf.toString('utf8');
    }
  }
}

/**
 * 捕获式派发(需要把子进程输出并进 JSON 时用)。
 *
 * 为什么落**临时文件**而不是 pipe:
 *  被派发脚本会再 spawn 孙进程(`switch-client-account.mjs` 用 `stdio:'inherit'` 派生 tsx)。
 *  孙进程继承父进程的 stdout **写端**,而 `spawnSync` 的管道要等「所有写端关闭」才返回 ——
 *  只要有一个后代进程在管道上多活一会儿,就卡到 timeout。实测 `relay list --provider qoder`
 *  会卡满 180s(EXIT=124),而同一命令改走 inherit(无 --json)或直接跑编排器都是秒回。
 *  文件没有写端引用计数问题:进程退出即拿到全部内容,不会因后代进程拖延。
 */
function runCaptured(command: string, args: string[], cwd: string): RunResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-relay-'));
  const outPath = path.join(dir, 'out.txt');
  const errPath = path.join(dir, 'err.txt');
  let outFd: number | null = null;
  let errFd: number | null = null;
  try {
    outFd = fs.openSync(outPath, 'w');
    errFd = fs.openSync(errPath, 'w');
    const r = spawnSync(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', outFd, errFd],
      timeout: DISPATCH_TIMEOUT_MS,
    });
    fs.closeSync(outFd);
    outFd = null;
    fs.closeSync(errFd);
    errFd = null;
    if (r.error) return { status: 2, stdout: '', stderr: '', error: r.error.message };
    return {
      status: r.status ?? 2,
      stdout: decodeChildOutput(fs.readFileSync(outPath)),
      stderr: decodeChildOutput(fs.readFileSync(errPath)),
      error: null,
    };
  } finally {
    if (outFd !== null) {
      try {
        fs.closeSync(outFd);
      } catch {
        /* 已关或关失败都不影响结果 */
      }
    }
    if (errFd !== null) {
      try {
        fs.closeSync(errFd);
      } catch {
        /* 同上 */
      }
    }
    // 清理失败不能盖掉已拿到的结果:超时被杀的子进程在 Windows 上可能仍持有文件句柄
    // (rmSync 抛 EBUSY),而它抛在 finally 里会让整条命令崩掉、把业务结果吞了。
    // 残留落在系统 TEMP 下,由系统回收,不影响退出码与输出。
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 刻意忽略:清理是尽力而为 */
    }
  }
}

/** 直通式派发(交互/流式场景用):子进程接管三条通道,退出码原样透传 */
function runStreamed(command: string, args: string[], cwd: string): number {
  const r = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    timeout: DISPATCH_TIMEOUT_MS,
  });
  if (r.error) {
    console.error(chalk.red(`❌ 派发失败(未判定): ${r.error.message}`));
    return 2;
  }
  return r.status ?? 2;
}

/**
 * 机读式派发:只把「可解析的 JSON 行」放上 stdout,其余一律归 stderr。
 *
 * 立因(实测):底层 relay-pool-account-list.ts 会把 `[db] ...` 建连日志打到 stdout,
 * 严格消费方 `JSON.parse(stdout)` 会直接炸。仓内既有 double-click 入口
 * (client-oneclick-switch.mjs 的 runPoolListJson)也是"挑能 parse 的那一行",本层把这条
 * 约定固化成对外的稳定契约:stdout 只留 JSON,日志走 stderr。
 */
/**
 * 从「日志 + JSON 混在一起」的 stdout 里切出 JSON 载荷。
 *
 * 为什么不能逐行 `JSON.parse`:被派发脚本的输出形态有两种 ——
 *  - `--list --counts` / `--list --provider`:整行紧凑 JSON(一行一个对象);
 *  - `--to ... --json`(切号):**多行 pretty-print** JSON。
 * 逐行判定对后者会把每一行都判成「非 JSON」,于是合法载荷被当垃圾扔掉。
 *
 * 做法:从每个 `{` / `[` 起做括号配平扫描(跳过字符串内的括号与转义),切出候选片段
 * 再整体 `JSON.parse` 验证。成功即收,失败就从下一个字符继续找。日志行原样归 rest。
 */
function splitJsonPayloads(text: string): { payloads: string[]; rest: string[] } {
  const payloads: string[] = [];
  const rest: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    // 找下一个可能的载荷起点
    let start = -1;
    for (let i = cursor; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '{' || ch === '[') {
        start = i;
        break;
      }
    }
    if (start === -1) {
      rest.push(text.slice(cursor));
      break;
    }
    // 起点之前的日志
    if (start > cursor) rest.push(text.slice(cursor, start));

    // 括号配平(字符串内的 {}[] 不算)
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{' || ch === '[') {
        depth += 1;
      } else if (ch === '}' || ch === ']') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (end === -1) {
      // 配不平 ⇒ 从这里到结尾都不是完整载荷,按日志处理
      rest.push(text.slice(start));
      break;
    }

    const candidate = text.slice(start, end);
    try {
      JSON.parse(candidate);
      payloads.push(candidate);
      cursor = end;
    } catch {
      // 不是 JSON(可能只是日志里恰好出现一个 '{')⇒ 该字符当普通文本,继续往后找
      rest.push(text.slice(start, start + 1));
      cursor = start + 1;
    }
  }

  return { payloads, rest };
}

function runJsonOnly(command: string, args: string[], cwd: string): number {
  const result = runCaptured(command, args, cwd);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(chalk.red(`❌ 派发失败(未判定): ${result.error}`));
    return 2;
  }

  const { payloads, rest } = splitJsonPayloads(result.stdout);
  const leftover = rest.join('').trim();
  if (leftover !== '') process.stderr.write(`${leftover}\n`);

  if (payloads.length === 0) {
    console.error(chalk.red('❌ 被派发脚本未输出可解析 JSON(未判定,不冒充成功)'));
    return result.status === 0 ? 2 : result.status;
  }
  for (const payload of payloads) process.stdout.write(`${payload}\n`);
  return result.status;
}

/** 取仓库根或落未判定(把尝试过的路径全列出来,不让操作员猜) */
function requireRepo(explicit?: string): string | null {
  const { root, tried } = resolveRepoRoot(explicit);
  if (root) return root;
  console.error(
    chalk.red('❌ 未找到 IHUI-AI 仓库(需同时含 package.json 与 scripts/switch-client-account.mjs)'),
  );
  console.error(chalk.dim('  已尝试:'));
  for (const dir of tried) console.error(chalk.dim(`    - ${dir}`));
  console.error(chalk.dim('  可用 --repo <路径> 或环境变量 IHUI_AI_REPO 显式指定。'));
  return null;
}

function requireNode(): string | null {
  const node = resolveNodeBin();
  if (node) return node;
  console.error(chalk.red('❌ 未找到 Node 可执行文件(SEA 模式下需 PATH 里存在 node)'));
  console.error(chalk.dim('  可用环境变量 IHUI_NODE_BIN 显式指定。'));
  return null;
}

interface StatusOptions {
  repo?: string;
  json?: boolean;
}

interface InstallOptions {
  repo?: string;
  desktop?: string;
  skipOld?: boolean;
  whatIf?: boolean;
  json?: boolean;
}

interface ListOptions {
  repo?: string;
  provider?: string;
  counts?: boolean;
  withQuota?: boolean;
  json?: boolean;
}

interface SwitchOptions {
  repo?: string;
  provider: string;
  to: string;
  dryRun?: boolean;
  force?: boolean;
  noLaunch?: boolean;
  json?: boolean;
}

function runStatus(opts: StatusOptions): number {
  const { root, tried } = resolveRepoRoot(opts.repo);
  const node = resolveNodeBin();
  const powershell = resolvePowerShell();
  const tsx = root
    ? ([
        path.join(root, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      ].find((candidate) => fs.existsSync(candidate)) ?? null)
    : null;
  const ready = Boolean(root && node && tsx);

  const payload = {
    ok: ready,
    platform: process.platform,
    repoRoot: root,
    tried,
    node,
    powershell,
    tsx,
    entry: root ? path.join(root, SWITCH_ENTRY_REL) : null,
    installer: root ? path.join(root, INSTALLER_REL) : null,
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return ready ? 0 : 2;
  }

  console.log(chalk.bold('IHUI 切号前置检查'));
  console.log(`  仓库根   ${root ?? chalk.red('未找到')}`);
  console.log(`  Node     ${node ?? chalk.red('未找到')}`);
  console.log(`  tsx      ${tsx ?? chalk.red('未找到(先在仓根 pnpm install)')}`);
  console.log(`  PS       ${powershell ?? chalk.yellow('未找到(仅影响 install-shortcut)')}`);
  console.log(`  切号入口 ${root ? path.join(root, SWITCH_ENTRY_REL) : chalk.dim('-')}`);
  console.log(`  安装器   ${root ? path.join(root, INSTALLER_REL) : chalk.dim('-')}`);
  console.log(
    ready
      ? chalk.green('✅ 前置就绪,可执行 ihui relay list / switch')
      : chalk.red('❌ 前置未就绪,先补齐上面标红项'),
  );
  return ready ? 0 : 2;
}

function runInstallShortcut(opts: InstallOptions): number {
  if (process.platform !== 'win32') {
    console.error(chalk.red('❌ install-shortcut 仅支持 Windows(桌面快捷方式为 .lnk)'));
    return 2;
  }
  const root = requireRepo(opts.repo);
  if (!root) return 2;
  const powershell = resolvePowerShell();
  if (!powershell) {
    console.error(chalk.red('❌ 未找到 PowerShell(pwsh / powershell)'));
    return 2;
  }
  const installer = path.join(root, INSTALLER_REL);
  if (!fs.existsSync(installer)) {
    console.error(chalk.red(`❌ 安装器缺失: ${installer}`));
    return 2;
  }

  const args = ['-NoProfile', '-File', installer];
  if (opts.desktop) args.push('-Desktop', path.resolve(opts.desktop));
  if (opts.skipOld) args.push('-SkipOld');
  if (opts.whatIf) args.push('-WhatIf');

  const result = runCaptured(powershell, args, root);
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const ok = result.error === null && result.status === 0;

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok,
          exitCode: result.error ? 2 : result.status,
          error: result.error,
          installer,
          desktop: opts.desktop ?? null,
          whatIf: Boolean(opts.whatIf),
        },
        null,
        2,
      )}\n`,
    );
  } else if (ok) {
    console.error(chalk.green('✅ 桌面快捷方式已创建(双击「AI 客户端一键切号」即可使用)'));
  } else {
    console.error(chalk.red(`❌ 安装器失败(exit=${result.status}),上方为 PowerShell 输出`));
  }
  return result.error ? 2 : result.status;
}

function runList(opts: ListOptions): number {
  const root = requireRepo(opts.repo);
  if (!root) return 2;
  const node = requireNode();
  if (!node) return 2;

  const args = [path.join(root, SWITCH_ENTRY_REL)];
  if (opts.counts) {
    // 被派发脚本的 --counts 必须与 --list 同用(其 USAGE 与 parseArgs 都这么判);
    // 少给 --list 会被它按「必须给 --list / --current / --to 之一」拦成 exit 2。
    args.push('--list', '--counts');
  } else {
    args.push('--list');
    if (opts.provider) args.push('--provider', opts.provider);
    if (opts.withQuota) args.push('--with-quota');
  }
  if (opts.json) args.push('--json');

  return opts.json ? runJsonOnly(node, args, root) : runStreamed(node, args, root);
}

function runSwitch(opts: SwitchOptions): number {
  const root = requireRepo(opts.repo);
  if (!root) return 2;
  const node = requireNode();
  if (!node) return 2;

  const args = [
    path.join(root, SWITCH_ENTRY_REL),
    '--to',
    opts.to,
    '--provider',
    opts.provider,
  ];
  if (opts.dryRun) args.push('--dry-run');
  if (opts.force) args.push('--force');
  if (opts.noLaunch) args.push('--no-launch');
  if (opts.json) args.push('--json');

  // --json 也必须收口:切号腿会把 [db] 建连日志直接打到 stdout(实测),
  // 不收口的话消费方拿到的是「日志 + 多行 JSON」,JSON.parse 直接失败。
  return opts.json ? runJsonOnly(node, args, root) : runStreamed(node, args, root);
}

/**
 * 注册 `ihui relay` 子命令组。
 *
 * 命令面刻意与被派发脚本一一对应(不做二次抽象):任何一个旗标本层都不「翻译」,
 * 原样透传,语义与 scripts/switch-client-account.mjs 的 --help 完全一致。
 */
export function registerRelayCommand(program: Command): void {
  /**
   * `--json` 在 index.ts 的根程序上已有全局定义(机器可读总闸),子命令再声明同名旗标会被
   * 根解析器先吃掉,导致本地 opts.json 恒 false。这里统一取「本地或全局任一开启即算」,
   * 既保留 `ihui relay list --help` 的可发现性,又不与既有全局语义打架。
   */
  const wantsJson = (local?: { json?: boolean }): boolean =>
    Boolean(local?.json) || Boolean((program.opts() as { json?: boolean }).json);

  const relay = program
    .command('relay')
    .description('号池切号与桌面快捷方式(本机运维;需要 IHUI-AI 仓库)');

  relay
    .command('status')
    .description('检查仓库 / Node / tsx / PowerShell 前置是否就绪')
    .option('--repo <path>', '显式指定 IHUI-AI 仓库根(默认自动探测)')
    .option('--json', '以 JSON 输出(机器可读)')
    .action((opts: StatusOptions) => {
      process.exitCode = runStatus({ ...opts, json: wantsJson(opts) });
    });

  relay
    .command('install-shortcut')
    .description('在桌面创建「AI 客户端一键切号」快捷方式(Windows)')
    .option('--repo <path>', '显式指定 IHUI-AI 仓库根(默认自动探测)')
    .option('--desktop <dir>', '覆盖桌面目录(默认取系统真实桌面)')
    .option('--skip-old', '不创建旧版「WorkBuddy 一键切号」快捷方式')
    .option('--what-if', '只打印将创建的快捷方式,不落盘')
    .option('--json', '以 JSON 输出(机器可读)')
    .action((opts: InstallOptions) => {
      process.exitCode = runInstallShortcut({ ...opts, json: wantsJson(opts) });
    });

  relay
    .command('list')
    .description('列出号池账号(转 scripts/switch-client-account.mjs --list)')
    .option('--repo <path>', '显式指定 IHUI-AI 仓库根(默认自动探测)')
    .option('--counts', '列全池逐平台枚数概览(与 --provider 互斥)')
    .option('--provider <平台>', '平台名(trae/qoder/minimax/codex/zcode/opencode/workbuddy/codearts/loomy/doubao)')
    .option('--with-quota', '逐号实时查余额(与 --counts 互斥)')
    .option('--json', '以 JSON 输出(机器可读)')
    .action((opts: ListOptions) => {
      process.exitCode = runList({ ...opts, json: wantsJson(opts) });
    });

  relay
    .command('switch')
    .description('把号池里的号写回本机客户端(转 scripts/switch-client-account.mjs --to)')
    .option('--repo <path>', '显式指定 IHUI-AI 仓库根(默认自动探测)')
    .requiredOption('--provider <平台>', '平台名(trae/qoder/minimax/codex/zcode/opencode/workbuddy/codearts/loomy/doubao)')
    .requiredOption('--to <uid|名称>', '目标账号 uid(Trae 系支持名称匹配)')
    .option('--dry-run', '只打印计划,不写任何本机文件')
    .option('--force', 'Trae 在跑时按 pid 代关后再写(仅 Trae 系)')
    .option('--no-launch', '写完后不拉起客户端(仅 Trae 系)')
    .option('--json', '以 JSON 输出(机器可读)')
    .action((opts: SwitchOptions) => {
      process.exitCode = runSwitch({ ...opts, json: wantsJson(opts) });
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
