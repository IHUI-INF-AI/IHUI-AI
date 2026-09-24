// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Token 估算内核(从 index.ts 抽出为叶子模块,供回收/有效性守卫子模块单向依赖)。
// 语义与取值不得偏离:Python 等价实现见 apps/ai-service/app/core/context_compaction.py。

import { encode } from 'gpt-tokenizer'

import type { ChatMessage, ChatMessageToolCall } from './types.js'

// ==================== Token 估算开销常量(2026-09-02 跨端对齐) ====================
/** 单条消息固定开销(role/name 分隔),与 OpenAI/Anthropic 协议一致 */
export const MESSAGE_OVERHEAD_TOKENS = 4
/** 单条 tool_call 的固定 JSON 协议开销(name/arguments 包装) */
export const TOOL_CALL_OVERHEAD_TOKENS = 4
/** 多模态图片占位估算(每张图按 OpenAI low-detail ~85 tokens、high-detail ~170 tokens 的中位值取整);
 *  对超大 base64 数据 URI,避免对整段 base64 做 BPE(慢且虚高) */
export const IMAGE_TOKEN_PLACEHOLDER = 1200

/** data:image/...;base64,XXX 多模态图片占位正则(全局) */
const DATA_IMAGE_RE = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g

/** 估算字符串 token 数,自动替换 base64 图片为固定占位(避免巨串 BPE) */
function estimateTextWithImagePlaceholders(text: string): number {
  if (!text) return 0
  // 命中图片时:每张图占 IMAGE_TOKEN_PLACEHOLDER,其余文本正常 BPE
  if (DATA_IMAGE_RE.test(text)) {
    DATA_IMAGE_RE.lastIndex = 0
    let total = 0
    let lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = DATA_IMAGE_RE.exec(text)) !== null) {
      if (m.index > lastIndex) {
        total += encode(text.slice(lastIndex, m.index)).length
      }
      total += IMAGE_TOKEN_PLACEHOLDER
      lastIndex = m.index + m[0].length
    }
    if (lastIndex < text.length) {
      total += encode(text.slice(lastIndex)).length
    }
    return total
  }
  return encode(text).length
}

/** 估算单条 tool_call 的 token(id+type+name+arguments + 固定开销) */
function estimateToolCallTokens(tc: ChatMessageToolCall): number {
  if (!tc || typeof tc.id !== 'string') return 0
  const inner =
    tc.id +
    (typeof tc.type === 'string' ? tc.type : '') +
    (tc.function && typeof tc.function.name === 'string' ? tc.function.name : '') +
    (tc.function && typeof tc.function.arguments === 'string' ? tc.function.arguments : '')
  return estimateTextWithImagePlaceholders(inner) + TOOL_CALL_OVERHEAD_TOKENS
}

/** 估算字符串 token 数(BPE);含图片占位短路。导出供跨端共享。 */
export function estimateTokens(text: string): number {
  return estimateTextWithImagePlaceholders(text)
}

/** 估算消息列表总 token 数(content + tool_calls.arguments + tool_call_id + 每条固定开销)
 *  跨端对齐:与 Python 端 estimate_messages_tokens 增量规则一致
 *  (tool_calls 参数计 +TOOL_CALL_OVERHEAD_TOKENS;tool 消息 +TOOL_CALL_OVERHEAD_TOKENS;每消息 +MESSAGE_OVERHEAD_TOKENS) */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0
  for (const m of messages) {
    total += MESSAGE_OVERHEAD_TOKENS
    total += estimateTokens(m.content ?? '')
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        total += estimateToolCallTokens(tc)
      }
    }
    if (m.role === 'tool' && typeof m.tool_call_id === 'string' && m.tool_call_id) {
      total += TOOL_CALL_OVERHEAD_TOKENS
    }
  }
  return total
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
