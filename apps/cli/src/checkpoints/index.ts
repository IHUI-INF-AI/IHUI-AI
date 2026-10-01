// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Checkpoints 检查点系统 — 工作区文件状态快照与回滚。
 *
 * 灵感来源:参考行业 Agent 框架的 workspace crate 设计(检查点能力)。
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
import { isRecord } from '../util/json.js';
import { readManifestChecked, type CorruptManifestEntry } from './manifest-integrity.js';

export * from './hunk-tracker.js';

/** G-671:manifest 形状校验 —— 缺关键字段/档值非法/schemaVersion 不识别 ⇒ 不算合法 meta。 */
export function isCheckpointMeta(v: unknown): v is CheckpointMeta {
  if (!isRecord(v)) return false;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.sessionId !== 'string') return false;
  if (typeof v.createdAt !== 'string' || Number.isNaN(Date.parse(v.createdAt))) return false;
  if (typeof v.reason !== 'string') return false;
  if (!isRecord(v.files)) return false;
  if (v.schemaVersion !== undefined && v.schemaVersion !== 1) return false;
  return Object.values(v.files).every((k) => k === 'snap' || k === 'added');
}

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
  /** G-671:manifest 损坏被隔离时的到人出口;缺省 console.warn 点名路径 */
  onCorruptManifest?: (entry: CorruptManifestEntry) => void;
}

const DEFAULT_MAX_CHECKPOINTS = 20;

export class CheckpointManager {
  private readonly sessionId: string;
  private readonly workspacePath: string;
  private readonly maxCheckpoints: number;
  private readonly baseDir: string;
  private readonly onCorrupt: (entry: CorruptManifestEntry) => void;
  /** 最近一次 list() 扫描隔离出的损坏 manifest(账面必须有名字) */
  private lastQuarantined: CorruptManifestEntry[] = [];

  constructor(opts: CheckpointManagerOptions) {
    this.sessionId = opts.sessionId;
    this.workspacePath = path.resolve(opts.workspacePath);
    this.maxCheckpoints = opts.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS;
    this.baseDir = path.join(os.homedir(), '.ihui', 'checkpoints', this.sessionId);
    this.onCorrupt =
      opts.onCorruptManifest ??
      ((entry) => {
        console.warn(
          `[checkpoints] manifest 损坏已隔离(${entry.reason}): ${entry.manifestPath} → ${entry.quarantinePath ?? '(改名失败,原位保留)'}`,
        );
      });
  }

  /** 最近一次 list()/get() 隔离出的损坏 manifest 清单;清空请显式调 resetQuarantine() */
  getQuarantinedManifests(): CorruptManifestEntry[] {
    return [...this.lastQuarantined];
  }

  resetQuarantine(): void {
    this.lastQuarantined = [];
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
    return this.snapshotSync(files, reason);
  }

  snapshotSync(files: string[], reason: string): CheckpointMeta {
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
    this.lastQuarantined = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const manifestPath = path.join(this.baseDir, e.name, 'manifest.json');
      // G-671:manifest 不存在 = 目录半成品(不算损坏);读不了/解析不了/形状不对 = 损坏,隔离并报名
      const result = readManifestChecked(manifestPath, e.name, isCheckpointMeta, (entry) => {
        this.lastQuarantined.push(entry);
        this.onCorrupt(entry);
      });
      if (result.status === 'ok') metas.push(result.meta);
    }
    return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get(checkpointId: string): CheckpointMeta | null {
    const manifestPath = path.join(this.baseDir, checkpointId, 'manifest.json');
    const result = readManifestChecked(manifestPath, checkpointId, isCheckpointMeta, this.onCorrupt);
    return result.status === 'ok' ? result.meta : null;
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
