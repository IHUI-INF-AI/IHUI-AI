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
}

const DEFAULT_MAX_HUNK_CHECKPOINTS = 30;

export class HunkCheckpointManager {
  private readonly sessionId: string;
  private readonly workspacePath: string;
  private readonly maxCheckpoints: number;
  private readonly baseDir: string;

  constructor(opts: HunkCheckpointOptions) {
    this.sessionId = opts.sessionId;
    this.workspacePath = path.resolve(opts.workspacePath);
    this.maxCheckpoints = opts.maxCheckpoints ?? DEFAULT_MAX_HUNK_CHECKPOINTS;
    this.baseDir = path.join(os.homedir(), '.ihui', 'checkpoints', this.sessionId);
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

  /** 读取文件所有行(不含换行符),文件不存在时返回空数组。 */
  private readLines(absPath: string): string[] {
    if (!fs.existsSync(absPath)) return [];
    const content = fs.readFileSync(absPath, 'utf-8');
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

    const id = `hunk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const meta: HunkCheckpointMeta = {
      id,
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      reason,
      file: rel,
      hunks: records,
    };

    const cpDir = path.join(this.baseDir, id);
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
    if (!fs.existsSync(this.baseDir)) return [];
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    const metas: HunkCheckpointMeta[] = [];
    for (const e of entries) {
      if (!e.isDirectory() || !e.name.startsWith('hunk_')) continue;
      const manifestPath = path.join(this.baseDir, e.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        metas.push(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as HunkCheckpointMeta);
      } catch {
        /* skip corrupted */
      }
    }
    return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get(checkpointId: string): HunkCheckpointMeta | null {
    const manifestPath = path.join(this.baseDir, checkpointId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as HunkCheckpointMeta;
    } catch {
      return null;
    }
  }

  /**
   * 回滚指定 hunk(只替换该范围的行,保留其他修改)。
   * 注意:不做位置漂移修正,假设文件行号未发生显著变化(适合工具刚修改后立即回滚)。
   * @returns { restored: true } 成功;{ restored: false, reason } 失败
   */
  restoreHunk(checkpointId: string, hunkIdx: number): { restored: boolean; linesAffected: number; reason?: string } {
    const meta = this.get(checkpointId);
    if (!meta) {
      return { restored: false, linesAffected: 0, reason: `检查点 ${checkpointId} 不存在` };
    }
    if (hunkIdx < 0 || hunkIdx >= meta.hunks.length) {
      return { restored: false, linesAffected: 0, reason: `hunkIdx ${hunkIdx} 越界(共 ${meta.hunks.length} 个 hunks)` };
    }
    const hunk = meta.hunks[hunkIdx]!;
    const absInWorkspace = path.join(this.workspacePath, meta.file);
    const currentLines = this.readLines(absInWorkspace);

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
    const meta = this.get(checkpointId);
    if (!meta) {
      return { hunksRestored: 0, linesAffected: 0, reason: `检查点 ${checkpointId} 不存在` };
    }
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
    const cpDir = path.join(this.baseDir, checkpointId);
    if (!fs.existsSync(cpDir)) return false;
    fs.rmSync(cpDir, { recursive: true, force: true });
    return true;
  }

  /**
   * 对比当前文件与 hunk 快照,返回每个 hunk 的状态。
   */
  diffHunks(checkpointId: string): Array<{ hunkIdx: number; range: HunkRange; status: 'unchanged' | 'modified' | 'gone' }> {
    const meta = this.get(checkpointId);
    if (!meta) return [];
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
