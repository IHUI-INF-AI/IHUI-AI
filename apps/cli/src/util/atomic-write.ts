// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区文件写盘的唯一出口 —— 原子替换 + 读后写校验(stale 写拒绝)。
 *
 * 为什么放在 `apps/cli/src/util/`(而不是任务书建议的 `scripts/lib/atomic-write.mjs`):
 * 本模块是 **CLI 运行时代码**,`apps/cli/tsconfig.json` 写死 `rootDir: "src"` ——
 * 从 src 里 import 仓库工具层会直接 TS6059 编译失败,而 `package.json` 的 `files: ["dist","src"]`
 * 也说明发布出去的包里根本没有 `scripts/`。运行时依赖工具层同时会撞架构契约门的依赖方向判据。
 * 结论:实现放端内 util,守门(`scripts/check-file-write-safety.mjs`)只静态对账它的存在与接线。
 *
 * 三格坏状态与对应判据(全部由 `apps/cli/tests/file-edit-atomic-write.test.ts` 钉住):
 *   ① 裸 `writeFileSync` 非原子 —— 实测 2.5s 并发读写里 5,095 次读有 4,646 次看到"既不是旧版
 *      也不是新版"的内容(含 len=0 的全空读),半截文件是我们仓的真实形态。
 *      ⇒ 同目录临时文件 + `renameSync` 原子替换;Windows 实测「目标已被别的句柄占用」时 rename
 *        抛 **EPERM**(不是 EEXIST),故必须带重试,且失败路径要清掉遗留 tmp。
 *   ② 读到 A、落盘 B,而别人在这期间已改成 C ⇒ 静默覆盖,双方都报成功。
 *      ⇒ 落盘前重读磁盘并与**捕获基线逐字节**比对,不一致即 `write_conflict` 拒绝。
 *        刻意比内容而不是比 mtime:外部只是"用相同内容重写一遍"(formatter / git checkout /
 *        打包往返)是正当形态,比 mtime 会把它判成冲突 = 纯误报。
 *   ③ 绝不跟随符号链接写。实测本机可建文件符号链接,而 `writeFileSync` **会穿透链接写进真身**
 *      (链接指向的文件内容被改掉)。目录级 junction 是 §26 刻意的改道机制,跟进是正确语义,
 *      所以本模块只拒绝「最终路径分量本身是重解析点」这一型。
 *
 * 已知残余(如实登记,不等于已解决):比对与 rename 之间仍有毫秒级窗口 —— 真正无锁需要目录级
 * CAS(`O_EXCL` 锁文件或硬链接),那要求改 `ToolContext`,在本票清单外。本模块把窗口从
 * "整个 patch 计算期"缩到"一次重读 + 一次 rename 之间",并把覆盖从**静默**变成**必然报错**。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** 同一进程内的 tmp 序号(与 pid 拼起来保证并发写入不撞同一个 tmp 名) */
let tmpSeq = 0;

/** rename 撞 Windows EPERM 时的重试退避(毫秒);总等待上限 ≈ 315ms,远小于一次工具调用的预算 */
const RENAME_BACKOFF_MS = [5, 10, 20, 40, 60, 80, 95] as const;

/** rename 在 Windows 上"目标被占用"的可重试错误码(实测 EPERM;EBUSY/EACCES 同族) */
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** 捕获到的磁盘基线:落盘前必须仍然成立,否则拒绝写。 */
export interface WriteBaseline {
  readonly absPath: string;
  /** 捕获时该路径的内容;捕获时不存在 ⇒ null(此后必须仍然不存在,被人建了也算冲突) */
  readonly content: string | null;
}

/** 冲突的具体形态 —— 写进错误文案,让模型知道下一步该做什么。 */
export type WriteConflictKind = 'modified' | 'created' | 'deleted';

export class WriteConflictError extends Error {
  readonly code = 'write_conflict';
  readonly kind: WriteConflictKind;
  readonly absPath: string;

  constructor(kind: WriteConflictKind, absPath: string, expected: string | null, actual: string | null) {
    const detail =
      kind === 'created'
        ? '捕获时该文件不存在,但现在磁盘上已经有了(别的进程/会话刚创建了它)'
        : kind === 'deleted'
          ? '捕获时该文件存在,但现在已被删除(别的进程/会话删掉了它)'
          : `捕获后磁盘内容已被改动:捕获 ${expected === null ? 'n/a' : `${expected.length} 字节`} → 当前 ${actual === null ? 'n/a' : `${actual.length} 字节`}`;
    super(`写入冲突:${absPath} ${detail}。请先重新读取该文件,再基于最新内容重发这次编辑。`);
    this.name = 'WriteConflictError';
    this.kind = kind;
    this.absPath = absPath;
  }
}

/** 目标本身是符号链接/重解析点 ⇒ 拒绝(绝不穿透链接去改链接指向的内容)。 */
export class SymlinkTargetError extends Error {
  readonly code = 'symlink_target';
  readonly absPath: string;
  readonly target: string;

  constructor(absPath: string, target: string) {
    super(
      `拒绝写入符号链接:${absPath} 是指向 ${target} 的重解析点。` +
        '本工具的写盘刻意不跟随链接(穿透会把链接指向的真实文件改掉却报告写的是链接)。' +
        '确实要改那个内容,请直接用它的真实路径。',
    );
    this.name = 'SymlinkTargetError';
    this.absPath = absPath;
    this.target = target;
  }
}

/** tmp 已经写出但 rename 反复失败(句柄长期被占用等)—— 附带已重试次数。 */
export class AtomicReplaceFailedError extends Error {
  readonly code = 'atomic_replace_failed';
  readonly absPath: string;
  readonly attempts: number;

  constructor(absPath: string, attempts: number, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`原子替换失败(已重试 ${attempts} 次):${reason}`);
    this.name = 'AtomicReplaceFailedError';
    this.absPath = absPath;
    this.attempts = attempts;
  }
}

function errCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/** 同步退避:本模块的调用方(handler)本就是同步落盘,不引入 async 以免改签名扩散。 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * 「这条路径是不是一个我们要拒绝的链接」—— 只看最终分量本身。
 * 目录级 junction(§26 的改道机制)不在射程内:那是我们**故意**让写入落到 D 盘的通道。
 */
function assertNotReparsePoint(absPath: string): void {
  let st: fs.Stats;
  try {
    st = fs.lstatSync(absPath);
  } catch (e) {
    if (errCode(e) === 'ENOENT') return; // 还不存在 = 无链接可穿
    throw e;
  }
  if (st.isSymbolicLink()) {
    let real = '';
    try {
      real = fs.realpathSync(absPath);
    } catch {
      real = '(链接目标当前不可解析)';
    }
    throw new SymlinkTargetError(absPath, real);
  }
  if (st.isDirectory()) {
    throw new Error(`写入目标是一个目录,不是文件:${absPath}`);
  }
}

/** 读磁盘当前内容;不存在返回 null。与 captureWriteBaseline 同一份实现 ⇒ 两侧算法必相同。 */
function readOrNull(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, 'utf-8');
  } catch (e) {
    if (errCode(e) === 'ENOENT') return null;
    throw e;
  }
}

/**
 * 编辑/写入之前调用:拿到"我以为磁盘上是什么"。返回的基线必须原样交给 commitAtomicWrite。
 *
 * 为什么不提供一个"跳过校验"的出口:那样这一格就又变成"记不记得传参"的问题(本仓最高频失效型)。
 */
export function captureWriteBaseline(absPath: string): WriteBaseline {
  assertNotReparsePoint(absPath);
  return { absPath, content: readOrNull(absPath) };
}

/** 同目录 tmp 名:点前缀 + pid + 序号,并发写不互相覆盖,且不会跨卷(rename 会 EXDEV)。 */
function tmpPathFor(absPath: string): string {
  tmpSeq += 1;
  const dir = path.dirname(absPath);
  const base = path.basename(absPath);
  return path.join(dir, `.${base}.tmp-${process.pid}-${tmpSeq}`);
}

function removeQuietly(p: string): void {
  try {
    fs.rmSync(p, { force: true, maxRetries: 5, retryDelay: 50 });
  } catch {
    // 清 tmp 失败不改判据结论:主错误已在上游抛出
  }
}

/**
 * 原子写盘:① 重读磁盘并与基线逐字节比对(不一致 ⇒ WriteConflictError,磁盘原样不动);
 * ② 同目录 tmp + fsync;③ rename 替换,Windows EPERM 族错误带退避重试;④ 任何失败都不留 tmp、不截目标。
 */
export function commitAtomicWrite(baseline: WriteBaseline, content: string): void {
  const { absPath } = baseline;
  // 链接可能在捕获之后才出现(capture 与 commit 之间被人换了)⇒ 两侧都要判,同一份实现
  assertNotReparsePoint(absPath);
  const now = readOrNull(absPath);
  if (now !== baseline.content) {
    const kind: WriteConflictKind =
      baseline.content === null ? 'created' : now === null ? 'deleted' : 'modified';
    throw new WriteConflictError(kind, absPath, baseline.content, now);
  }

  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  // POSIX 下保住原文件权限位(rename 会把 tmp 的 0o644 带过去,可执行文件会被改坏)
  let mode: number | null = null;
  if (process.platform !== 'win32' && now !== null) {
    try {
      mode = fs.statSync(absPath).mode & 0o7777;
    } catch {
      mode = null;
    }
  }

  const tmp = tmpPathFor(absPath);
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmp, 'w');
    const written = fs.writeSync(fd, content, 0, 'utf-8');
    // 短写(partial write)本身就是"半截文件"的另一条路 —— 宁可失败也不让 rename 把它换上去
    if (written !== Buffer.byteLength(content, 'utf-8')) {
      throw new Error(`写入不完整:${absPath} 期望 ${Buffer.byteLength(content, 'utf-8')} 字节,实得 ${written} 字节`);
    }
    try {
      fs.fsyncSync(fd); // 数据先落盘,再让 rename 生效 —— 否则"原子"只保并发不保崩溃
    } catch {
      // 某些文件系统不支持 fsync:退化为依赖 rename 的原子性,不因此判失败
    }
    fs.closeSync(fd);
    fd = null;
    if (mode !== null) {
      try {
        fs.chmodSync(tmp, mode);
      } catch {
        // 权限位拿不到不影响写入正确性
      }
    }
    renameWithRetry(tmp, absPath);
  } catch (e) {
    removeQuietly(tmp);
    const code = errCode(e);
    if (code === undefined || !RETRYABLE_RENAME_CODES.has(code)) throw e;
    throw new AtomicReplaceFailedError(absPath, RENAME_BACKOFF_MS.length + 1, e);
  }
}

/** rename 到"已存在但被别的句柄打开"的目标:Windows 实测 EPERM,故短退避重试后仍失败才抛。 */
function renameWithRetry(tmp: string, absPath: string): void {
  let lastErr: unknown = null;
  for (let i = 0; i <= RENAME_BACKOFF_MS.length; i++) {
    try {
      fs.renameSync(tmp, absPath);
      return;
    } catch (e) {
      lastErr = e;
      const code = errCode(e);
      if (!code || !RETRYABLE_RENAME_CODES.has(code)) throw e;
      if (i < RENAME_BACKOFF_MS.length) sleepSync(RENAME_BACKOFF_MS[i] ?? 0);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`rename 失败:${absPath}`);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
