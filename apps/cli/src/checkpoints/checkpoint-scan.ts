// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话检查点目录的只读判读(自 ./index.ts 纯抽档,落 AGENTS §3「每页 < 250 行」)。
 * 职责:序列身份推导、本会话命名空间判定、清单扫描、回收候选枚举、单条清单读取的出错语义。
 * 不碰盘、不删改、不持有状态:所有读写原语仍由 ./snapshot-store-host.ts 提供,调用方只做编排。
 */

import * as crypto from 'node:crypto';
import type { CorruptManifestEntry } from './manifest-integrity.js';
import {
  listEntryNames,
  listSubDirNames,
  measureSnapshotBytes,
  probeSnapshotRoot,
  readSnapshotMeta,
} from './snapshot-store-host.js';
import {
  parseSnapshotSeriesDirName,
  seriesUuidFromSeedHex,
  SNAPSHOT_SERIES_SEED_HEX_LENGTH,
} from './snapshot-series.js';
import type { SnapshotGcCandidate } from './snapshot-gc.js';
import type { CheckpointMeta } from './snapshot-store-host.js';

/** 本会话快照序列的身份(由 sessionId 摘要推导 ⇒ 可寻址,不依赖先列盘) */
export function deriveSnapshotSeriesUuid(sessionId: string): string {
  const seedHex = crypto
    .createHash('sha256')
    .update(sessionId)
    .digest('hex')
    .slice(0, SNAPSHOT_SERIES_SEED_HEX_LENGTH);
  const derived = seriesUuidFromSeedHex(seedHex);
  if (!derived.ok) {
    throw new RangeError(`检查点序列身份推导失败(${derived.reason}):${derived.detail}`);
  }
  return derived.uuid;
}

/** 本管理器自己的命名空间:版本序列(本会话 uuid)或历史 cp_ 前缀;别处写来的目录一概不碰 */
export function isOwnSnapshotNamespace(dirName: string, seriesUuid: string): boolean {
  if (dirName.startsWith('cp_')) return true;
  const parsed = parseSnapshotSeriesDirName(dirName);
  return parsed.ok && parsed.ref.uuid === seriesUuid;
}

export interface SnapshotScanHooks {
  onCorrupt: (entry: CorruptManifestEntry) => void;
  /** 根存在后才清账:根不存在时保留上一轮账面(与拆分前逐字等价) */
  beginScan: () => void;
  quarantine: (entry: CorruptManifestEntry) => void;
}

/** 扫描本会话的检查点清单;根不存在 ⇒ 空表,根读不到 ⇒ 抛错,不把清单说成空 */
export function scanCheckpointMetas(
  baseDir: string,
  seriesUuid: string,
  hooks: SnapshotScanHooks,
): CheckpointMeta[] {
  // 快照根本就不存在 ⇒ 原样返回。读不到目录时抛错,不把清单说成空。
  const root = probeSnapshotRoot(baseDir);
  if (root === 'missing') return [];
  if (root === 'unreadable') throw new Error('检查点目录读不到,不能把它说成没有检查点');
  const metas: CheckpointMeta[] = [];
  hooks.beginScan();
  for (const name of listSubDirNames(baseDir)) {
    // goal-b49 S3:会话目录下与 HunkCheckpointManager 的 `hunk_*` 同居一处,其清单形状天然不满足
    // isCheckpointMeta,旧实现会把它们判损坏并改名隔离(实测复现)⇒ 本管理器只扫自己的命名空间。
    if (!isOwnSnapshotNamespace(name, seriesUuid)) continue;
    // G-671:manifest 不存在 = 目录半成品(不算损坏);读不了/解析不了/形状不对 = 损坏,隔离并报名
    const result = readSnapshotMeta(baseDir, name, {
      onCorrupt: hooks.onCorrupt,
      onQuarantined: hooks.quarantine,
    });
    if (result.status === 'unreadable') throw new Error(result.detail);
    if (result.status === 'ok') metas.push(result.meta);
  }
  return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 本会话序列的候选清单:只收 `<seriesUuid>@vN`;hunk_ 与历史 cp_ 前缀的目录不入射程,免被误判畸形 */
export function collectSeriesGcCandidates(baseDir: string, seriesUuid: string): SnapshotGcCandidate[] {
  const candidates: SnapshotGcCandidate[] = [];
  for (const name of listEntryNames(baseDir)) {
    const parsed = parseSnapshotSeriesDirName(name);
    if (!parsed.ok || parsed.ref.uuid !== seriesUuid) continue;
    candidates.push({ dirName: name, bytes: measureSnapshotBytes(baseDir, name) });
  }
  return candidates;
}

/** 读单条检查点清单:不存在 ⇒ 抛"不存在";读不到/损坏 ⇒ 抛错点名原因(不得折成"不存在") */
export function readCheckpointMetaOrThrow(
  baseDir: string,
  checkpointId: string,
  onCorrupt: (entry: CorruptManifestEntry) => void,
): CheckpointMeta {
  const result = readSnapshotMeta(baseDir, checkpointId, { onCorrupt });
  if (result.status === 'ok') return result.meta;
  if (result.status === 'unreadable') throw new Error(result.detail);
  if (result.status === 'corrupt') {
    throw new Error(`检查点 ${checkpointId} 清单读不到(${result.entry.reason}),不能把它说成不存在`);
  }
  throw new Error(`检查点 ${checkpointId} 不存在`);
}
