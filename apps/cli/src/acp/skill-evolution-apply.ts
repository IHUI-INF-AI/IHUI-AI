// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * Skill Evolution — 执行链:把一条进化提议真正落到技能文件。
 *
 * 这是 `skill-evolution.ts`(提议状态机)的"最后一公里":提议只描述
 * "改什么",本模块负责"怎么改"并保证安全:
 *   1. **baseline 守卫**:落盘前重算技能指纹,不等于提议 baseline ⇒ 拒绝
 *      (技能已漂移,把过期改写盖上去会污染)。这是 hash_invalidated 语义的执行端。
 *   2. **原子写**:临时文件 + rename,防半截写坏技能文件。
 *   3. **闭环推进**:成功落盘后把提议推到 evolved(经状态机校验,非法则抛)。
 *
 * 改写模型:proposedChange 是「整文件内容」,targetPath 是技能目录内相对路径。
 * 选择"整文件覆盖"而非"diff 应用":可自修改技能的进化通常是一次重写某个文件
 * (如 SKILL.md),整文件覆盖语义最简单、最可验证、最容易回滚(覆盖前留 .bak)。
 *
 * 安全:路径经 segmentFilePathInside 收敛进技能目录,防 `../` 逃逸写任意文件。
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  skillContentHash,
  forceEvolve,
  loadStore,
} from './skill-evolution.js';
import {
  isDeleted,
} from './deletion-tombstones.js';

/** 应用结果。 */
export type ApplyOutcome =
  | { ok: true; skillId: string; suggestionId: string; writtenPath: string; backupPath?: string }
  | { ok: false; reason: string; code: 'NO_SUGGESTION' | 'BASELINE_DRIFT' | 'ILLEGAL_STATE' | 'TOMBSTONED' };

/**
 * 把一条提议的内容写到技能文件,并把提议推到 evolved。
 *
 * @param params.skillDir   技能目录(真实安装落点)
 * @param params.targetPath 技能目录内相对路径(如 'SKILL.md')
 * @param params.suggestionId 要应用的提议 id
 * @param params.now        时间戳(测试可注入)
 * @param params.makeBackup 覆盖前是否留 .bak(默认 true)
 */
export function applySuggestion(params: {
  skillId: string;
  skillDir: string;
  targetPath: string;
  suggestionId: string;
  now?: number;
  makeBackup?: boolean;
}): ApplyOutcome {
  const now = params.now ?? Date.now();
  const store = loadStore(params.skillId);
  const suggestion = store.suggestions.find((s) => s.id === params.suggestionId);
  if (!suggestion) {
    return { ok: false, code: 'NO_SUGGESTION', reason: `提议 ${params.suggestionId} 不存在` };
  }

  // ⓪ 墓碑守卫:提议被硬删(compact)后标碑;若其记录被迟到 apply / 重新
  //    propose 复活,这里挡住写——防止"已删资源复活"。对标 Qoder
  //    deletion_blocker:先 assertNotDeleted,再放行后续 baseline/path/状态守卫。
  const tombstone = { scope: 'skill-evolution' as const, type: 'suggestion' as const, id: params.suggestionId };
  if (isDeleted(tombstone)) {
    return {
      ok: false,
      code: 'TOMBSTONED',
      reason: `提议 ${params.suggestionId} 已删除(墓碑),拒绝迟到 apply 复活;如需重建请先 removeTombstone 显式复活`,
    };
  }

  // ① baseline 守卫:技能漂移即拒绝(hash_invalidated 执行端)
  const currentHash = skillContentHash(params.skillDir);
  if (currentHash !== suggestion.baselineHash) {
    return {
      ok: false,
      code: 'BASELINE_DRIFT',
      reason: `技能内容已漂移(提议 baseline ${suggestion.baselineHash.slice(0, 8)}… ≠ 当前 ${currentHash.slice(0, 8)}…),拒绝应用;请先 reconcile`,
    };
  }

  // ② 路径守卫:收敛进技能目录,防 ../ 逃逸写任意文件
  const targetAbs = path.resolve(params.skillDir, params.targetPath);
  const resolvedRoot = path.resolve(params.skillDir);
  if (!targetAbs.startsWith(resolvedRoot + path.sep) && targetAbs !== resolvedRoot) {
    return {
      ok: false,
      code: 'BASELINE_DRIFT',
      reason: `写入目标逃逸技能目录:${params.targetPath}`,
    };
  }

  // ③ 状态守卫:只有 pending/starting/evolving 可被应用(evolved 终态不可重复应用)
  const applicable: readonly string[] = ['pending', 'starting', 'evolving'];
  if (!applicable.includes(suggestion.status)) {
    return {
      ok: false,
      code: 'ILLEGAL_STATE',
      reason: `提议状态 ${suggestion.status} 不可应用(仅 ${applicable.join('/')})`,
    };
  }

  // ④ 原子写(覆盖前按需留 .bak)
  let backupPath: string | undefined;
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  if (params.makeBackup !== false && fs.existsSync(targetAbs)) {
    backupPath = `${targetAbs}.bak`;
    fs.copyFileSync(targetAbs, backupPath);
  }
  const tmp = `${targetAbs}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, suggestion.proposedChange, { encoding: 'utf8' });
  fs.renameSync(tmp, targetAbs);

  // ⑤ 闭环:成功落盘 → 沿主链推进提议到 evolved(经状态机校验,不跳迁)
  try {
    forceEvolve(params.skillId, params.suggestionId, now);
  } catch (err) {
    return {
      ok: false,
      code: 'ILLEGAL_STATE',
      reason: `已写入但推进提议失败:${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    ok: true,
    skillId: params.skillId,
    suggestionId: params.suggestionId,
    writtenPath: targetAbs,
    ...(backupPath !== undefined ? { backupPath } : {}),
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
