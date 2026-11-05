// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 传输前的不可见字符剥离(单一出口,2026-11-05 立)。
 *
 * 立因(现读实测,链路完整):本仓源文件带三层溯源水印,其 L2/L3 载荷是**零宽字符**
 * (AGENTS §5c 的设计目的正是"文件层面可 forensic、肉眼不可见")。自主派发环的会话用
 * `read_file` 读源文件时,这些载荷原样进上下文 —— 刚测的一份失败转录里
 * **2426 个零宽字符、全部落在 5 行 `tool_result` 上**(prompt 文件 0 个)。
 * 下一趟请求 provider 直接 `400 请求包含不合法字符`,CLI 重试 3 次全败 ⇒ `exit 1` ⇒
 * 台账记 `session-failed`。也就是:**任何读了水印第枚文件的自治会话都会自毒**,
 * 这是本仓 `artifact-committed` 长期为 0 的一条结构性成因(不是模型偷懒,也不是权限)。
 *
 * 为什么只剥 `tool` 档:实测零宽只来自工具结果;U+200D(ZWJ)是 emoji 家族的合法成分,
 * 对用户文本动刀会静默改坏可见内容。方向是"最小切口治真实病灶",不是"顺手扫干净"。
 *
 * 为什么在出口做而不是在文件侧:磁盘上的水印是取证资产(§5c 明令不得文本级批量改写),
 * 转录里的原始证据也必须保持原样(可追责);只有**发往 provider 的那一份**不该携带
 * 对模型零语义、对传输有害的码点。
 */
const INVISIBLE_FOR_TRANSPORT = /[\u200B-\u200F\u2060-\u2064\uFEFF\u00AD]/g

/** 本次剥掉的字符数(调用方可据此留痕;0 = 未改动)。 */
export function countInvisibleForTransport(text: string): number {
  return (String(text ?? '').match(INVISIBLE_FOR_TRANSPORT) ?? []).length
}

export function stripInvisibleForTransport(text: string): string {
  if (typeof text !== 'string' || !text) return text
  // 先数后剥:没命中就原样返回同一引用,避免给每条消息都造一份新字符串
  return countInvisibleForTransport(text) > 0 ? text.replace(INVISIBLE_FOR_TRANSPORT, '') : text
}

type TransportShapedMessage = { role: string; content: string | null | undefined }

/**
 * 消息表级出站清洗:**只动 `tool` 档**,其余角色逐字保留。
 * 全表零命中 ⇒ 返回入参本身(不复制、不重排)。
 * CLI 的三个 provider 出口(`streamChat` 主循环 / `streamChat` 压缩摘要 /
 * `streamOpenAiCompatible`)都在 `messages:` 那一行调它;判据只住本文件,出口不复算(§0.6)。
 */
export function sanitizeMessagesForTransport<T extends TransportShapedMessage>(
  messages: readonly T[],
): T[] {
  const dirty = messages.some(
    (m) => m.role === 'tool' && countInvisibleForTransport(m.content ?? '') > 0,
  )
  if (!dirty) return messages as T[]
  return messages.map((m) =>
    m.role === 'tool' ? { ...m, content: stripInvisibleForTransport(m.content ?? '') } : m,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
