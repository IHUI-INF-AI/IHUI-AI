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
/** 非 tool 档用这一把:同样的族,但**留 U+200D(ZWJ)** —— 它是 emoji 家族/国旗序列的合法成分。 */
const INVISIBLE_KEEPING_ZWJ = /[\u200B-\u200C\u200E-\u200F\u2060-\u2064\uFEFF\u00AD]/g

const ZWJ = '‍'
/** emoji 家族/国旗序列的连接符两侧长什么样:两侧都是图画字符 ⇒ 这个 ZWJ 是有语义的,不能动。 */
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u

/** 孤零 ZWJ(两侧不是图画字符)的枚数 —— 本仓水印字母表里的 `‍` 正是这一型。 */
export function countOrphanZwj(text: string): number {
  const cps = Array.from(String(text ?? ''))
  let n = 0
  for (let i = 0; i < cps.length; i++) {
    if (cps[i] !== ZWJ) continue
    const prev = cps[i - 1] || ''
    const next = cps[i + 1] || ''
    if (!(PICTOGRAPHIC.test(prev) && PICTOGRAPHIC.test(next))) n += 1
  }
  return n
}

export function stripOrphanZwj(text: string): string {
  if (typeof text !== 'string' || !text.includes(ZWJ)) return text
  const cps = Array.from(text)
  const kept: string[] = []
  for (let i = 0; i < cps.length; i++) {
    const cur = cps[i] ?? ''
    if (cur === ZWJ) {
      const prev = cps[i - 1] || ''
      const next = cps[i + 1] || ''
      if (!(PICTOGRAPHIC.test(prev) && PICTOGRAPHIC.test(next))) continue
    }
    kept.push(cur)
  }
  return kept.join('')
}

export function countInvisibleForTransport(text: string, keepZwj = false): number {
  const fam = (
    String(text ?? '').match(keepZwj ? INVISIBLE_KEEPING_ZWJ : INVISIBLE_FOR_TRANSPORT) ?? []
  ).length
  return fam + (keepZwj ? countOrphanZwj(text) : 0)
}

export function stripInvisibleForTransport(text: string, keepZwj = false): string {
  if (typeof text !== 'string' || !text) return text
  // 先数后剥:没命中就原样返回同一引用,避免给每条消息都造一份新字符串
  const re = keepZwj ? INVISIBLE_KEEPING_ZWJ : INVISIBLE_FOR_TRANSPORT
  let out = countInvisibleForTransport(text, keepZwj) > 0 ? text.replace(re, '') : text
  // keepZwj 档不是"整枚 ZWJ 免死",而是"只保 emoji 家族里那一枚":
  // 实测水印字母表含 U+200D,而工具输出有一部分按 role:'user' 入历史 ⇒
  // 免死金牌给宽了,转录里 88 枚 ZWJ 就会随请求出去,上游照样回 400。
  if (keepZwj) out = stripOrphanZwj(out)
  return out
}

type TransportShapedMessage = { role: string; content: string | null | undefined }

/**
 * 消息表级出站清洗:**每一档都过**,只有 `tool` 档连 ZWJ 一起剥,其余档留 U+200D
 * (emoji 家族/国旗序列的合法成分,动它会静默改坏可见内容)。
 * 为什么不是"只动 tool 档":载荷不只住在工具结果里 —— `agent.ts:1744` 把工具输出也按
 * `role:'user'` 入历史,`compaction-v2.ts:547` 的上下文摘要是一条非 tool 消息而它带压缩前原文。
 * **但要说清这两条不是那条 400 的充分解释**(2026-11-05 实测):扩到全角色之后再跑一班,
 * 30 次工具调用 / `iterations=10` 仍 `请求包含不合法字符(400)` ⇒ 带毒段仍在射程外,
 * 所以下面那台 env 自查仪器才是回答这条病灶的东西,不是再猜一轮。
 * 全表零命中 ⇒ 返回入参本身(不复制、不重排)。
 * CLI 的三个 provider 出口(`streamChat` 主循环 / `streamChat` 压缩摘要 /
 * `streamOpenAiCompatible`)都在 `messages:` 那一行调它;判据只住本文件,出口不复算(§0.6)。
 */
export function sanitizeMessagesForTransport<T extends TransportShapedMessage>(
  messages: readonly T[],
  label = 'provider',
  extras?: unknown,
): T[] {
  const hit = (m: T): number =>
    typeof m.content === 'string' ? countInvisibleForTransport(m.content, m.role !== 'tool') : 0
  const out: T[] = messages.some((m) => hit(m) > 0)
    ? messages.map((m) =>
        hit(m) > 0
          ? { ...m, content: stripInvisibleForTransport(m.content ?? '', m.role !== 'tool') }
          : m,
      )
    : (messages as T[])
  // 自查仪器(`IHUI_TRANSPORT_AUDIT=1` 才出声,缺省零行为变化):量"序列化前那一刻还剩几枚"。
  // 立因:这条病灶已经被"找到真因"两次而 400 未消,先前所有结论都靠转录旁证;
  // 只有 `sent=0 而 400 仍在` 这一种读数才能把"是不是 messages 这一段带毒"定死。
  if (process.env.IHUI_TRANSPORT_AUDIT) {
    const sum = (arr: readonly T[]): number => arr.reduce((a, m) => a + hit(m), 0)
    // ZWJ 单独一格报数:上一版只报 `sent=0` 就以为"发出去的不含零宽",
    // 而 keepZwj 档下 ZWJ 不计进 `sent` ⇒ 88 枚 ZWJ 堂而皇之出去,仪器全程报绿。
    const zwj = (arr: readonly T[]): number =>
      arr.reduce(
        (a, m) =>
          a +
          (m.role === 'tool' ? 0 : typeof m.content === 'string' ? countOrphanZwj(m.content) : 0),
        0,
      )
    // `extra=` 量的是随请求一起走的其他体(extraBody / tools schema 等):
    // 只有当 `sent=0` 而 400 仍在时,这一格才能把"带毒段在 messages 之外"钉死。
    const extra =
      extras === undefined || extras === null
        ? 0
        : countInvisibleForTransport(JSON.stringify(extras), true)
    process.stderr.write(
      `[transport-audit] exit=${label} msgs=${messages.length} raw=${sum(messages)} sent=${sum(out)} zwj=${zwj(out)} extra=${extra}\n`,
    )
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
