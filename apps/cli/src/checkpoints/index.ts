/**
 * Checkpoints 检查点系统 — 工作区文件状态快照与回滚。
 *
 * 灵感来源:cli 的 cli-workspace crate(检查点能力)。
 * 简化策略(做减法):
 *   - 不复制整个工作区,只快照"被指定的文件"(通常是被工具修改前的版本)
 *   - 按工作区相对路径镜像存储,manifest.json 记录元数据
 *   - 对原工作区不存在的文件标记为 'added',restore 时删除
 *
 * 存储:~/.ihui/checkpoints/<sessionId>/<checkpointId>/
 *   - manifest.json: { id, sessionId, createdAt, reason, files: { relPath: 'snap'|'added' } }
 *   - <relPath>: 镜像文件内容(目录结构 1:1 镜像)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export interface CheckpointMeta {
  id: string;
  sessionId: string;
  createdAt: string;
  reason: string;
  files: Record<string, 'snap' | 'added'>;
}

export interface CheckpointDiffEntry {
  path: string;
  status: 'unchanged' | 'modified' | 'added' | 'removed';
}

export interface CheckpointManagerOptions {
  sessionId: string;
  workspacePath: string;
  maxCheckpoints?: number;
}

const DEFAULT_MAX_CHECKPOINTS = 20;

export class CheckpointManager {
  private readonly sessionId: string;
  private readonly workspacePath: string;
  private readonly maxCheckpoints: number;
  private readonly baseDir: string;

  constructor(opts: CheckpointManagerOptions) {
    this.sessionId = opts.sessionId;
    this.workspacePath = path.resolve(opts.workspacePath);
    this.maxCheckpoints = opts.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS;
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
    return rel;
  }

  async snapshot(files: string[], reason: string): Promise<CheckpointMeta> {
    this.ensureDir(this.baseDir);
    const id = `cp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const cpDir = path.join(this.baseDir, id);
    this.ensureDir(cpDir);

    const meta: CheckpointMeta = {
      id,
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      reason,
      files: {},
    };

    for (const f of files) {
      const rel = this.resolveRel(f);
      const absInWorkspace = path.join(this.workspacePath, rel);
      if (!fs.existsSync(absInWorkspace)) {
        meta.files[rel] = 'added';
      } else {
        const stat = fs.statSync(absInWorkspace);
        if (!stat.isFile()) {
          continue;
        }
        const dest = path.join(cpDir, rel);
        this.ensureDir(path.dirname(dest));
        fs.copyFileSync(absInWorkspace, dest);
        meta.files[rel] = 'snap';
      }
    }

    fs.writeFileSync(
      path.join(cpDir, 'manifest.json'),
      JSON.stringify(meta, null, 2),
      'utf-8',
    );

    this.pruneOldCheckpoints();
    return meta;
  }

  list(): CheckpointMeta[] {
    if (!fs.existsSync(this.baseDir)) return [];
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    const metas: CheckpointMeta[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const manifestPath = path.join(this.baseDir, e.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        metas.push(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as CheckpointMeta);
      } catch {
        /* skip corrupted */
      }
    }
    return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get(checkpointId: string): CheckpointMeta | null {
    const manifestPath = path.join(this.baseDir, checkpointId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as CheckpointMeta;
    } catch {
      return null;
    }
  }

  async restore(checkpointId: string): Promise<{ restored: string[]; removed: string[] }> {
    const meta = this.get(checkpointId);
    if (!meta) {
      throw new Error(`检查点 ${checkpointId} 不存在`);
    }
    const cpDir = path.join(this.baseDir, checkpointId);
    const restored: string[] = [];
    const removed: string[] = [];

    for (const [rel, kind] of Object.entries(meta.files)) {
      const absInWorkspace = path.join(this.workspacePath, rel);
      if (kind === 'added') {
        if (fs.existsSync(absInWorkspace)) {
          fs.rmSync(absInWorkspace, { recursive: true, force: true });
          removed.push(rel);
        }
      } else {
        const src = path.join(cpDir, rel);
        if (fs.existsSync(src)) {
          this.ensureDir(path.dirname(absInWorkspace));
          fs.copyFileSync(src, absInWorkspace);
          restored.push(rel);
        }
      }
    }
    return { restored, removed };
  }

  diff(checkpointId?: string): CheckpointDiffEntry[] {
    const cp = checkpointId
      ? this.get(checkpointId)
      : this.list()[0] ?? null;
    if (!cp) return [];
    const cpDir = path.join(this.baseDir, cp.id);
    const entries: CheckpointDiffEntry[] = [];
    for (const [rel, kind] of Object.entries(cp.files)) {
      const absInWorkspace = path.join(this.workspacePath, rel);
      const existsNow = fs.existsSync(absInWorkspace);
      if (kind === 'added') {
        entries.push({ path: rel, status: existsNow ? 'added' : 'unchanged' });
      } else {
        if (!existsNow) {
          entries.push({ path: rel, status: 'removed' });
          continue;
        }
        const snapPath = path.join(cpDir, rel);
        const same = fileContentEqual(absInWorkspace, snapPath);
        entries.push({ path: rel, status: same ? 'unchanged' : 'modified' });
      }
    }
    return entries.filter((e) => e.status !== 'unchanged');
  }

  delete(checkpointId: string): boolean {
    const cpDir = path.join(this.baseDir, checkpointId);
    if (!fs.existsSync(cpDir)) return false;
    fs.rmSync(cpDir, { recursive: true, force: true });
    return true;
  }

  private pruneOldCheckpoints(): void {
    const all = this.list();
    if (all.length <= this.maxCheckpoints) return;
    for (const cp of all.slice(this.maxCheckpoints)) {
      this.delete(cp.id);
    }
  }
}

function fileContentEqual(a: string, b: string): boolean {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    if (sa.size !== sb.size) return false;
    const ha = crypto.createHash('sha256').update(fs.readFileSync(a)).digest('hex');
    const hb = crypto.createHash('sha256').update(fs.readFileSync(b)).digest('hex');
    return ha === hb;
  } catch {
    return false;
  }
}

export function getCheckpointsBaseDir(): string {
  return path.join(os.homedir(), '.ihui', 'checkpoints');
}
