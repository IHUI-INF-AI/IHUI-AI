/**
 * Crash handler — 全局未捕获异常处理,记录 crash log + 友好提示。
 *
 * 灵感来源:cli 的 crash reporter(Rust,捕获 panic + 写 minidump)。
 * 简化策略(做减法,零依赖):
 *   - 注册 process.on('uncaughtException') + process.on('unhandledRejection')
 *   - 崩溃时写 crash log 到 ~/.ihui/crash-logs/crash-<timestamp>.log
 *   - crash log 含:时间戳、版本、平台、Node 版本、错误堆栈、cwd、argv
 *   - 自动清理超过 10 个的旧 crash log(保留最近 10 个)
 *   - 友好提示:报告 issue + 查看 crash log 路径
 *   - uncaughtException:打印后退出码 1(Node 默认行为)
 *   - unhandledRejection:打印警告但不退出(避免 Promise 链中 bug 导致整个 CLI 崩溃)
 *
 * 安全:
 *   - crash log 不主动写入用户敏感数据(但错误堆栈可能含 args,默认接受)
 *   - 路径使用 os.homedir() 不依赖 cwd
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import chalk from 'chalk';

const CRASH_LOG_DIR = path.join(os.homedir(), '.ihui', 'crash-logs');
const MAX_CRASH_LOGS = 10;

let installed = false;

interface CrashInfo {
  timestamp: string;
  timestampMs: number;
  kind: 'uncaughtException' | 'unhandledRejection';
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    pid: number;
    cwd: string;
    argv: string[];
  };
  version: string;
}

/** 读取当前 CLI 版本(从 dist 推断 package.json) */
function readCliVersion(): string {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return String(pkg.version ?? 'unknown');
  } catch {
    return 'unknown';
  }
}

/** 清理旧 crash log,保留最近 MAX_CRASH_LOGS 个 */
function pruneOldCrashLogs(): void {
  try {
    if (!fs.existsSync(CRASH_LOG_DIR)) return;
    const files = fs
      .readdirSync(CRASH_LOG_DIR)
      .filter((f) => f.startsWith('crash-') && f.endsWith('.log'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(CRASH_LOG_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const f of files.slice(MAX_CRASH_LOGS)) {
      try {
        fs.unlinkSync(path.join(CRASH_LOG_DIR, f.name));
      } catch {
        // 单个文件删除失败不影响
      }
    }
  } catch {
    // 清理失败不影响主流程
  }
}

/** 写 crash log 到磁盘,返回文件路径(失败返回 null) */
function writeCrashLog(info: CrashInfo): string | null {
  try {
    if (!fs.existsSync(CRASH_LOG_DIR)) {
      fs.mkdirSync(CRASH_LOG_DIR, { recursive: true });
    }
    const filename = `crash-${info.timestampMs}.log`;
    const filepath = path.join(CRASH_LOG_DIR, filename);
    const lines = [
      `=== IHUI CLI Crash Report ===`,
      `Time: ${info.timestamp}`,
      `Kind: ${info.kind}`,
      `Version: ${info.version}`,
      ``,
      `## Error`,
      `Name: ${info.error.name}`,
      `Message: ${info.error.message}`,
      `Stack:`,
      info.error.stack ?? '(no stack)',
      ``,
      `## Runtime`,
      `Node: ${info.runtime.nodeVersion}`,
      `Platform: ${info.runtime.platform} ${info.runtime.arch}`,
      `PID: ${info.runtime.pid}`,
      `cwd: ${info.runtime.cwd}`,
      `argv: ${info.runtime.argv.join(' ')}`,
      ``,
      `=== End of report ===`,
    ];
    fs.writeFileSync(filepath, lines.join('\n'), 'utf-8');
    return filepath;
  } catch {
    return null;
  }
}

/** 处理一个未捕获错误:打印 + 写 log */
function handleCrash(kind: 'uncaughtException' | 'unhandledRejection', err: unknown): void {
  const error = err instanceof Error
    ? { name: err.name, message: err.message, stack: err.stack }
    : { name: 'Unknown', message: String(err), stack: undefined };

  const now = Date.now();
  const info: CrashInfo = {
    timestamp: new Date(now).toISOString(),
    timestampMs: now,
    kind,
    error,
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      cwd: process.cwd(),
      argv: process.argv,
    },
    version: readCliVersion(),
  };

  const logPath = writeCrashLog(info);
  pruneOldCrashLogs();

  const label = kind === 'uncaughtException' ? '未捕获异常' : '未处理的 Promise rejection';
  console.error('');
  console.error(chalk.red(`✗ IHUI CLI ${label}`));
  console.error(chalk.red(`  ${error.name}: ${error.message}`));
  if (logPath) {
    console.error(chalk.dim(`  Crash log: ${logPath}`));
  }
  console.error(chalk.dim(`  请在 GitHub issue 附上 crash log 内容以便排查。`));
  console.error('');

  // uncaughtException:让 Node 默认退出行为生效(打印后退出码 1)
  // unhandledRejection:不强制退出,避免 Promise 链中 bug 导致整个 CLI 崩溃
  if (kind === 'uncaughtException') {
    process.exitCode = 1;
  }
}

/** 安装全局 crash handler(只能安装一次,重复调用幂等) */
export function installCrashHandler(): void {
  if (installed) return;
  installed = true;
  process.on('uncaughtException', (err) => handleCrash('uncaughtException', err));
  process.on('unhandledRejection', (err) => handleCrash('unhandledRejection', err));
}

/** 卸载 crash handler(主要用于测试) */
export function uninstallCrashHandler(): void {
  if (!installed) return;
  installed = false;
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');
}
