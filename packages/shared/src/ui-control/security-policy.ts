// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// i18n-content-exempt-file: 安全判据正则内含中文检测词，非界面文案，按门规声明豁免 until 2027-04-15
/**
 * @ihui/shared/ui-control/security-policy — 端内 UI 控件注册表的安全判据(跨端单一真相源)
 *
 * 2026-10-17 立。起因:apps/mobile-rn/src/lib/ui-field-registry.ts 与
 * apps/miniapp-taro/src/lib/ui-field-registry.ts 各自写了一份「哪些控件不许暴露给 AI」的
 * 判定,词表**已经漂开**——同一类控件在一端被屏蔽、在另一端对 AI 可见且可执行。
 * 判据是零平台依赖的纯逻辑,按 AGENTS §3(共享层优先)必须下沉;两端只保留
 * 「组件挂载时交出 setValue/onPress/submit 通道」的平台适配部分。
 *
 * 收敛口径 = 两端取并集(宁严勿松):漏放凭据、误触发不可逆操作是不可逆损失,
 * 而多屏蔽一个控件的代价只是 AI 少一个可填项。每条词表下方都记了合并前的实测差异。
 */

/* ────────────────────────── 敏感输入:连快照都不出现 ────────────────────────── */

/**
 * 凭据类输入:密码 / 验证码 / 各类密钥。
 *
 * 合并前差异(2026-10-17 实测):
 * - miniapp 侧独有:pwd、passcode、credential、private key、access key、短信码、密钥、证书
 * - mobile-rn 侧独有:无(其词表是 miniapp 的真子集)
 * ⇒ 合并后 mobile-rn 侧新增屏蔽上述 8 类,这是本次下沉修掉的实质漏洞。
 */
export const SENSITIVE_TEXT_RE =
  /password|passwd|pwd|passcode|secret|credential|api[_\s-]?key|private[_\s-]?key|access[_\s-]?key|密码|验证码|动态码|短信码|校验码|密钥|证书|令牌/i

/**
 * `token` 一词有两种身份:凭据名与**计量单位**。裸判会让「Max Tokens」「tokens 上限」
 * 这类模型参数被当密钥吞掉(AI 侧表现为"这框不存在"),而漏放凭据的代价才是不可逆的,
 * 故 token 只在非计量语境下算敏感。计量语境用词组判据,不靠单字。
 *
 * 两份实现在合并前逐字相同(2026-10-17 核对),直接沿用。
 */
export const TOKEN_WORD_RE = /token/i
export const TOKEN_MEASURE_RE =
  /max[\s_-]*tokens|tokens?\s*(数|量|上限|预算|长度|成本)|上下文(长度|窗口|预算)|每秒|per[\s_-]?second/i

/**
 * 文本判据入口:由各端把 label/placeholder/inputType 拼成的检索串传进来。
 * 各端 spec 结构不同(小程序是属性式、RN 是访问器式),拼接留在端内,本文件只认文本。
 */
export function isSensitiveText(haystack: string): boolean {
  if (SENSITIVE_TEXT_RE.test(haystack)) return true
  return TOKEN_WORD_RE.test(haystack) && !TOKEN_MEASURE_RE.test(haystack)
}

/* ────────────────────────── 破坏性 / 对外发声控件 ────────────────────────── */

/**
 * 一律不进表(比"进表后拒绝执行"更严:模型看不见就不会试)。
 * 价值判断与 invoke 白名单同源:不可逆、花钱、对外发声的一律不代客操作。
 *
 * 合并前差异(2026-10-17 实测),miniapp 侧独有:
 *   解约、退货、充值、续费、分享、转发、发布、发送、举报、登出、重置、
 *   destroy、unsubscribe、transfer、pay(?:ment)?、recharge、share、publish、post、send、report
 * mobile-rn 侧独有:解除、购买
 * ⇒ 合并后 mobile-rn 侧不再把「发布/发送/分享/充值/续费」类按钮交给 AI 触发,
 *   这是本次下沉修掉的第二个实质漏洞。
 */
export const DESTRUCTIVE_TEXT_RE =
  /删除|移除|注销|解约|解除|退款|退货|提现|转账|付款|支付|下单|购买|充值|续费|分享|转发|发布|发送|举报|退出登录|登出|清空|重置|delete|remove|destroy|unsubscribe|refund|withdraw|transfer|pay(?:ment)?|purchase|checkout|recharge|share|publish|post|send|report|logout|sign\s*-?\s*out/i

export function isDestructiveText(label: string): boolean {
  return DESTRUCTIVE_TEXT_RE.test(label)
}

/* ────────────────────────── 快照回传:个人信息打码 ────────────────────────── */

/**
 * 个人信息:仍允许操作(填手机号是正常需求),但 describe 回传的**值**必须打码。
 *
 * 合并前差异(2026-10-17 实测):这份词表与下面的 maskSnapshotValue **只存在于 miniapp 侧**,
 * mobile-rn 侧 snapshotFields 直接回传 spec.value 原值 ⇒ 手机号/邮箱/证件号明文进了 AI 上下文。
 * 下沉后两端一律打码,这是本次修掉的第三个实质漏洞。
 */
export const PII_TEXT_RE =
  /phone|mobile|email|mail|idcard|id[_\s-]?card|passport|手机|电话|邮箱|身份|证件|银行/i

/** describe 回传值的长度上限:超长值截断,别把回传撑爆 */
export const SNAPSHOT_VALUE_MAX = 80

export const MASKED_VALUE = '***'

/**
 * 快照里的字段值:先折叠空白 → 命中个人信息整段打码 → 否则按长度截断。
 * 打码优先于截断:个人信息宁可一点不给,也不给"截断后的半截手机号"。
 */
export function maskSnapshotValue(raw: string, haystack: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  if (PII_TEXT_RE.test(haystack)) return MASKED_VALUE
  return collapsed.length > SNAPSHOT_VALUE_MAX
    ? `${collapsed.slice(0, SNAPSHOT_VALUE_MAX)}…`
    : collapsed
}

/* ────────────────────────── 路由参数打码 ────────────────────────── */

/**
 * 参数**键**命中即打码:路由 params 里常见 token/code/手机号/邮箱,
 * 而 read/describe 只是"给 AI 看现状",打码不损失任何可执行能力。
 *
 * 合并前差异(2026-10-17 实测):mobile-rn 的凭据键多屏蔽 uuid、ticket 两类,
 * miniapp 侧没有 ⇒ 取并集,两端都屏蔽。
 */
export const CREDENTIAL_KEY_RE = /token|password|secret|code|uuid|ticket/i
export const PII_KEY_RE = /phone|mobile|email|idcard|passport|身份/i

/**
 * 路由参数打码。对象/数组/函数一律归一成占位符:
 * 页面参数结构由实现决定,可能裹着用户数据(RN 路由还允许塞回调),序列化出去既无意义也危险。
 *
 * 合并前差异:只有 mobile-rn 侧把 `function` 也归一了,miniapp 侧 `typeof value === 'object'`
 * 漏掉函数 ⇒ 函数值会原样进回传。取更严的一侧。
 */
export function maskParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    if (CREDENTIAL_KEY_RE.test(key) || PII_KEY_RE.test(key)) {
      masked[key] = MASKED_VALUE
      continue
    }
    masked[key] =
      value === null || value === undefined
        ? ''
        : typeof value === 'object' || typeof value === 'function'
          ? '[complex]'
          : value
  }
  return masked
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
