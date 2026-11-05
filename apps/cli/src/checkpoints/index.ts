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
 *   - goal-b49 S3:<checkpointId> 现为可寻址版本序列 `<seriesUuid>@vN`(seriesUuid 由 sessionId 的
 *     sha256 前 32 位推导 ⇒ 不列盘也能算出本会话序列身份;见 ./snapshot-series.ts)。回收判据在
 *     ./snapshot-gc.ts:保留最近 N 版 ∧ 年龄窗 ∧ 总量上限,三条同时成立才删,判不出来不删。
 *     同目录下的 `hunk_*`(HunkCheckpointManager)与历史 `cp_*` 不属本序列,由各自口径处理。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { isRecord } from '../util/json.js';
import {
  readManifestChecked,
  type CorruptManifestEntry,
  type ManifestReadResult,
} from './manifest-integrity.js';
// goal-b49 S3:版本化文件快照的可寻址序列 `<uuid>@vN` + 三约束回收判据(取证 Q1 §4 #16)
import {
  allocateNextSnapshotSeriesRef,
  formatSnapshotSeriesDirName,
  isSnapshotSeriesDirName,
  parseSnapshotSeriesDirName,
  seriesUuidFromSeedHex,
  SNAPSHOT_SERIES_SEED_HEX_LENGTH,
} from './snapshot-series.js';
import {
  DEFAULT_SNAPSHOT_GC_POLICY,
  planSnapshotGc,
  type SnapshotGcCandidate,
  type SnapshotGcPolicy,
} from './snapshot-gc.js';

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
  /** goal-b49 S3:覆盖快照回收策略的任一档;缺省取 DEFAULT_SNAPSHOT_GC_POLICY(keepVersions 跟随 maxCheckpoints) */
  snapshotGcPolicy?: Partial<SnapshotGcPolicy>;
}

const DEFAULT_MAX_CHECKPOINTS = 20;
/** 量快照体积的枚举预算:超预算即"量不出来"⇒ 该候选不删(AGENTS §0.3) */
const GC_SIZE_SCAN_BUDGET = 2000;

export class CheckpointManager {
  private readonly sessionId: string;
  private readonly workspacePath: string;
  private readonly maxCheckpoints: number;
  private readonly baseDir: string;
  private readonly onCorrupt: (entry: CorruptManifestEntry) => void;
  /** goal-b49 S3:本会话快照序列的身份(由 sessionId 摘要推导 ⇒ 可寻址,不依赖先列盘) */
  private readonly seriesUuid: string;
  private readonly gcPolicy: SnapshotGcPolicy;
  /** 最近一次 list() 扫描隔离出的损坏 manifest(账面必须有名字) */
  private lastQuarantined: CorruptManifestEntry[] = [];
  /** 最近一次回收轮次的点名行;'undetermined' 时逐条说明缺哪门输入 */
  private lastGcNotes: string[] = [];

  constructor(opts: CheckpointManagerOptions) {
    this.sessionId = opts.sessionId;
    this.workspacePath = path.resolve(opts.workspacePath);
    this.maxCheckpoints = opts.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS;
    this.baseDir = path.join(os.homedir(), '.ihui', 'checkpoints', this.sessionId);
    const seedHex = crypto
      .createHash('sha256')
      .update(this.sessionId)
      .digest('hex')
      .slice(0, SNAPSHOT_SERIES_SEED_HEX_LENGTH);
    const derived = seriesUuidFromSeedHex(seedHex);
    if (!derived.ok) {
      throw new RangeError(`检查点序列身份推导失败(${derived.reason}):${derived.detail}`);
    }
    this.seriesUuid = derived.uuid;
    this.gcPolicy = {
      ...DEFAULT_SNAPSHOT_GC_POLICY,
      keepVersions: this.maxCheckpoints,
      ...opts.snapshotGcPolicy,
    };
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

  /** 会话快照根下的目录名清单(基目录不存在 ⇒ 空表;不猜、不回落别处) */
  private existingDirNames(): string[] {
    if (!fs.existsSync(this.baseDir)) return [];
    return fs.readdirSync(this.baseDir);
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
    // goal-b49 S3:快照目录名 = 可寻址版本序列 `<seriesUuid>@vN`(旧形态 cp_<ts>_<rand> 不可寻址、
    // 无从判重号/回退);分配器只在本序列内取最大版本 +1,外来命名(hunk_*/cp_*)不参与定序。
    const allocation = allocateNextSnapshotSeriesRef(this.existingDirNames(), this.seriesUuid);
    if (!allocation.ok) {
      throw new Error(`检查点版本分配失败(${allocation.reason}):${allocation.detail}`);
    }
    const id = formatSnapshotSeriesDirName(allocation.ref);
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

  /** 本管理器自己的命名空间:版本序列(本会话 uuid)或历史 cp_ 前缀;别处写来的目录一概不碰 */
  private inOwnNamespace(dirName: string): boolean {
    if (dirName.startsWith('cp_')) return true;
    const parsed = parseSnapshotSeriesDirName(dirName);
    return parsed.ok && parsed.ref.uuid === this.seriesUuid;
  }

  list(): CheckpointMeta[] {
    if (!fs.existsSync(this.baseDir)) return [];
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    const metas: CheckpointMeta[] = [];
    this.lastQuarantined = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // goal-b49 S3:会话目录下与 HunkCheckpointManager 的 `hunk_*` 同居一处,其清单形状天然不满足
      // isCheckpointMeta,旧实现会把它们判损坏并改名隔离(实测复现)⇒ 本管理器只扫自己的命名空间。
      if (!this.inOwnNamespace(e.name)) continue;
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

  /** 最近一次回收轮次(list()/snapshot() 都会刷)的点名行;state='undetermined' 时逐条说明缺哪门输入 */
  getLastGcNotes(): string[] {
    return [...this.lastGcNotes];
  }

  /** 本会话序列的候选清单:只收 `<seriesUuid>@vN`;hunk_ 与历史 cp_ 前缀的目录不入射程,免被误判畸形 */
  private seriesCandidates(): SnapshotGcCandidate[] {
    const candidates: SnapshotGcCandidate[] = [];
    for (const name of this.existingDirNames()) {
      const parsed = parseSnapshotSeriesDirName(name);
      if (!parsed.ok || parsed.ref.uuid !== this.seriesUuid) continue;
      candidates.push({ dirName: name, bytes: measureDirBytes(path.join(this.baseDir, name)) });
    }
    return candidates;
  }

  /**
   * goal-b49 S3:快照回收 = 三约束同时成立才删(保留最近 N 版 ∧ 年龄窗 ∧ 总量上限),
   * 判不出来(清单缺失/损坏、体积量不出、序列重号或回退)⇒ 整轮一枚不删并把原因留在 getLastGcNotes()。
   * 清单完整性自证只走 manifest-integrity 那一份出口(AGENTS §0.6,不在这里复算判据)。
   * 历史 cp_ 前缀的目录没有版本档,仍按原「超出 maxCheckpoints 即删」清账,避免旧目录永存。
   */
  private pruneOldCheckpoints(): void {
    const plan = planSnapshotGc(this.seriesCandidates(), this.gcPolicy, {
      readManifest: (dirName): ManifestReadResult<CheckpointMeta> =>
        readManifestChecked(
          path.join(this.baseDir, dirName, 'manifest.json'),
          dirName,
          isCheckpointMeta,
          this.onCorrupt,
        ),
      nowMs: () => Date.now(),
    });
    this.lastGcNotes = plan.notes;
    for (const doomed of plan.deletions) {
      this.delete(doomed.dirName);
    }
    const unversioned = this.list().filter((meta) => !isSnapshotSeriesDirName(meta.id));
    for (const cp of unversioned.slice(this.maxCheckpoints)) {
      this.delete(cp.id);
    }
  }
}

/** 量一个快照目录的体积;读不动或超枚举预算 ⇒ null(量不出来就不删,不猜) */
function measureDirBytes(dir: string): number | null {
  let bytes = 0;
  let visited = 0;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const item of items) {
      visited += 1;
      if (visited > GC_SIZE_SCAN_BUDGET) return null;
      const child = path.join(current, item.name);
      if (item.isDirectory()) {
        stack.push(child);
        continue;
      }
      try {
        const stat = fs.statSync(child);
        if (stat.isFile()) bytes += stat.size;
      } catch {
        return null;
      }
    }
  }
  return bytes;
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
