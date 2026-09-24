// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具产物落盘 —— 超限结果写进**项目内**的会话产物目录,换回一个可再读的路径。
 *
 * 三条硬约束(逐条对应仓库既有规则):
 *   1. **禁止 `os.tmpdir()`**(AGENTS.md §15b):任何产物都不得落在项目文件夹之外,
 *      否则换机/清临时目录后信封里的路径就是死链,而且污染他人磁盘。
 *   2. **落点必须在 `.ihui-agent/` 下**:`.gitignore` 第 145 行整目录忽略,产物不会
 *      进 `git status`(否则每次跑 agent 都会留下上百个未跟踪文件)。
 *   3. **会话恢复时找得到**:目录按 `sessionId` 分片,文件名含内容哈希 ——
 *      同一份输出重复产生时路径一致(幂等),不同会话互不覆盖。
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** 会话产物目录相对工作区根的段名 */
const ARTIFACT_ROOT_SEGMENTS = ['.ihui-agent', 'tmp', 'tool-artifacts'];

/** 一次落盘的结果 */
export interface ArtifactWrite {
  /** 相对工作区根的路径(回灌给模型用这个 —— read_file 认相对路径,且不泄露本机盘符) */
  relativePath: string;
  /** 绝对路径(内部核验用) */
  absolutePath: string;
  /** 写入的字符数 */
  chars: number;
  /** 内容 sha1 前 8 位(幂等键) */
  contentHash: string;
  /** 是否本次新写入(false = 命中同名已有文件,未重复写) */
  created: boolean;
}

/** 把 sessionId 收敛成安全目录名(会话 id 可能是任意字符串/含路径分隔符) */
export function sanitizeSessionSegment(sessionId: string | undefined): string {
  const raw = (sessionId ?? 'default').trim() || 'default';
  const safe = raw.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  return safe.length > 0 ? safe : 'default';
}

/** 会话产物目录绝对路径(不落盘,纯计算;调用方可据此做归属校验) */
export function toolArtifactDir(workspacePath: string, sessionId?: string): string {
  return path.join(workspacePath, ...ARTIFACT_ROOT_SEGMENTS, sanitizeSessionSegment(sessionId));
}

/** 产物根目录(所有会话共用的一层,用于归属核验) */
export function toolArtifactRoot(workspacePath: string): string {
  return path.resolve(workspacePath, ...ARTIFACT_ROOT_SEGMENTS);
}

/**
 * 该路径是否落在本工作区的产物根之内。
 * 用于反向核验:信封里的路径若指向工作区外,恢复时应判为不可用而不是照读。
 */
export function isInsideToolArtifactDir(workspacePath: string, targetPath: string): boolean {
  const root = toolArtifactRoot(workspacePath);
  const abs = path.resolve(workspacePath, targetPath);
  return abs === root || abs.startsWith(root + path.sep);
}

/**
 * 写入一份超限输出,返回可回灌给模型的路径引用。
 *
 * 幂等:文件名含内容哈希,同内容重复写不会产生第二份文件(也不会重复占盘),
 * 因此"工具被重试 / 结果被重放"都不会让产物目录无限膨胀。
 * 失败处理:磁盘不可写时抛错,**不静默降级为"整段进上下文"** ——
 * 那正是本模块要防的事故形态,让上层显式看到落盘失败比悄悄撑爆窗口好。
 */
export function writeToolArtifact(opts: {
  workspacePath: string;
  sessionId?: string;
  toolName: string;
  content: string;
}): ArtifactWrite {
  const dir = toolArtifactDir(opts.workspacePath, opts.sessionId);
  const contentHash = createHash('sha1').update(opts.content, 'utf8').digest('hex').slice(0, 8);
  const toolSeg = (opts.toolName || 'tool').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
  const fileName = `${toolSeg}-${contentHash}.txt`;
  const absolutePath = path.join(dir, fileName);
  const relativePath = path.posix.join(...ARTIFACT_ROOT_SEGMENTS, sanitizeSessionSegment(opts.sessionId), fileName);

  const alreadyExists = fs.existsSync(absolutePath);
  if (!alreadyExists) {
    fs.mkdirSync(dir, { recursive: true });
    // 尾部补一个换行:many editors / read_file 的行号渲染对无尾换行文件不友好
    fs.writeFileSync(absolutePath, opts.content.endsWith('\n') ? opts.content : `${opts.content}\n`, 'utf8');
  }

  return {
    relativePath,
    absolutePath,
    chars: opts.content.length,
    contentHash,
    created: !alreadyExists,
  };
}

/**
 * 从产物路径读回正文(会话恢复 / 分块读用)。
 * 不做"必须落在产物目录内"的强制校验:调用方(agent 侧)已只把产物目录里的路径写进信封,
 * 这里越校验越容易因 Windows 路径分隔符差异误杀;但会如实返回不存在/读失败。
 */
export function readToolArtifact(workspacePath: string, relativePath: string): { ok: true; content: string } | { ok: false; error: string } {
  const abs = path.resolve(workspacePath, relativePath);
  if (!fs.existsSync(abs)) return { ok: false, error: `产物文件不存在: ${relativePath}` };
  try {
    return { ok: true, content: fs.readFileSync(abs, 'utf8') };
  } catch (err) {
    return { ok: false, error: `产物文件读取失败: ${err instanceof Error ? err.message : String(err)}` };
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
