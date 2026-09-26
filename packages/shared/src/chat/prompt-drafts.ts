// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​⁠

/**
 * D36 输入草稿 — 共享层纯逻辑(截断上限 / 安全读取 / 防抖常量)。
 *
 * key 分桶由调用方决定(hook 消费 draftKey 字符串,与 prompt-history 同形);
 * 平台特有部分(localStorage / React 状态)留在各端 hook,不进共享层。
 * 契约以 apps/web/src/hooks/use-prompt-drafts.ts 及其测试为准。
 */

/** 输入变化防抖写入窗口(尾沿,ms) */
export const PROMPT_DRAFT_WRITE_DEBOUNCE_MS = 500

/** 草稿落盘上限(字符):超长截断而非拒存,配额内保最长可用前缀 */
export const PROMPT_DRAFT_MAX_LENGTH = 20000

/** 落盘前截断:非字符串输入兜空串,绝不抛错 */
export function truncatePromptDraft(text: string): string {
  if (typeof text !== 'string') return ''
  return text.length > PROMPT_DRAFT_MAX_LENGTH ? text.slice(0, PROMPT_DRAFT_MAX_LENGTH) : text
}

/** 草稿安全读取:缺失 / 非字符串一律空串,绝不抛错(存储值即纯文本,无 JSON 包裹) */
export function parsePromptDraft(raw: string | null): string {
  return typeof raw === 'string' ? raw : ''
}
