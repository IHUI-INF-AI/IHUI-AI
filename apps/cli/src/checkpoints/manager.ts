// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CheckpointManager — 工作区文件状态快照与回滚的编排实现(goal-b49 W3 自 ./index.ts 抽出,
 * 落 AGENTS §3「每页 < 250 行」;index.ts 只留对外面 barrel)。
 * 版本序列命名(./snapshot-series.ts)+ 三约束回收派发(./snapshot-gc.ts);
 * 唯一碰 fs 的适配层在 ./snapshot-store-host.ts;清单完整性只走 ./manifest-integrity.ts(§0.6)。
 * 做减法:不复制整个工作区,只快照"被指定的文件",按工作区相对路径镜像存储;
 * 原工作区不存在的文件标 'added',restore 时删除。回收 = 最近 N 版 ∧ 年龄窗 ∧ 总量上限,缺一不删(§0.3)。
 */

import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { type CorruptManifestEntry, type ManifestReadResult } from './manifest-integrity.js';
// goal-b49 S3:版本化文件快照的可寻址序列 `<uuid>@vN` + 三约束回收判据(取证 Q1 §4 #16)
import {
  allocateNextSnapshotSeriesRef,
  formatSnapshotSeriesDirName,
  isSnapshotSeriesDirName,
  parseSnapshotSeriesDirName,
  seriesUuidFromSeedHex,
  SNAPSHOT_SERIES_SEED_HEX_LENGTH,
} from './snapshot-series.js';
import { assertPathInside, isPathInside } from '../util/path-guard.js';
import {
  DEFAULT_SNAPSHOT_GC_POLICY,
  planSnapshotGc,
  type SnapshotGcCandidate,
  type SnapshotGcPlan,
  type SnapshotGcPolicy,
} from './snapshot-gc.js';
import {
  copyFilesIntoSnapshot,
  diffSnapshotFiles,
  ensureHostDir,
  listEntryNames,
  listSubDirNames,
  measureSnapshotBytes,
  readSnapshotMeta,
  removeSnapshotDir,
  restoreSnapshotFiles,
  probeSnapshotRoot,
  snapshotRootDir,
  unsafeWorkspaceKeyError,
  writeSnapshotManifest,
  type CheckpointDiffEntry,
  type CheckpointMeta,
} from './snapshot-store-host.js';
import { type CheckpointManagerOptions } from './index.js';

const DEFAULT_MAX_CHECKPOINTS = 20;

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
  /** 最近一次回收轮次的账面(计划档 + 历史 cp_ 清账枚数);null = 还没跑过回收 */
  private lastGc: { plan: SnapshotGcPlan; legacyDeleted: number } | null = null;

  constructor(opts: CheckpointManagerOptions) {
    this.sessionId = opts.sessionId;
    this.workspacePath = path.resolve(opts.workspacePath);
    this.maxCheckpoints = opts.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS;
    this.baseDir = snapshotRootDir(this.sessionId);
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
    this.gcPolicy = resolveGcPolicy(this.maxCheckpoints, opts.snapshotGcPolicy);
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

  async snapshot(files: string[], reason: string): Promise<CheckpointMeta> {
    return this.snapshotSync(files, reason);
  }

  snapshotSync(files: string[], reason: string): CheckpointMeta {
    ensureHostDir(this.baseDir);
    // goal-b49 S3:目录名 = 可寻址版本序列 <seriesUuid>@vN(旧 cp_<ts>_<rand> 不可寻址、无从判重号/回退);
    // 分配器只在本序列内取最大版本 +1,外来命名(hunk_*/cp_*)不参与定序。
    const allocation = allocateNextSnapshotSeriesRef(listEntryNames(this.baseDir), this.seriesUuid);
    if (!allocation.ok) {
      throw new Error(`检查点版本分配失败(${allocation.reason}):${allocation.detail}`);
    }
    const id = formatSnapshotSeriesDirName(allocation.ref);
    const cpDir = this.checkpointDir(id);
    ensureHostDir(cpDir);
    const copied = copyFilesIntoSnapshot(this.workspacePath, cpDir, files);
    const meta: CheckpointMeta = {
      id,
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      reason,
      files: copied.files,
      ...(copied.skipped.length > 0 ? { skipped: copied.skipped } : {}),
    };

    writeSnapshotManifest(cpDir, meta);
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
    // 快照根本就不存在 ⇒ 原样返回。读不到目录时抛错,不把清单说成空。
    const root = probeSnapshotRoot(this.baseDir);
    if (root === 'missing') return [];
    if (root === 'unreadable') throw new Error('检查点目录读不到,不能把它说成没有检查点');
    const metas: CheckpointMeta[] = [];
    this.lastQuarantined = [];
    for (const name of listSubDirNames(this.baseDir)) {
      // goal-b49 S3:会话目录下与 HunkCheckpointManager 的 `hunk_*` 同居一处,其清单形状天然不满足
      // isCheckpointMeta,旧实现会把它们判损坏并改名隔离(实测复现)⇒ 本管理器只扫自己的命名空间。
      if (!this.inOwnNamespace(name)) continue;
      // G-671:manifest 不存在 = 目录半成品(不算损坏);读不了/解析不了/形状不对 = 损坏,隔离并报名
      const result = readSnapshotMeta(this.baseDir, name, {
        onCorrupt: this.onCorrupt,
        onQuarantined: (entry) => {
          this.lastQuarantined.push(entry);
        },
      });
      if (result.status === 'unreadable') throw new Error(result.detail);
      if (result.status === 'ok') metas.push(result.meta);
    }
    return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get(checkpointId: string): CheckpointMeta | null {
    const result = readSnapshotMeta(this.baseDir, checkpointId, { onCorrupt: this.onCorrupt });
    if (result.status === 'unreadable') throw new Error(result.detail);
    return result.status === 'ok' ? result.meta : null;
  }

  /**
   * 检查点目录的唯一构造入口:根内/realpath 断言(复用 util/path-guard)。
   * 检查点 id 是内部序列名(含 `@vN`),不能做 `sanitizeSessionSegment` 改写,
   * 否则落盘名与 manifest id 不一致、list 会扫不到;只做根内断言即可拦 `../`。
   */
  private checkpointDir(checkpointId: string): string {
    return assertPathInside(this.baseDir, path.join(this.baseDir, checkpointId), '检查点目录');
  }

  private readCheckpoint(checkpointId: string): CheckpointMeta {
    const result = readSnapshotMeta(this.baseDir, checkpointId, { onCorrupt: this.onCorrupt });
    if (result.status === 'ok') return result.meta;
    if (result.status === 'unreadable') throw new Error(result.detail);
    if (result.status === 'corrupt') {
      // 形状校验跑在路径守卫之前:files 键越界(../、绝对路径)会把清单判成 shape-invalid,
      // 于是守卫的精确原因被"清单读不到"吞掉。这里用 entry.parsed 把越界键还原回 path-guard 文案,
      // 让 restore/diff 报的是"含 .. 目录段 / 不接受绝对路径",与回放侧同一判据(§0.6)。
      const guardError = unsafeWorkspaceKeyError(this.workspacePath, result.entry.parsed);
      if (guardError) throw guardError;
      throw new Error(`检查点 ${checkpointId} 清单读不到(${result.entry.reason}),不能把它说成不存在`);
    }
    throw new Error(`检查点 ${checkpointId} 不存在`);
  }

  async restore(checkpointId: string): Promise<{ restored: string[]; removed: string[]; notRestored: string[] }> {
    const meta = this.readCheckpoint(checkpointId);
    return restoreSnapshotFiles(this.workspacePath, this.checkpointDir(checkpointId), meta.files);
  }

  diff(checkpointId?: string): CheckpointDiffEntry[] {
    if (checkpointId) {
      const cp = this.readCheckpoint(checkpointId);
      return diffSnapshotFiles(this.workspacePath, this.checkpointDir(cp.id), cp.files);
    }
    const cp = this.list()[0] ?? null;
    if (!cp) throw new Error('暂无检查点,不能把它说成没有差异');
    return diffSnapshotFiles(this.workspacePath, this.checkpointDir(cp.id), cp.files);
  }

  delete(checkpointId: string): boolean {
    // 根外的 id 一律视为"没有这个检查点"(返回 false,不抛也不删);
    // 根内但 realpath 拐到根外的符号链接由 checkpointDir 抛错拒绝。
    if (!isPathInside(this.baseDir, path.join(this.baseDir, checkpointId))) return false;
    return removeSnapshotDir(this.checkpointDir(checkpointId));
  }

  /** 最近一次回收轮次(snapshotSync() 会刷;list()/get() 不跑回收 ⇒ 取到的是上一轮账面)的点名行;'undetermined' 时逐条说明缺哪门输入 */
  getLastGcNotes(): string[] {
    return this.lastGc ? [...this.lastGc.plan.notes] : [];
  }

  /**
   * goal-b49 W3:回收轮次的结构化账面(planSnapshotGc 原样输出 + 历史 `cp_` 清账枚数),供命令面分列上账。
   * null = 本实例还没跑过回收 ⇒ 不编造读数(既不记绿也不冒红,§0.3)。
   */
  getLastGcOutcome(): { plan: SnapshotGcPlan; legacyDeleted: number } | null {
    return this.lastGc;
  }

  /** 本会话序列的候选清单:只收 `<seriesUuid>@vN`;hunk_ 与历史 cp_ 前缀的目录不入射程,免被误判畸形 */
  private seriesCandidates(): SnapshotGcCandidate[] {
    const candidates: SnapshotGcCandidate[] = [];
    for (const name of listEntryNames(this.baseDir)) {
      const parsed = parseSnapshotSeriesDirName(name);
      if (!parsed.ok || parsed.ref.uuid !== this.seriesUuid) continue;
      candidates.push({ dirName: name, bytes: measureSnapshotBytes(this.baseDir, name) });
    }
    return candidates;
  }

  /**
   * goal-b49 S3:快照回收 = 三约束同时成立才删(保留最近 N 版 ∧ 年龄窗 ∧ 总量上限),
   * 判不出来(清单缺失/损坏、体积量不出、序列重号或回退)⇒ 整轮一枚不删并把原因留在 getLastGcNotes()。
   * 清单完整性自证只走 manifest-integrity 那份出口(§0.6);历史 cp_ 目录无版本档,仍按「超出 maxCheckpoints 即删」清账。
   */
  private pruneOldCheckpoints(): void {
    const plan = planSnapshotGc(this.seriesCandidates(), this.gcPolicy, {
      readManifest: (dirName): ManifestReadResult<CheckpointMeta> =>
        readSnapshotMeta(this.baseDir, dirName, { onCorrupt: this.onCorrupt }),
      nowMs: () => Date.now(),
    });
    // 账面先挂上「本轮判据」:即使后面的删除动作炸了,未判定原因也已可查(失效方向是多要一次说明,不是少说一次)
    this.lastGc = { plan, legacyDeleted: 0 };
    for (const doomed of plan.deletions) {
      this.delete(doomed.dirName);
    }
    const unversioned = this.list().filter((meta) => !isSnapshotSeriesDirName(meta.id));
    const doomedLegacy = unversioned.slice(this.maxCheckpoints);
    for (const cp of doomedLegacy) {
      this.delete(cp.id);
    }
    this.lastGc = { plan, legacyDeleted: doomedLegacy.length };
  }
}

/** 组装回收策略:缺省档 + keepVersions 跟随 maxCheckpoints + 调用方覆盖(缺省档为唯一真相源)。 */
function resolveGcPolicy(maxCheckpoints: number, override: CheckpointManagerOptions['snapshotGcPolicy']) {
  return { ...DEFAULT_SNAPSHOT_GC_POLICY, keepVersions: maxCheckpoints, ...override };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
