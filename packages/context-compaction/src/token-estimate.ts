// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Token 估算内核(从 index.ts 抽出为叶子模块,供回收/有效性守卫子模块单向依赖)。
//
// 【跨端 BPE 词表:两端目前 NOT 一致 —— 别再把本文件当"等价实现"的样板】
//   本行原文曾写「语义与取值不得偏离:Python 等价实现见 apps/ai-service/app/core/context_compaction.py」,
//   而那个 Python 文件的模块头注同时写着「与 TS 共享包等价」—— **两侧互指对方为等价,
//   却建立在两张不同的词表上**(实测,2026-10-07):
//     · 本文件第 8 行 `import { encode } from 'gpt-tokenizer'` **未指定编码**。该包
//       (gpt-tokenizer ^3.4.0)主入口**实际再导出 `./encoding/o200k_base.js`**
//       (证据:node_modules/gpt-tokenizer/esm/main.js 第 2 行)⇒ 本侧用的是 **o200k_base**。
//     · Python 侧 context_compaction.py:92 是 `tiktoken.get_encoding("cl100k_base")` ⇒ **cl100k_base**。
//   分歧样本(纯 ASCII、无 CJK、无 emoji):"Addition is defined by the successor function."
//   本侧 8 token / Python 侧 9 token。差在 `Add+ition` 这一个合并:
//   o200k 切 ['Addition',…],cl100k 切 ['Add','ition',…]。
//   中文放大得更狠(实测 "上下文压缩模块的跨端一致性判据。" =13 vs 22)。
//
//   ⚠️ 既有 tests/fixtures/parity.json 的 24 条消息在两张表下**逐条同值**,那是**巧合**
//   (整批落在等值子集上、踩不到分歧词),**不能**当"两端一致"的证据。
//
//   机器判据:scripts/check-bpe-encoding-parity.mjs(C1 读两端真实声明解析编码 + C2 实跑两端
//   生产估算器逐值比对 + C3 反向锁防空转),该门当前**判红**。
//   **统一到哪张表是替真实业务选模型,须人拍板** —— 本文件不擅自改成任何一边;
//   改哪边都会同时改动真实估算值(压缩在占比0.88 触发,两端读数不同 ⇒ 同一段上下文
//   可能一边触发压缩、另一边不触发),所以这不是纯注释债,是行为变更,须走评审。
//
// 【两条静默降级路径 —— 一旦触发,两端分歧会进一步扩大(事实陈述,不是 TODO)】
//   以上分歧是"声明层"的。Python 侧还有两条**运行时**降级路径会让实际用的表与声明**脱钩**:
//     · context_compaction.py:94-95 —— tiktoken 加载失败时 fallback 到 **p50k_base**
//       (**第三张表**,既不是 o200k 也不是 cl100k);
//     · context_compaction.py:112 与 :119 —— encode 失败时 fallback 到 `len(text)//4`
//       (完全不是 BPE,是字符数除四的粗估)。
//   这两条都是**静默**的(只 logger.warning/debug,不改返回值、不抛错),所以一旦触发,
//   本侧与 Python 侧的差距会**比上面那条声明层分歧更大**,而且从源码上看不出来。

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

/** 可见正文投影(唯一出口):只有 content,**刻意不含 reasoning**。
 *  摘要 / UI 文案 / 错误信息读这条投影 —— 估算面不得复用它(见 projectForEstimation)。 */
export function projectVisibleBody(message: ChatMessage): string {
  return message.content ?? ''
}

/** reasoning 读不出文本时的哨兵文本(非空 ⇒ 估算必然 > 0)。
 *  纪律:"存在但读不出"不许静默按 0 计 —— 宁可按这段确定文本计,也不许当成"没有"。 */
const UNREADABLE_REASONING_SENTINEL = '[unreadable-reasoning-shape]'

/** 把跨端形状不一的 reasoning 读成文本;空(确实没有)与读不出(有但拿不到文本)是两回事。
 *  本包无 logger、`estimateMessagesTokens` 的返回类型是既有公开契约(15 处消费方),
 *  所以"如实记账"走**计入估算**这一侧而非改返回值形状(票 G-816015 二选一,理由见仓内注释)。 */
function projectReasoningText(reasoning: unknown): string {
  // 确实没有推理通道 ⇒ 空串,不计(与"有但读不出"不同)
  if (reasoning === undefined || reasoning === null) return ''
  if (typeof reasoning === 'string') return reasoning
  if (typeof reasoning === 'number' || typeof reasoning === 'boolean' || typeof reasoning === 'bigint') {
    return String(reasoning)
  }
  if (Array.isArray(reasoning)) {
    if (reasoning.length === 0) return ''
    // 分块形态(Anthropic 的 [{ type: 'text', text }]):逐块递归取文本,拼成一段
    return reasoning.map((block) => projectReasoningText(block)).join('')
  }
  if (typeof reasoning === 'object') {
    const bag = reasoning as Record<string, unknown>
    const text = bag['text'] ?? bag['content'] ?? bag['thinking'] ?? bag['reasoning']
    if (typeof text === 'string') return text
    try {
      const json = JSON.stringify(reasoning)
      // JSON 文本是"这块 reasoning 确实占了上下文"的保守下界(序列化形态会被回送给 provider)
      if (typeof json === 'string' && json.length > 0) return json
    } catch {
      // 循环引用 / 不可序列化 ⇒ 落到哨兵,绝不落回 0
    }
    return UNREADABLE_REASONING_SENTINEL
  }
  // function / symbol 等无法还原为文本的形状
  return UNREADABLE_REASONING_SENTINEL
}

/** 估算面投影(唯一出口):可见正文 + reasoning。只给 token 估算读。
 *
 * 与 projectVisibleBody 是**两条语义**,不是"把 reasoning 并进 content":
 *   - 可见正文投影刻意隐藏 reasoning(进了 UI 文案/记忆/错误信息就是泄漏);
 *   - 估算面必须把它算进去 —— reasoning 真实占用上下文窗口,复用可见正文投影会让
 *     "没有 usage anchor 的那一轮"系统性少算(票 G-816015)。
 * 无 reasoning 时逐字节返回可见正文投影 ⇒ 老行为不变(反向锁)。 */
export function projectForEstimation(message: ChatMessage): string {
  const body = projectVisibleBody(message)
  const reasoning = projectReasoningText(message.reasoning)
  if (reasoning === '') return body
  return body === '' ? reasoning : `${body}\n${reasoning}`
}

/** 估算字符串 token 数(BPE);含图片占位短路。导出供跨端共享。 */
export function estimateTokens(text: string): number {
  return estimateTextWithImagePlaceholders(text)
}

/** 估算消息列表总 token 数(估算面投影 + tool_calls.arguments + tool_call_id + 每条固定开销)
 *  跨端对齐:与 Python 端 estimate_messages_tokens 增量规则一致
 *  (tool_calls 参数计 +TOOL_CALL_OVERHEAD_TOKENS;tool 消息 +TOOL_CALL_OVERHEAD_TOKENS;每消息 +MESSAGE_OVERHEAD_TOKENS)
 *  文本来源是 projectForEstimation(独立估算投影),不是可见正文投影。 */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0
  for (const m of messages) {
    total += MESSAGE_OVERHEAD_TOKENS
    total += estimateTokens(projectForEstimation(m))
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
