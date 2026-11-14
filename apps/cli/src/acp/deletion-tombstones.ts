// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * Deletion Tombstones — 删除墓碑 + 迟到写守卫(通用的删除一致性机制)。
 *
 * ## 前提基建(对标 Qoder collaboration_deleted_resources + guard_deleted_* 触发器)
 *
 * Qoder 处理"删除"有一套容易被当成协作产品细节、实则通用的机制:
 *
 *   CREATE TABLE collaboration_deleted_resources (
 *     scope_key TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
 *     PRIMARY KEY(scope_key,source_type,source_id)
 *   );
 *   -- "最小删除标记只阻止迟到写入,不保存对象正文。"
 *   CREATE TRIGGER guard_deleted_collaboration_files_insert BEFORE INSERT ON collaboration_files
 *   WHEN EXISTS(SELECT 1 FROM collaboration_deleted_resources WHERE ...) BEGIN
 *     SELECT RAISE(ABORT,'COLLABORATION_RESOURCE_DELETED'); END;
 *
 * 两个要点(本模块逐条复现):
 *   1. **墓碑只记身份,不保存正文**:删除一个资源时只留 (scope, type, id) 的最小
 *      标记 —— 既表明"这东西已删",又不为已删对象占体积。
 *   2. **迟到写守卫**:任何针对已删对象的 INSERT / UPDATE 都被 ABORT。这解决并发
 *      下的经典竞态 —— 慢写操作在对象被删后才到达,若无守卫会把已删对象"复活"。
 *
 * ## 我方承接点(为什么这是真缺口)
 *
 * 我方持久模块(skill-evolution / agent-inbox / workspace-receipts /
 * subagent-profile-revisions)删除/回收全是**硬删 + filter**,**没有墓碑**。
 * 单写者顺序场景够用;但一旦出现"删除后又有针对同一 id 的迟到写"(并发重投 /
 * 旧回调 / 重放),已删对象会被静默复活。本模块把墓碑 + 守卫抽成可复用层。
 *
 * ## 做减法
 *
 *   - 存储:一个墓碑表 JSON(~/.ihui/tombstones.json),不引 SQLite
 *   - 墓碑只存身份键(scope/type/id),不存正文 —— 对标"最小删除标记"
 *   - 守卫是纯函数 assertNotDeleted(抛 DeletedResourceError),对标 RAISE(ABORT)
 *   - 原子写 + 损坏回落空态(与其余持久模块同处置)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 资源身份键(对标 Qoder (scope_key, source_type, source_id) 三元主键)。 */
export interface ResourceKey {
  /** 命名空间(如技能进化 / inbox / 版本链 …),隔离不同模块的 id。 */
  readonly scope: string;
  /** 资源类型(同一 scope 内可有多类资源)。 */
  readonly type: string;
  /** 资源 id。 */
  readonly id: string;
}

/** 一条墓碑(只记身份 + 删除时刻,不存正文)。 */
export interface Tombstone extends ResourceKey {
  readonly deletedAt: number;
}

/** 针对已删资源的写操作被拒。 */
export class DeletedResourceError extends Error {
  constructor(readonly key: ResourceKey) {
    super(
      `资源已删除,拒绝迟到写:${key.scope}/${key.type}/${key.id}` +
        `(对标 Qoder COLLABORATION_RESOURCE_DELETED)`,
    );
    this.name = 'DeletedResourceError';
  }
}

// ─────────────────────────────────────────────────────────────
// 存储:墓碑表(JSON;只存身份,原子写 + 损坏回落空态)
// ─────────────────────────────────────────────────────────────

const STORE_VERSION = 1;

interface TombstoneFile {
  version: number;
  tombstones: Tombstone[];
}

function storeFile(): string {
  const dir = process.env.IHUI_CLI_TOMBSTONES_DIR
    ? process.env.IHUI_CLI_TOMBSTONES_DIR
    : path.join(os.homedir(), '.ihui');
  return path.join(dir, 'tombstones.json');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function writeJsonAtomic(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** 读全部墓碑。不存在/损坏/版本不符 → 空态(不抛、不静默覆盖)。 */
export function loadTombstones(): Tombstone[] {
  const file = storeFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as TombstoneFile;
    if (raw.version !== STORE_VERSION || !Array.isArray(raw.tombstones)) return [];
    return raw.tombstones;
  } catch {
    return [];
  }
}

function saveTombstones(tombstones: Tombstone[]): void {
  writeJsonAtomic(storeFile(), { version: STORE_VERSION, tombstones } as TombstoneFile);
}

// ─────────────────────────────────────────────────────────────
// 墓碑操作:立碑 / 查碑 / 守卫 / 清碑
// ─────────────────────────────────────────────────────────────

/** 立一座墓碑:标记资源已删除。幂等(重复删同一资源不报错、不重复)。 */
export function markDeleted(key: ResourceKey, now: number = Date.now()): Tombstone[] {
  const all = loadTombstones();
  if (isDeleted(key)) return all; // 已有墓碑,幂等
  all.push({ ...key, deletedAt: now });
  saveTombstones(all);
  return all;
}

/** 查碑:该资源是否已删。 */
export function isDeleted(key: ResourceKey): boolean {
  return loadTombstones().some(
    (t) => t.scope === key.scope && t.type === key.type && t.id === key.id,
  );
}

/** 迟到写守卫:已删则抛 DeletedResourceError(对标 RAISE(ABORT));未删则放行。 */
export function assertNotDeleted(key: ResourceKey): void {
  if (isDeleted(key)) throw new DeletedResourceError(key);
}

/** 清碑:复活/重建已删资源时移除墓碑(显式复活语义)。返回是否清掉了。 */
export function removeTombstone(key: ResourceKey): boolean {
  const all = loadTombstones();
  const kept = all.filter(
    (t) => !(t.scope === key.scope && t.type === key.type && t.id === key.id),
  );
  if (kept.length === all.length) return false; // 本就无墓碑
  saveTombstones(kept);
  return true;
}

/** 批量查碑:一次 load 判多个 key(避免 N 次读盘)。返回已删的 key 子集。 */
export function filterDeleted(keys: readonly ResourceKey[]): ResourceKey[] {
  const tomb = loadTombstones();
  const set = new Set(tomb.map((t) => `${t.scope}\u0000${t.type}\u0000${t.id}`));
  return keys.filter((k) => set.has(`${k.scope}\u0000${k.type}\u0000${k.id}`));
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
