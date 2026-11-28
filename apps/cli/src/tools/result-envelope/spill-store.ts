// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落盘接缝(W4-12)—— 只负责“存一份文本并给出可寻址引用”,不决定何时存、存完换成什么。
 *
 * 与 `artifact-store.ts` 的分工:
 *   - `artifact-store` 是**文件实现**:路径收敛、幂等命名、工作区内落点;
 *   - 本模块是**接口 + 默认文件实现**:`saveText` 返回带 sha256/bytes/expiresAt 的 `SpillRef`,
 *     `stat/read` 先验过期与归属,读回再验摘要,摘要不符不当成“同一份”。
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  isInsideToolArtifactDir,
  readToolArtifact,
  toolArtifactDir,
  writeToolArtifact,
} from './artifact-store.js';

export interface SpillRef {
  /** 内容寻址 id:`sha256:<hex>` */
  id: string;
  /** 项目内相对路径(模型侧可读) */
  locator: string;
  sha256: string;
  /** 落盘字节数(含实现补的尾换行) */
  bytes: number;
  /** 原文字符数 */
  chars: number;
  createdAt: number;
  /** 到期时间(epoch ms);缺省表示不设 TTL */
  expiresAt?: number;
}

/** 生产信封默认保留期:24h;由 envelopeToolResult 的调用方显式传入,不偷偷作用于裸 FileSpillStore。 */
export const DEFAULT_SPILL_TTL_MS = 24 * 60 * 60_000
/** 单个会话产物目录的全局字节上限:64MiB;TTL 之外的兜底,防止大批小结果绕过时间窗。 */
export const DEFAULT_SPILL_TOTAL_BYTES = 64 * 1024 * 1024

export interface SpillSaveInput {
  text: string;
  toolName: string;
  now?: number;
  expiresAt?: number;
}

export interface SpillStat {
  exists: boolean;
  expired: boolean;
  bytes?: number;
}

export type SpillReadResult =
  | { ok: true; text: string; ref: SpillRef }
  | { ok: false; code: 'not-found' | 'expired' | 'invalid-ref' | 'hash-mismatch' | 'io'; error: string };

export interface SpillStore {
  saveText(input: SpillSaveInput): SpillRef;
  stat(ref: SpillRef): SpillStat;
  read(ref: SpillRef): SpillReadResult;
}

export interface FileSpillStoreOptions {
  workspacePath: string;
  sessionId?: string;
  /** 默认 Date.now;测试可注入 */
  now?: () => number;
  /** 保存时统一套用的 TTL;`saveText.expiresAt` 优先 */
  ttlMs?: number;
  /** 会话产物目录全局字节上限;默认 64MiB */
  maxTotalBytes?: number;
}

export function isSpillRefExpired(ref: Pick<SpillRef, 'expiresAt'>, now: number): boolean {
  return typeof ref.expiresAt === 'number' && now >= ref.expiresAt;
}

/**
 * 产物目录回收：先按文件 mtime 删过期产物，再按全局字节上限从最旧删到配额内。
 * 不读取正文；只删产物目录里的普通文件。读路径不删（避免回读时产生副作用），
 * 由保存/扫描的写路径统一执行。
 */
export function cleanupSpillDirectory(
  workspacePath: string,
  sessionId: string | undefined,
  now = Date.now(),
  ttlMs = DEFAULT_SPILL_TTL_MS,
  maxTotalBytes = DEFAULT_SPILL_TOTAL_BYTES,
): { scanned: number; removed: number; bytesAfter: number } {
  const dir = spillDirectory(workspacePath, sessionId)
  let scanned = 0
  let removed = 0
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return { scanned: 0, removed: 0, bytesAfter: 0 }
  }
  const survivors: Array<{ path: string; bytes: number; mtimeMs: number }> = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    scanned += 1
    const target = path.join(dir, entry.name)
    try {
      const stat = fs.statSync(target)
      if (stat.mtimeMs + ttlMs <= now) {
        fs.unlinkSync(target)
        removed += 1
      } else {
        survivors.push({ path: target, bytes: stat.size, mtimeMs: stat.mtimeMs })
      }
    } catch {
      // 单个产物删不掉不阻塞下一次落盘。
    }
  }

  let totalBytes = survivors.reduce((sum, f) => sum + f.bytes, 0)
  if (totalBytes > maxTotalBytes) {
    // 最旧的先走；新落盘的产物 mtime 最新，不会在保存路径里被自己删掉。
    survivors.sort((a, b) => a.mtimeMs - b.mtimeMs)
    for (const file of survivors) {
      if (totalBytes <= maxTotalBytes) break
      try {
        fs.unlinkSync(file.path)
        removed += 1
        totalBytes -= file.bytes
      } catch {
        // 删不掉就继续尝试下一份，不让单个文件阻塞配额回收。
      }
    }
  }
  return { scanned, removed, bytesAfter: totalBytes }
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 默认文件实现:落点仍由 artifact-store 决定,本类只补摘要/字节/过期与读回校验。 */
export class FileSpillStore implements SpillStore {
  private readonly workspacePath: string;
  private readonly sessionId?: string;
  private readonly now: () => number;
  private readonly ttlMs?: number;
  private readonly maxTotalBytes: number;

  constructor(opts: FileSpillStoreOptions) {
    this.workspacePath = opts.workspacePath;
    this.sessionId = opts.sessionId;
    this.now = opts.now ?? Date.now;
    this.ttlMs = opts.ttlMs;
    this.maxTotalBytes = Math.max(1, opts.maxTotalBytes ?? DEFAULT_SPILL_TOTAL_BYTES);
  }

  saveText(input: SpillSaveInput): SpillRef {
    if (typeof input.text !== 'string') {
      throw new Error('spill-store: saveText.text 必须是字符串');
    }
    const digest = sha256(input.text);
    const artifact = writeToolArtifact({
      workspacePath: this.workspacePath,
      sessionId: this.sessionId,
      toolName: input.toolName,
      content: input.text,
    });
    const now = input.now ?? this.now();
    if (this.ttlMs !== undefined) {
      // 保存路径顺手扫一遍过期产物；读路径保持无副作用（读旧产物不应反删磁盘）。
      cleanupSpillDirectory(
        this.workspacePath,
        this.sessionId,
        now,
        this.ttlMs,
        this.maxTotalBytes,
      );
    }
    const expiresAt =
      input.expiresAt ?? (this.ttlMs === undefined ? undefined : now + this.ttlMs);
    return {
      id: `sha256:${digest}`,
      locator: artifact.relativePath,
      sha256: digest,
      bytes: Buffer.byteLength(input.text.endsWith('\n') ? input.text : `${input.text}\n`, 'utf8'),
      chars: input.text.length,
      createdAt: now,
      ...(expiresAt === undefined ? {} : { expiresAt }),
    };
  }

  stat(ref: SpillRef): SpillStat {
    if (isSpillRefExpired(ref, this.now())) return { exists: false, expired: true };
    const abs = this.absoluteOf(ref);
    if (abs === null) return { exists: false, expired: false };
    try {
      const info = fs.statSync(abs);
      return { exists: info.isFile(), expired: false, bytes: info.size };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return { exists: false, expired: false };
      throw error;
    }
  }

  read(ref: SpillRef): SpillReadResult {
    if (isSpillRefExpired(ref, this.now())) {
      return { ok: false, code: 'expired', error: `产物已过期: ${ref.locator}` };
    }
    const abs = this.absoluteOf(ref);
    if (abs === null) {
      return { ok: false, code: 'invalid-ref', error: `产物路径不在本工作区产物目录内: ${ref.locator}` };
    }
    const back = readToolArtifact(this.workspacePath, ref.locator);
    if (!back.ok) {
      const code = back.error.includes('不存在') ? 'not-found' : 'io';
      return { ok: false, code, error: back.error };
    }
    const text = back.content;
    if (sha256(text) === ref.sha256) return { ok: true, text, ref };
    // artifact-store 会给无尾换行的原文补一个换行:摘要按原文算时允许剥掉这一个补丁
    if (text.endsWith('\n') && sha256(text.slice(0, -1)) === ref.sha256) {
      return { ok: true, text: text.slice(0, -1), ref };
    }
    return {
      ok: false,
      code: 'hash-mismatch',
      error: `产物内容与引用摘要不符: ${ref.locator}`,
    };
  }

  private absoluteOf(ref: SpillRef): string | null {
    if (!isInsideToolArtifactDir(this.workspacePath, ref.locator)) return null;
    return path.resolve(this.workspacePath, ref.locator);
  }
}

/** 产物目录(供调用方展示/清理;本类不自动删除,留存策略是独立的一层)。 */
export function spillDirectory(workspacePath: string, sessionId?: string): string {
  return toolArtifactDir(workspacePath, sessionId);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
