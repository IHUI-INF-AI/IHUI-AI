// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 认领账本(2026-09-26 立)。
 *
 * 内存 Set + 文件持久化双保险:同一条目(key)只允许认领一次。
 * - 内存:进程内即时去重(读内存,零 IO);
 * - 文件:.ihui-agent/tmp/automations-ledger.json(gitignore 目录),
 *   进程重启后仍能认出已认领条目,防止对同一 issue 重复建 PR 刷屏。
 * 文件读写失败不影响内存去重(记 warn 降级为进程内去重)。
 *
 * G-669(2026-10-01 补)加了 release:此前 claim 是**单向门** —— orchestrator 先 claim
 * 再 execute,`ok=false` 永不释放,于是 transient 失败(上游重启、网络抖动)被永久静默丢弃,
 * 报告里也没有 dropped 可以点名。release 让"没结算成功"的条目回到队列,并给每次释放计数:
 * 超过上限就不再释放(否则只是把"永久丢弃"换成"永久重放"另一种无限循环)。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AuditLogger } from './types.js'

/** 同一个 key 最多被释放回队列几次(超过即按终态保留认领,见 release 的注释)。 */
export const MAX_RELEASES_PER_KEY = 5

export interface ClaimLedger {
  /** 尝试认领:首次认领返回 true 并落盘;已认领过返回 false(不重复动作)。 */
  claim(key: string, meta?: { title?: string }): boolean
  /**
   * 释放认领(仅限"本轮认领了但没结算成功"的条目),返回是否真的释放了。
   * - true:条目回到队列,下一轮可重新认领;
   * - false:该 key 本来就没被认领,或释放次数已达 MAX_RELEASES_PER_KEY(保留认领 = 终态)。
   * reason 只进审计与返回值语义,不参与判据(判据是"有没有被认领过"与"释放了几次")。
   */
  release(key: string, reason: string): boolean
  /** 只读判断(不产生认领)。 */
  has(key: string): boolean
  /** 已认领条目数(审计用)。 */
  size(): number
  /** 该 key 已被释放过几次(审计/测试用;未释放过 = 0)。 */
  releaseCount(key: string): number
}

interface LedgerFileShape {
  entries: Record<string, { claimedAt: string; title?: string }>
  /**
   * G-669:key → 已释放次数与最近一次原因/时刻。
   * 旧文件没有这一格 ⇒ loadFile 补空对象(不得因为"上一版文件长这样"就把有界重试判没)。
   */
  releases: Record<string, { count: number; lastReason: string; lastReleasedAt: string }>
}

function loadFile(path: string, audit?: AuditLogger): LedgerFileShape {
  try {
    if (!existsSync(path)) return { entries: {}, releases: {} }
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<LedgerFileShape>
    if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
      return { entries: parsed.entries, releases: parsed.releases ?? {} }
    }
    return { entries: {}, releases: {} }
  } catch (err) {
    // 账本损坏:不阻断主流程,降级为空账本(内存仍去重;文件会在下次认领时重建)
    audit?.warn('[automations] 账本文件读取失败,按空账本降级', { path, err: String(err) })
    return { entries: {}, releases: {} }
  }
}

/** 创建文件 + 内存双保险账本。 */
export function createFileLedger(filePath: string, audit?: AuditLogger): ClaimLedger {
  const memory = new Set<string>()
  let fileState: LedgerFileShape | null = null

  const ensureLoaded = (): LedgerFileShape => {
    if (!fileState) {
      fileState = loadFile(filePath, audit)
      // 文件里已有的条目同步进内存(重启恢复)
      for (const key of Object.keys(fileState.entries)) memory.add(key)
    }
    return fileState
  }

  const persist = (state: LedgerFileShape): void => {
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8')
    } catch (err) {
      // 写盘失败:内存去重仍有效,不抛(认领动作已发生,回滚反而会造成重复回帖)
      audit?.warn('[automations] 账本落盘失败,本轮仅内存去重', { path: filePath, err: String(err) })
    }
  }

  return {
    claim(key, meta) {
      const state = ensureLoaded()
      if (memory.has(key)) return false
      memory.add(key)
      state.entries[key] = { claimedAt: new Date().toISOString(), ...(meta?.title ? { title: meta.title } : {}) }
      persist(state)
      return true
    },
    release(key, reason) {
      const state = ensureLoaded()
      if (!memory.has(key) && state.entries[key] === undefined) return false
      const prior = state.releases[key]
      const count = typeof prior?.count === 'number' && Number.isFinite(prior.count) ? prior.count : 0
      if (count >= MAX_RELEASES_PER_KEY) {
        // 有界重试的"界":不再释放 ⇒ 下一轮仍视为已认领(终态),由调用方在报告里点名原因
        audit?.warn('[automations] 释放次数已达上限,保留认领(终态,不再回队)', {
          key,
          count,
          limit: MAX_RELEASES_PER_KEY,
          reason,
        })
        return false
      }
      memory.delete(key)
      delete state.entries[key]
      state.releases[key] = {
        count: count + 1,
        lastReason: reason,
        lastReleasedAt: new Date().toISOString(),
      }
      persist(state)
      audit?.info('[automations] 已释放认领(回队重试)', { key, count: count + 1, reason })
      return true
    },
    has(key) {
      return ensureLoaded().entries[key] !== undefined
    },
    size() {
      ensureLoaded()
      return memory.size
    },
    releaseCount(key) {
      const state = ensureLoaded()
      const count = state.releases[key]?.count
      return typeof count === 'number' && Number.isFinite(count) ? count : 0
    },
  }
}
