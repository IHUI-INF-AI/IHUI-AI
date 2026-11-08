// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Hunk 级 Checkpoints — 按代码块(行范围)粒度快照与回滚。
 *
 * 灵感来源:参考行业 Agent 框架的 git hunk tracker + opencode 的 undo 机制。
 * 简化策略(做减法):
 *   - 不实现完整 diff 算法,只按"行号范围"快照原始内容
 *   - 回滚时按行号范围替换,不做位置漂移修正(适合工具刚修改后立即回滚)
 *   - 独立于 CheckpointManager(整文件快照),两者并存
 *
 * 存储:~/.ihui/checkpoints/<sessionId>/hunk_<id>/manifest.json
 *   manifest.json: { id, sessionId, createdAt, reason, file, hunks: [{ range, originalLines }] }
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { isRecord, isJsonArray } from '../util/json.js';
// 会话/检查点 id 路径穿越修复:与 CheckpointManager 共用同一套收敛 + 根内/realpath 判据。
import { assertPathInside, isPathInside, segmentPathInside } from '../util/path-guard.js';
import { readManifestChecked, type CorruptManifestEntry } from './manifest-integrity.js';
import { probeSnapshotRoot } from './snapshot-store-host.js';

export interface HunkRange {
  /** 起始行(1-indexed,包含) */
  start: number;
  /** 结束行(1-indexed,包含) */
  end: number;
}

export interface HunkRecord {
  range: HunkRange;
  /** 原始文件该范围的行内容(不含换行符) */
  originalLines: string[];
}

export interface HunkCheckpointMeta {
  id: string;
  sessionId: string;
  createdAt: string;
  reason: string;
  /** 相对工作区的文件路径(POSIX 风格) */
  file: string;
  hunks: HunkRecord[];
}

export interface HunkCheckpointOptions {
  sessionId: string;
  workspacePath: string;
  maxCheckpoints?: number;
  /** G-671:manifest 损坏被隔离时的到人出口;缺省 console.warn 点名路径 */
  onCorruptManifest?: (entry: CorruptManifestEntry) => void;
}

/** G-671:hunk manifest 形状校验(range 数值合法/hunks 数组/originalLines 字符串数组)。 */
export function isHunkCheckpointMeta(v: unknown): v is HunkCheckpointMeta {
  if (!isRecord(v)) return false;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.sessionId !== 'string') return false;
  if (typeof v.createdAt !== 'string' || Number.isNaN(Date.parse(v.createdAt))) return false;
  if (typeof v.reason !== 'string') return false;
  if (typeof v.file !== 'string') return false;
  if (!isJsonArray(v.hunks)) return false;
  return v.hunks.every((h) => {
    if (!isRecord(h)) return false;
    if (!isRecord(h.range)) return false;
    if (typeof h.range.start !== 'number' || typeof h.range.end !== 'number') return false;
    if (!Number.isInteger(h.range.start) || !Number.isInteger(h.range.end)) return false;
    return isJsonArray(h.originalLines) && h.originalLines.every((l) => typeof l === 'string');
  });
}

const DEFAULT_MAX_HUNK_CHECKPOINTS = 30;

export class HunkCheckpointManager {
  private readonly sessionId: string;
  private readonly workspacePath: string;
  private readonly maxCheckpoints: number;
  private readonly baseDir: string;
  private readonly onCorrupt: (entry: CorruptManifestEntry) => void;
  /** 单调递增的快照时间戳(ms),防同一毫秒内连续快照 createdAt 并列导致排序不稳 */
  private lastSeqMs = 0;
  /** 最近一次 list() 扫描隔离出的损坏 manifest(账面必须有名字) */
  private lastQuarantined: CorruptManifestEntry[] = [];

  constructor(opts: HunkCheckpointOptions) {
    this.sessionId = opts.sessionId;
    this.workspacePath = path.resolve(opts.workspacePath);
    this.maxCheckpoints = opts.maxCheckpoints ?? DEFAULT_MAX_HUNK_CHECKPOINTS;
    // sessionId 来自 `--session`,与整文件检查点同解:收敛成单段并断言在 checkpoints 根内。
    this.baseDir = segmentPathInside(
      path.resolve(os.homedir(), '.ihui', 'checkpoints'),
      this.sessionId,
      '会话 hunk 检查点目录',
    );
    this.onCorrupt =
      opts.onCorruptManifest ??
      ((entry) => {
        console.warn(
          `[checkpoints] hunk manifest 损坏已隔离(${entry.reason}): ${entry.manifestPath} → ${entry.quarantinePath ?? '(改名失败,原位保留)'}`,
        );
      });
  }

  /** 最近一次 list()/get() 隔离出的损坏 manifest 清单 */
  getQuarantinedManifests(): CorruptManifestEntry[] {
    return [...this.lastQuarantined];
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private resolveRel(filePath: string): string {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspacePath, filePath);
    const rel = path.relative(this.workspacePath, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`文件 ${filePath} 不在工作区 ${this.workspacePath} 内`);
    }
    return rel.replace(/\\/g, '/');
  }

  /** 读取文件所有行(不含换行符)。文件不存在返回空数组;读不到则抛错,不当成空文件。 */
  private readLines(absPath: string): string[] {
    let content: string;
    try {
      content = fs.readFileSync(absPath, 'utf-8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return [];
      throw new Error('文件读不到,不能把它当成空文件');
    }
    // 保留行尾换行符信息:split('\n') 后,最后一行若为空(因 \n 结尾)则丢弃
    const lines = content.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines;
  }

  /** 写入文件所有行(自动加换行符)。 */
  private writeLines(absPath: string, lines: string[]): void {
    this.ensureDir(path.dirname(absPath));
    fs.writeFileSync(absPath, lines.join('\n') + '\n', 'utf-8');
  }

  /**
   * 快照指定文件的指定 hunk 范围。
   * @param filePath 文件路径(相对或绝对)
   * @param hunks 行范围列表(1-indexed,start <= end)
   * @param reason 快照原因
   */
  snapshotHunks(filePath: string, hunks: HunkRange[], reason: string): HunkCheckpointMeta {
    if (hunks.length === 0) {
      throw new Error('hunks 不能为空');
    }
    for (const h of hunks) {
      if (h.start < 1 || h.end < h.start) {
        throw new Error(`非法 hunk 范围: start=${h.start}, end=${h.end}`);
      }
    }
    this.ensureDir(this.baseDir);

    const rel = this.resolveRel(filePath);
    const absInWorkspace = path.join(this.workspacePath, rel);
    const allLines = this.readLines(absInWorkspace);

    const records: HunkRecord[] = [];
    for (const h of hunks) {
      // 行号超出文件范围时,只截取有效部分
      const start = Math.min(h.start, allLines.length + 1);
      const end = Math.min(h.end, allLines.length);
      const originalLines = end >= start ? allLines.slice(start - 1, end) : [];
      records.push({ range: h, originalLines });
    }

    // 单调时钟(2026-09-10):Date.now() 毫秒级精度,同一毫秒内连续创建的快照
    // createdAt 完全相同,list() 排序并列时顺序取决于 readdir 顺序(Linux ext4
    // 非插入序),pruneOldCheckpoints 会误删最新快照。强制 createdAt 单调递增。
    this.lastSeqMs = Math.max(Date.now(), this.lastSeqMs + 1);
    const seqMs = this.lastSeqMs;
    const id = `hunk_${seqMs}_${crypto.randomBytes(3).toString('hex')}`;
    const meta: HunkCheckpointMeta = {
      id,
      sessionId: this.sessionId,
      createdAt: new Date(seqMs).toISOString(),
      reason,
      file: rel,
      hunks: records,
    };

    const cpDir = assertPathInside(this.baseDir, path.join(this.baseDir, id), 'hunk 检查点目录');
    this.ensureDir(cpDir);
    fs.writeFileSync(
      path.join(cpDir, 'manifest.json'),
      JSON.stringify(meta, null, 2),
      'utf-8',
    );

    this.pruneOldCheckpoints();
    return meta;
  }

  list(): HunkCheckpointMeta[] {
    const root = probeSnapshotRoot(this.baseDir);
    if (root === 'missing') return [];
    if (root === 'unreadable') throw new Error('检查点目录读不到,不能把它说成没有检查点');
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    const metas: HunkCheckpointMeta[] = [];
    this.lastQuarantined = [];
    for (const e of entries) {
      if (!e.isDirectory() || !e.name.startsWith('hunk_')) continue;
      const manifestPath = path.join(this.baseDir, e.name, 'manifest.json');
      // G-671:manifest 不存在 = 目录半成品(不算损坏);读不了/解析不了/形状不对 = 损坏,隔离并报名
      const result = readManifestChecked(manifestPath, e.name, isHunkCheckpointMeta, (entry) => {
        this.lastQuarantined.push(entry);
        this.onCorrupt(entry);
      });
      if (result.status === 'unreadable') throw new Error(result.detail);
      if (result.status === 'ok') metas.push(result.meta);
    }
    return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private readHunkCheckpoint(
    checkpointId: string,
  ):
    | { status: 'ok'; meta: HunkCheckpointMeta }
    | { status: 'missing' }
    | { status: 'unreadable'; detail: string }
    | { status: 'corrupt'; reason: string } {
    const manifestPath = path.join(
      assertPathInside(this.baseDir, path.join(this.baseDir, checkpointId), 'hunk 检查点目录'),
      'manifest.json',
    );
    const result = readManifestChecked(manifestPath, checkpointId, isHunkCheckpointMeta, this.onCorrupt);
    if (result.status === 'ok') return { status: 'ok', meta: result.meta };
    if (result.status === 'unreadable') return { status: 'unreadable', detail: result.detail };
    if (result.status === 'corrupt') return { status: 'corrupt', reason: result.entry.reason };
    return { status: 'missing' };
  }

  get(checkpointId: string): HunkCheckpointMeta | null {
    const read = this.readHunkCheckpoint(checkpointId);
    if (read.status === 'unreadable') throw new Error(read.detail);
    return read.status === 'ok' ? read.meta : null;
  }

  /**
   * 回滚指定 hunk(只替换该范围的行,保留其他修改)。
   * 注意:不做位置漂移修正,假设文件行号未发生显著变化(适合工具刚修改后立即回滚)。
   * @returns { restored: true } 成功;{ restored: false, reason } 失败
   */
  restoreHunk(checkpointId: string, hunkIdx: number): { restored: boolean; linesAffected: number; reason?: string } {
    const read = this.readHunkCheckpoint(checkpointId);
    if (read.status === 'unreadable') {
      return { restored: false, linesAffected: 0, reason: read.detail };
    }
    if (read.status === 'corrupt') {
      return {
        restored: false,
        linesAffected: 0,
        reason: `检查点 ${checkpointId} 清单读不到(${read.reason}),不能把它说成不存在`,
      };
    }
    if (read.status === 'missing') {
      return { restored: false, linesAffected: 0, reason: `检查点 ${checkpointId} 不存在` };
    }
    const meta = read.meta;
    if (hunkIdx < 0 || hunkIdx >= meta.hunks.length) {
      return { restored: false, linesAffected: 0, reason: `hunkIdx ${hunkIdx} 越界(共 ${meta.hunks.length} 个 hunks)` };
    }
    const hunk = meta.hunks[hunkIdx]!;
    const absInWorkspace = path.join(this.workspacePath, meta.file);
    let currentLines: string[];
    try {
      currentLines = this.readLines(absInWorkspace);
    } catch (err) {
      return { restored: false, linesAffected: 0, reason: err instanceof Error ? err.message : String(err) };
    }

    // 按记录的行范围替换,行号超出当前文件时截断
    const start = Math.min(hunk.range.start, currentLines.length + 1);
    const end = Math.min(hunk.range.end, currentLines.length);
    const before = currentLines.slice(0, start - 1);
    const after = currentLines.slice(end);
    const newLines = [...before, ...hunk.originalLines, ...after];
    this.writeLines(absInWorkspace, newLines);

    return { restored: true, linesAffected: hunk.originalLines.length };
  }

  /** 回滚所有 hunks(按 hunkIdx 倒序回滚,避免行号偏移问题)。 */
  restoreAll(checkpointId: string): { hunksRestored: number; linesAffected: number; reason?: string } {
    const read = this.readHunkCheckpoint(checkpointId);
    if (read.status === 'unreadable') {
      return { hunksRestored: 0, linesAffected: 0, reason: read.detail };
    }
    if (read.status === 'corrupt') {
      return {
        hunksRestored: 0,
        linesAffected: 0,
        reason: `检查点 ${checkpointId} 清单读不到(${read.reason}),不能把它说成不存在`,
      };
    }
    if (read.status === 'missing') {
      return { hunksRestored: 0, linesAffected: 0, reason: `检查点 ${checkpointId} 不存在` };
    }
    const meta = read.meta;
    let totalLines = 0;
    let restored = 0;
    // 倒序回滚(从后往前),避免前一个 hunk 回滚后影响后一个 hunk 的行号
    for (let i = meta.hunks.length - 1; i >= 0; i--) {
      const result = this.restoreHunk(checkpointId, i);
      if (result.restored) {
        restored++;
        totalLines += result.linesAffected;
      }
    }
    return { hunksRestored: restored, linesAffected: totalLines };
  }

  delete(checkpointId: string): boolean {
    // 根外的 id 视为"没有这个检查点"(false,不抛也不删);根内符号链接拐到根外时抛错。
    if (!isPathInside(this.baseDir, path.join(this.baseDir, checkpointId))) return false;
    const cpDir = assertPathInside(this.baseDir, path.join(this.baseDir, checkpointId), 'hunk 检查点目录');
    const root = probeSnapshotRoot(cpDir);
    if (root === 'missing') return false;
    if (root === 'unreadable') throw new Error('检查点目录读不到,不能把它说成未找到');
    fs.rmSync(cpDir, { recursive: true, force: true });
    return true;
  }

  /**
   * 对比当前文件与 hunk 快照,返回每个 hunk 的状态。
   */
  diffHunks(checkpointId: string): Array<{ hunkIdx: number; range: HunkRange; status: 'unchanged' | 'modified' | 'gone' }> {
    const read = this.readHunkCheckpoint(checkpointId);
    if (read.status === 'missing') return [];
    if (read.status === 'unreadable') throw new Error(read.detail);
    if (read.status === 'corrupt') {
      throw new Error(`检查点 ${checkpointId} 清单读不到(${read.reason}),不能把它说成不存在`);
    }
    const meta = read.meta;
    const absInWorkspace = path.join(this.workspacePath, meta.file);
    const currentLines = this.readLines(absInWorkspace);
    const result: Array<{ hunkIdx: number; range: HunkRange; status: 'unchanged' | 'modified' | 'gone' }> = [];
    meta.hunks.forEach((hunk, idx) => {
      const start = hunk.range.start - 1;
      const end = hunk.range.end;
      const currentSlice = currentLines.slice(start, end);
      const same =
        currentSlice.length === hunk.originalLines.length &&
        currentSlice.every((line, i) => line === hunk.originalLines[i]);
      if (!fs.existsSync(absInWorkspace)) {
        result.push({ hunkIdx: idx, range: hunk.range, status: 'gone' });
      } else if (same) {
        result.push({ hunkIdx: idx, range: hunk.range, status: 'unchanged' });
      } else {
        result.push({ hunkIdx: idx, range: hunk.range, status: 'modified' });
      }
    });
    return result;
  }

  private pruneOldCheckpoints(): void {
    const all = this.list();
    if (all.length <= this.maxCheckpoints) return;
    for (const cp of all.slice(this.maxCheckpoints)) {
      this.delete(cp.id);
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
