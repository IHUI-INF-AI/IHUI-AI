// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D36 桶配额的 web 侧编排:touch 索引 → 计划淘汰 → 真删超配额桶 → 回写索引。
 * 判据全在 @ihui/shared/chat/prompt-drafts(纯函数),这里只做 localStorage 接线,
 * 草稿 hook 与历史 hook 共用同一份(两处各抄一遍排序/前缀语义必漂移,本仓记过多次)。
 */

import {
  PROMPT_BUCKET_INDEX_KEY,
  parsePromptBucketIndex,
  planPromptBucketEviction,
  touchPromptBucket,
  type PromptBucketIndex,
} from '@ihui/shared/chat/prompt-drafts'

/** 可注入存储(单测用内存假件;缺省 localStorage)。 */
export interface BucketStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): BucketStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * 记一次桶写入并按族配额淘汰最旧桶。返回被淘汰的 key 列表(调用方可忽略;单测消费)。
 * 任何存储异常一律吞掉(隐私模式 / 配额)—— 草稿面从不该因存储故障打断输入。
 */
export function touchAndEvictBuckets(
  prefix: string,
  key: string,
  opts: { storage?: BucketStorage | null; now?: number } = {},
): string[] {
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage
  if (!storage) return []
  const now = opts.now ?? Date.now()
  try {
    const base: PromptBucketIndex = parsePromptBucketIndex(storage.getItem(PROMPT_BUCKET_INDEX_KEY))
    const touched = touchPromptBucket(base, key, now)
    const evict = planPromptBucketEviction(touched, prefix)
    for (const k of evict) {
      try {
        storage.removeItem(k)
      } catch {
        // 单桶删除失败不影响其余淘汰与索引回写
      }
      delete touched[k]
    }
    storage.setItem(PROMPT_BUCKET_INDEX_KEY, JSON.stringify(touched))
    return evict
  } catch {
    return []
  }
}
