// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 告警正文的文本闸门 —— 唯一实现,scheduler-worker 与 alert-notification-service 共用。
 *
 * 为什么住在这里而不是 worker 里:`pushAlertWithResult` 是**所有**生产者的共同出口,
 * 而闸门只放在某几个生产者头上 = 其余生产者(实测曾漏 `relay-alert-rules-service`
 * 的管理员手填规则名、`notification-worker` 的队列自由文本)照样能把原文寄进人邮箱。
 * 判据与执行层都只认这一份,不得再抄第二套正则(§3、§5c 同一纪律)。
 *
 * 与 monitoring/alertbridge/alert-webhook-bridge.cjs 同一条纪律:
 * 「静默变短」比「变短」更糟 —— 截断必须在正文里点名丢了多少。
 */
import { redactSecrets, redactUserHomePathLiterals } from '@ihui/shared'

/**
 * 单条外部文本进告警正文的字符上限。
 * 取值理由:与 deploy/win/ihui-deploy.ps1:155 的「诊断串 >300 即截断」**同值**,
 * 本仓对"给人读的一行外部诊断"既有上限就是 300,不在这里拍第二个数。
 */
export const ALERT_FIELD_MAX_CHARS = 300

/**
 * 整条告警 message 的字节上限。
 * 取值理由:与 alert-webhook-bridge.cjs 的 MAIL_BODY_MAX_BYTES(20,000 字节)**同值** ——
 * 两侧是同一条到人通道的两个生产者,尺子必须是一把,不得各定一档。
 */
export const ALERT_MESSAGE_MAX_BYTES = 20_000

/** 截断说明自身占的字节预留:预留后追加说明,总长仍 ≤ 上限,上限才是真上限 */
const ALERT_MESSAGE_NOTICE_RESERVE_BYTES = 400

/**
 * 我们自己的错误类型 vs 上游原文。
 * 命中的是本仓 ai-feed-service 里那批固定前缀那一族、JS 错误类名、以及显式枚举的
 * Node 网络错误码;`unknown error` 是我们自己写的字面量,一并算自有。
 * ⚠️ 这个区分**只决定标签,不决定处置**:两种都同样剥控制字符、脱敏、封顶。
 * ⚠️ 默认档是「上游原文」(更严的一侧):判不出来就不猜。
 */
const OWN_ERROR_SHAPE_RE =
  /^(?:(?:DailyHotApi|RSSHub|GitHub API|RSS XML|ModelScope Community|Toutiao HotBoard|fetch failed|unknown error)\b|[A-Z][A-Za-z0-9]*Error\b|ERR_[A-Z0-9_]+\b|ETIMEDOUT\b|ECONNREFUSED\b|ECONNRESET\b|ENOTFOUND\b|EAI_AGAIN\b|EPROTO\b|EHOSTUNREACH\b|ENETUNREACH\b|CERT_[A-Z_]+\b)/

/**
 * 判据以 \uXXXX 的**转义文本**写进源文件,不留任何真实不可见字符:
 * 源文件里看不见的字符既骗过 code review 也骗过 grep —— 而本仓 §5c 的溯源水印
 * 正是靠 U+200B/200C/200D/2060 生存,它们是外部文本能用来藏东西的那一类字符。
 */
const INVISIBLE_TEXT_RE = new RegExp(
  '[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u200b-\\u200d\\u2060\\u2028\\u2029]',
  'g',
)

/** 本函数自己写上的截断告示 —— 认得它,才敢在二次调用时原样交出(见 `flattenUntrustedText`) */
const TRUNCATION_NOTICE_RE = /…\[截断,已丢弃 \d+ 字符\]$/

/** 一行外部文本:剥不可见字符 → 折成单行 → 先脱敏后截断,并点名丢弃量 */
export function flattenUntrustedText(
  raw: unknown,
  maxChars: number = ALERT_FIELD_MAX_CHARS,
): string {
  const flat = String(raw ?? '')
    .replace(INVISIBLE_TEXT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return ''
  /**
   * 已经由本函数截过并标了丢弃量的输出 ⇒ 原样交回。
   * 不这么做会产出一件很坏的事:第二次截断把「已丢弃 100 字符」改写成「已丢弃 16 字符」——
   * 那个数字是上一轮**如实报出来**的,改写它等于用一条新的谎覆盖旧的真话
   * (§5e「静默变短比变短更糟」与 §5c「绝不静默成看起来全绿」同一条禁令)。
   * 2026-09-27 独立复核实测到这一格后补上:此前注释与提交信息都写着"尺子是幂等的",
   * 而对被截断过的输入并不成立 —— **声称与实态分叉比缺口本身更糟**。
   */
  if (TRUNCATION_NOTICE_RE.test(flat)) return flat
  // 脱敏必须在**截断之前**、且用共享层那一份实现(§3:端内不得再建第二套凭据正则):
  // 先截断再脱敏,会让落在边界上的凭据只被切掉一半而剩下可读片段。
  // 用户主目录另有一档:`redactSecrets` 的路径规则是**注入式**的(不传 home/user 就空转),
  // 而告警文本里的堆栈常来自别人的机器 ⇒ 必须用形状匹配那一档才盖得住。
  const safe = redactSecrets(redactUserHomePathLiterals(flat))
  if (safe.length <= maxChars) return safe
  return `${safe.slice(0, maxChars)}…[截断,已丢弃 ${safe.length - maxChars} 字符]`
}

/** 上游错误原文 → 带「自有诊断串 / 上游原文」标签的一行(归一化与封顶同上) */
export function untrustedErrorField(raw: unknown): string {
  const flat = flattenUntrustedText(raw)
  if (!flat) return '[上游原文] (无内容)'
  const kind = OWN_ERROR_SHAPE_RE.test(flat) ? '自有诊断串' : '上游原文'
  return `[${kind}] ${flat}`
}

/**
 * 整条告警正文的字节闸门(纯函数)。按码点累加,不按 UTF-16 索引切 ——
 * 切在代理对中间会产出坏字符,那等于把人要看的那半句也弄坏。
 */
export function capAlertMessage(text: string): string {
  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes <= ALERT_MESSAGE_MAX_BYTES) return text
  const budget = ALERT_MESSAGE_MAX_BYTES - ALERT_MESSAGE_NOTICE_RESERVE_BYTES
  let used = 0
  let cut = 0
  for (const ch of text) {
    const b = Buffer.byteLength(ch, 'utf8')
    if (used + b > budget) break
    used += b
    cut += ch.length
  }
  return (
    text.slice(0, cut) +
    `\n…[正文已达上限 ${ALERT_MESSAGE_MAX_BYTES} 字节,已丢弃 ${bytes - used} 字节;` +
    '被丢弃的明细不在本邮件内,请到告警面板/日志按 source 查看完整批次]'
  )
}

/**
 * 告警正文的**逐行**闸门:行结构必须保住 —— 版式层的 `multiLineHtml` 按换行分段,
 * 用 flattenUntrustedText 处理整条正文会把多条信息压成一坨(那是另一种"静默失真")。
 * 所以:按行剥不可见字符 + 脱敏,再对整条封顶。幂等(已净文本二次处理逐字不变),
 * 因此生产者自己先调用过也不会被这里改坏。
 */
export function sanitizeAlertMessage(text: string): string {
  const perLine = String(text ?? '')
    .split('\n')
    .map((line) => redactSecrets(redactUserHomePathLiterals(line.replace(INVISIBLE_TEXT_RE, ' '))))
    .join('\n')
  return capAlertMessage(perLine)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
