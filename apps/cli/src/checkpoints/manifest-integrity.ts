// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-671(2026-10-01):checkpoint manifest 的统一读取出口 —— ENOENT 与损坏分流。
 *
 * 旧行为:index.ts / hunks.ts 各自 `catch {}` 静默跳过坏 manifest,损坏件留在原地,
 * 每次扫描都重新踩一遍且无人知情。本出口把三类分开:
 *   - missing:文件不存在(ENOENT)—— 不算损坏,调用方按"无此检查点"处理;
 *   - corrupt:读不了(io-error)/ 解析不了(parse-failed)/ 形状不对(shape-invalid)
 *     —— 损坏件改名隔离为 `manifest.corrupt-<ts>.json`(同目录保留证据,原文件
 *     不再被后续扫描命中),并通过 warn 钩子点名路径 —— 账面必须有名字,不允许静默。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { tryParseJson } from '../util/json.js';

export type CorruptManifestReason = 'io-error' | 'parse-failed' | 'shape-invalid';

export interface CorruptManifestEntry {
  /** 检查点目录名(即原 checkpointId) */
  checkpointId: string;
  /** 隔离前的 manifest 路径 */
  manifestPath: string;
  /** 隔离件路径;rename 失败时为 null(原文件保持原位,detail 说明) */
  quarantinePath: string | null;
  reason: CorruptManifestReason;
  detail: string;
}

export type ManifestReadResult<T> =
  | { status: 'ok'; meta: T }
  | { status: 'missing' }
  | { status: 'corrupt'; entry: CorruptManifestEntry };

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

/** 隔离:manifest.json → manifest.corrupt-<ts>.json(同目录,保留证据)。目标名冲突追加序号。 */
export function quarantineManifest(manifestPath: string): string | null {
  const dir = path.dirname(manifestPath);
  for (let i = 0; i < 100; i++) {
    const suffix = i === 0 ? '' : `-${i}`;
    const dest = path.join(dir, `manifest.corrupt-${Date.now()}${suffix}.json`);
    if (fs.existsSync(dest)) continue;
    try {
      fs.renameSync(manifestPath, dest);
      return dest;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 读 + 校验 + 损坏分流的唯一入口。
 * validate 收窄成功档;其余两态由调用方决定跳过(missing)或记账(corrupt)。
 */
export function readManifestChecked<T>(
  manifestPath: string,
  checkpointId: string,
  validate: (v: unknown) => v is T,
  onCorrupt: (entry: CorruptManifestEntry) => void,
): ManifestReadResult<T> {
  let raw: string;
  try {
    raw = fs.readFileSync(manifestPath, 'utf-8');
  } catch (err) {
    if (isEnoent(err)) return { status: 'missing' };
    const entry: CorruptManifestEntry = {
      checkpointId,
      manifestPath,
      quarantinePath: quarantineManifest(manifestPath),
      reason: 'io-error',
      detail: `manifest 读取失败: ${err instanceof Error ? err.message : String(err)}`,
    };
    onCorrupt(entry);
    return { status: 'corrupt', entry };
  }

  const parsed = tryParseJson(raw);
  if (parsed === undefined) {
    const entry: CorruptManifestEntry = {
      checkpointId,
      manifestPath,
      quarantinePath: quarantineManifest(manifestPath),
      reason: 'parse-failed',
      detail: 'manifest 不是合法 JSON',
    };
    onCorrupt(entry);
    return { status: 'corrupt', entry };
  }

  if (!validate(parsed)) {
    const entry: CorruptManifestEntry = {
      checkpointId,
      manifestPath,
      quarantinePath: quarantineManifest(manifestPath),
      reason: 'shape-invalid',
      detail: 'manifest 形状校验不通过(缺字段/档值非法/schemaVersion 不识别)',
    };
    onCorrupt(entry);
    return { status: 'corrupt', entry };
  }

  return { status: 'ok', meta: parsed };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
