// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Crash handler — 全局未捕获异常处理,记录 crash log + 友好提示。
 *
 * 灵感来源:参考行业 Agent 框架的 crash reporter(捕获 panic + 写 minidump)。
 * 简化策略(做减法,零依赖):
 *   - 注册 process.on('uncaughtException') + process.on('unhandledRejection')
 *     + process.on('uncaughtExceptionMonitor')(归因通道,Node 在投递 uncaughtException
 *     **之前**先同步触发它 —— 全链路最早的观测点)
 *   - 一次故障只产一条结论:按错误对象身份去重(latch,见 reportedErrors 注释),
 *     同一错误双路触发只落一份文件,Kind 记录最先到达的通道,三态留档
 *     uncaughtException / unhandledRejection / monitor
 *   - 崩溃时写 crash log 到 ~/.ihui/crash-logs/crash-<毫秒时间戳+随机数字段>.log
 *     (旧形态 crash-<纯毫秒>.log 同毫秒会互相原地覆盖,见 crashLogFilename 注释)
 *   - crash log 含:时间戳、版本、平台、Node 版本、错误堆栈、cwd、argv
 *   - 自动清理超过 10 个的旧 crash log(保留最近 10 个)
 *   - 友好提示:报告 issue + 查看 crash log 路径;打印自身包在 try 内 ——
 *     EPIPE 等二次击穿时降级为"文件即结论",处理器内部绝不向外再抛
 *   - uncaughtException:打印后退出码 1(Node 默认行为;即使该路被去重,退出码仍生效)
 *   - unhandledRejection:打印警告但不退出(避免 Promise 链中 bug 导致整个 CLI 崩溃)
 *
 * 安全:
 *   - crash log 不主动写入用户敏感数据(但错误堆栈可能含 args,默认接受)
 *   - 路径使用 os.homedir() 不依赖 cwd
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
// 随机段唯一熵源(G-610 修复②):randomUUID 的十六进制片段转十进制,保证文件名仍是
// "crash- + 纯数字 + .log" 的既有形态(现读 ~/.ihui/crash-logs 存量与既有回归断言
// /crash-\d+\.log$/ 都按这个形状识别),绝不引入端内第二套自拼随机数。
import { randomUUID } from 'node:crypto';
import chalk from 'chalk';
// 唯一出口 serializeError(2026-09-26 立):旧的手写归一只保 name/message/stack,
// cause 链整条丢失;且非 Error 输入落 'Unknown',与其他接入面的 'NonThrownError'
// 不一致。出口函数自带深度封顶 + 循环 cause 检测,且在任何输入下不抛 —— 崩溃
// 恢复路径上二次抛错等于把事故升级成事故×2。
import { serializeError, type SerializedError } from '@ihui/types';

const CRASH_LOG_DIR = path.join(os.homedir(), '.ihui', 'crash-logs');
const MAX_CRASH_LOGS = 10;
/** 撞名防线的有界重试上限:随机段已把同毫秒同名压到 ~2^-48,残余概率用重试兜底,绝不无界循环 */
const MAX_FILENAME_ATTEMPTS = 5;
/** 随机段取 UUID 去连字符后的前 12 个十六进制位(≈48bit 熵),转十进制仍是纯数字 */
const RANDOM_HEX_CHARS = 12;

/**
 * 归因来源三态(G-610 修复①):"这条错误是从哪一路进来的"的稳定标识。
 * 旧实现只有 uncaughtException / unhandledRejection 两值,且 uncaughtExceptionMonitor
 * 全仓命中 0 —— 没有来源标记时,重复抑制只能靠时间戳猜(而时间戳正是缺陷本身)。
 */
export type CrashSource = 'uncaughtException' | 'unhandledRejection' | 'monitor';

let installed = false;

/**
 * 一次故障只产一条结论的 latch(2026-09-29 G-610 立)。判据取**错误对象身份**(WeakSet):
 * - 同一 Promise 的错误先以 uncaughtException、紧接着以 unhandledRejection 投递(同一对象、
 *   同一毫秒)时,旧实现无 latch,两份 writeFileSync 以毫秒文件名原地互覆,留下的那份 Kind
 *   随调度顺序变 —— "报了两次"在账面上表现为"一次都没报全"。上游对此有明文:同一错误被
 *   更早到达的通道报过之后,后来的通道故意不再报第二遍,避免同一 Promise 错误生成两个不同
 *   结论。现在先达者落盘并打印,后达者只补该通道自己的退出码语义,不再产第二条结论。
 * - 刻意不用 (name,message,stack) 指纹去重:指纹会把"两个不同故障恰好同文案"也吞掉
 *   (测试口径②要求不同错误必产 2 份)。
 * - 原始值(string / undefined / number 等 throw 非对象)没有身份可比 ⇒ 一律照报。
 *   失效方向按票面约束:多喊一次可以,静默不行。
 */
let reportedErrors = new WeakSet<object>();

export interface CrashInfo {
  timestamp: string;
  timestampMs: number;
  kind: CrashSource;
  error: SerializedError;
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

/**
 * 把 SerializedError 摊平成 crash 报告 "## Error" 段的行(含 cause 链与截断标注)。
 * 纯函数,只读我方出口自己产出的闭集结构,不抛。导出供测试直接断言。
 */
export function flattenErrorForReport(error: SerializedError): string[] {
  const lines: string[] = [`Name: ${error.name}`, `Message: ${error.message}`];
  const truncatedMark = 'Caused by: [truncated: deeper cause omitted]';
  let node: SerializedError | undefined = error.cause;
  while (node) {
    lines.push(`Caused by: ${node.name}: ${node.message}`);
    if (node.truncated) {
      lines.push(truncatedMark);
      break;
    }
    node = node.cause;
  }
  // 根节点自己带 truncated(循环 cause 指回根,或链在根处即封顶)
  if (error.truncated && !lines.includes(truncatedMark)) {
    lines.push(truncatedMark);
  }
  return lines;
}

/**
 * 生成 crash 日志文件名(G-610 修复②)。旧形态 `crash-<纯毫秒>.log` 以时间戳单键 ⇒
 * 同毫秒两次不同故障落到同一个名字,后一份把前一份原地覆盖掉。补随机段,但**必须保持
 * "crash- + 十进制数字 + .log" 的既有形态** —— 先读过现网日志目录(~/.ihui/crash-logs
 * 存量全是 13 位毫秒形态)与既有消费方(prune 的 crash-*.log 过滤、既有回归断言
 * /crash-\d+\.log$/):加连字符段或十六进制字母会让这些消费方对新产品失明。
 * 时间戳仍是前缀 ⇒ 按名排序/可发现性不变;随机段取 randomUUID 前 12 个十六进制位转
 * 十进制(≈48bit 熵)。
 */
function crashLogFilename(timestampMs: number): string {
  const hex = randomUUID()
    .replace(/-/g, '')
    .slice(0, RANDOM_HEX_CHARS);
  return `crash-${String(timestampMs)}${parseInt(hex, 16)}.log`;
}

/** 写 crash log 到磁盘,返回文件路径(失败返回 null;本函数在任何输入下不抛) */
function writeCrashLog(info: CrashInfo): string | null {
  try {
    if (!fs.existsSync(CRASH_LOG_DIR)) {
      fs.mkdirSync(CRASH_LOG_DIR, { recursive: true });
    }
    // "不得把目录里别人的旧文件当自己的目标":每次落盘前先验同名(旧文件是纯 13 位
    // 毫秒形态,新名毫秒后还带随机数字段,形状上已不同名;残余碰撞概率走有界重试)。
    // 重试穷尽仍同名才写最后一枚候选名 —— 不拒绝写盘,因为"落不了也不二次抛、但必须
    // 留一份结论"是本票对失效方向的总约束(多喊一次可以,静默不行)。
    let filepath = path.join(CRASH_LOG_DIR, crashLogFilename(info.timestampMs));
    for (let attempt = 0; attempt < MAX_FILENAME_ATTEMPTS && fs.existsSync(filepath); attempt += 1) {
      filepath = path.join(CRASH_LOG_DIR, crashLogFilename(info.timestampMs));
    }
    const lines = [
      `=== IHUI CLI Crash Report ===`,
      `Time: ${info.timestamp}`,
      `Kind: ${info.kind}`,
      `Version: ${info.version}`,
      ``,
      `## Error`,
      ...flattenErrorForReport(info.error),
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

/** 错误身份提取:非对象 throw 值返回 null(无身份可比 ⇒ 不参与去重,见 reportedErrors 注释) */
function identityKeyOf(err: unknown): object | null {
  return (typeof err === 'object' && err !== null) || typeof err === 'function' ? err : null;
}

/**
 * 用户可见打印(与旧版逐字同文案)。整段包在 try 内(G-610 修复③):旧版这段不在
 * try 里,stdout/stderr 被关(EPIPE、管道对端已退)时 console.error 在 process 事件
 * 监听器内部再抛 ⇒ 处理器自身击穿边界,用户什么也看不到、进程状态未定。
 * 此刻 crash log 已先落盘,打印只是复述文件里的结论;复述失败不得再制造一条新故障,
 * 所以 catch 刻意静默(stderr 正是坏掉的那条通道,再写一次只有二次抛错风险)。
 */
function reportToStderr(error: SerializedError, logPath: string | null, source: CrashSource): void {
  try {
    // monitor 通道投递的同样是未捕获异常(Node 在真正抛给 uncaughtException 之前先触发
    // monitor),用户可见文案维持"未捕获异常",不借修复新增第三种提示。
    const label = source === 'unhandledRejection' ? '未处理的 Promise rejection' : '未捕获异常';
    console.error('');
    console.error(chalk.red(`✗ IHUI CLI ${label}`));
    console.error(chalk.red(`  ${error.name}: ${error.message}`));
    if (logPath) {
      console.error(chalk.dim(`  Crash log: ${logPath}`));
    }
    console.error(chalk.dim(`  请在 GitHub issue 附上 crash log 内容以便排查。`));
    console.error('');
  } catch {
    // 见函数头注:能落盘就落盘(已落),落不了也不二次抛。
  }
}

/**
 * 处理一个未捕获错误:一次故障只产一条结论(latch) + 写 log + 打印。
 * 导出是测试口径要求的"生产入口"之一(另一入口是 process.emit 派发真实监听器);
 * 测试内不得再写第二份 latch/去重逻辑。monitor 时序(Node 先 monitor 后
 * uncaughtException)在测试里用 process.emit('uncaughtExceptionMonitor', …) 复现。
 */
export function handleCrash(source: CrashSource, err: unknown): void {
  const identity = identityKeyOf(err);
  if (identity && reportedErrors.has(identity)) {
    // 同一错误对象已由更早到达的通道落盘并打印:不再产第二条结论(不写文件、不再打印)。
    // 但 uncaughtException 的退出码语义不属于"结论" —— 即使该路被去重也必须生效:
    // 真实异常经 monitor 先报后,仍要把 process.exitCode 钉成 1(与改动前逐字同语义)。
    if (source === 'uncaughtException') {
      process.exitCode = 1;
    }
    return;
  }
  if (identity) {
    reportedErrors.add(identity);
  }

  const error = serializeError(err);

  const now = Date.now();
  const info: CrashInfo = {
    timestamp: new Date(now).toISOString(),
    timestampMs: now,
    kind: source,
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

  // 顺序即结论:先落盘(唯一真相),再尝试复述给用户。写盘失败(writeCrashLog 自带
  // try,返回 null)时仍走打印,与旧版行为一致。
  const logPath = writeCrashLog(info);
  pruneOldCrashLogs();
  reportToStderr(error, logPath, source);

  // uncaughtException:让 Node 默认退出行为生效(打印后退出码 1)
  // unhandledRejection / monitor:不强制退出 —— monitor 之后 Node 仍会把该异常投递给
  // uncaughtException 监听器,退出码在那一路统一落定,这里重复设置反而模糊归因。
  if (source === 'uncaughtException') {
    process.exitCode = 1;
  }
}

/** 安装全局 crash handler(只能安装一次,重复调用幂等) */
export function installCrashHandler(): void {
  if (installed) return;
  installed = true;
  process.on('uncaughtException', (err) => handleCrash('uncaughtException', err));
  process.on('unhandledRejection', (err) => handleCrash('unhandledRejection', err));
  // 归因通道(G-610 修复①):Node 在投递 uncaughtException **之前**同步先触发 monitor,
  // 是全链路最早的观测点。在这里先把结论落盘,后续投递即使被 EPIPE / 第三方监听器抢先
  // exit 击穿,crash log 也已经在磁盘上;"Kind: monitor" 即这条错误的来源留档。
  process.on('uncaughtExceptionMonitor', (err) => handleCrash('monitor', err));
}

/** 卸载 crash handler(主要用于测试) */
export function uninstallCrashHandler(): void {
  if (!installed) return;
  installed = false;
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtExceptionMonitor');
  // latch 随卸载复位:丢弃"已报过"的记忆,避免跨安装周期把下一段生命周期的故障误吞。
  reportedErrors = new WeakSet<object>();
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
