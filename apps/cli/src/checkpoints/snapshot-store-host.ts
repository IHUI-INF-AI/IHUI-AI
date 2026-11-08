// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快照存储宿主层 — `checkpoints/` 的公开门面:唯一根内断言入口 + 清单读取出口;
 * 具体实现已按职责就近拆到:
 *   - ./checkpoint-meta.ts   = 清单形状与工作区相对路径判据
 *   - ./snapshot-root-io.ts  = 快照根三态探测 / 目录枚举 / 建目录前置检查
 *   - ./snapshot-file-io.ts  = 录制 / 回滚 / 比对 / 删除 / 体积测量
 *   - ./change-index.ts      = 变更索引 / 明细 / 请求文件树的判读
 * 上层继续从本文件 import;下面逐项原样转出,公开面与拆分前逐字相同(goal-b49 W3 落 AGENTS §3「每页 < 250 行」)。
 * 存储:`~/.ihui/checkpoints/<sessionId>/<checkpointId>/` = manifest.json + 按工作区相对路径 1:1 镜像的文件;
 * 清单完整性/损坏隔离一律走 ./manifest-integrity.ts 那一份出口(AGENTS §0.6 单一真相源),本层不复算。
 */

import * as path from 'node:path';
import * as os from 'node:os';
import { assertPathInside, segmentPathInside } from '../util/path-guard.js';
import {
  readManifestChecked,
  type CorruptManifestEntry,
  type ManifestReadResult,
} from './manifest-integrity.js';
import type { CheckpointMeta } from './checkpoint-meta.js';
import { isCheckpointMeta } from './checkpoint-meta.js';

export type { CheckpointMeta, CheckpointDiffEntry } from './checkpoint-meta.js';

/** 会话快照根:`~/.ihui/checkpoints/<sessionId>`(存在与否由调用方的读动作判,不在此处猜) */
export function snapshotRootDir(sessionId: string): string {
  // sessionId 来自 `--session`,与检查点 id 同解:收敛成单段并断言在 checkpoints 根内。
  return segmentPathInside(
    path.resolve(os.homedir(), '.ihui', 'checkpoints'),
    sessionId,
    '会话检查点目录',
  );
}

/** 读某快照目录的清单:missing/corrupt 三态由 manifest-integrity 给,本层只接线(onQuarantined 先于 onCorrupt) */
export function readSnapshotMeta(
  baseDir: string,
  checkpointId: string,
  hooks: { onCorrupt: (entry: CorruptManifestEntry) => void; onQuarantined?: (entry: CorruptManifestEntry) => void },
): ManifestReadResult<CheckpointMeta> {
  // 清单路径是删除/回滚的锚点:根内 + realpath 断言;检查点 id 是内部序列名(含 `@vN`),
  // 不做 sanitize 改写,否则落盘名与 id 不一致。
  const cpDir = assertPathInside(baseDir, path.join(baseDir, checkpointId), '检查点目录');
  const manifestPath = path.join(cpDir, 'manifest.json');
  return readManifestChecked(manifestPath, checkpointId, isCheckpointMeta, (entry) => {
    hooks.onQuarantined?.(entry);
    hooks.onCorrupt(entry);
  });
}

export type { SnapshotRootProbe } from './snapshot-root-io.js';
export {
  probeSnapshotRoot,
  snapshotRootExists,
  ensureHostDir,
  listEntryNames,
  listSubDirNames,
} from './snapshot-root-io.js';

export {
  resolveWorkspaceRelPath,
  copyFilesIntoSnapshot,
  writeSnapshotManifest,
  restoreSnapshotFiles,
  diffSnapshotFiles,
  removeSnapshotDir,
  measureSnapshotBytes,
} from './snapshot-file-io.js';

export type { ChangeIndexRow, ChangeIndexPlan, ChangeDetailPlan, RequestFileTreePlan } from './change-index.js';
export { projectChangeIndex, readChangeDetail, readRequestFileTree } from './change-index.js';
