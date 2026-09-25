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
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AuditLogger } from './types.js'

export interface ClaimLedger {
  /** 尝试认领:首次认领返回 true 并落盘;已认领过返回 false(不重复动作)。 */
  claim(key: string, meta?: { title?: string }): boolean
  /** 只读判断(不产生认领)。 */
  has(key: string): boolean
  /** 已认领条目数(审计用)。 */
  size(): number
}

interface LedgerFileShape {
  entries: Record<string, { claimedAt: string; title?: string }>
}

function loadFile(path: string, audit?: AuditLogger): LedgerFileShape {
  try {
    if (!existsSync(path)) return { entries: {} }
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<LedgerFileShape>
    if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
      return { entries: parsed.entries }
    }
    return { entries: {} }
  } catch (err) {
    // 账本损坏:不阻断主流程,降级为空账本(内存仍去重;文件会在下次认领时重建)
    audit?.warn('[automations] 账本文件读取失败,按空账本降级', { path, err: String(err) })
    return { entries: {} }
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
    has(key) {
      return ensureLoaded().entries[key] !== undefined
    },
    size() {
      ensureLoaded()
      return memory.size
    },
  }
}
