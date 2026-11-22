// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上游失败的中文解释判据层(2026-11-17 立,对标 qoder2api-hub 的「审核拒绝快速失败 + 中文解释」)。
 *
 * 对照的做法是:一旦上游是内容审核拒绝,立刻按**请求级错误**返回(不重试、不换号、不冷却),
 * 并且给用户一句中文说明,免得把"你改一下内容再发"误读成"网关坏了"。
 *
 * 本仓此前只做到前半段(`relay-account-forwarder` 把 400/413/422 归为 request 不罚号),
 * 没做后半段:错误原样透传,用户看到的是上游英文错误体。
 *
 * 三条纪律:
 * - **纯判据**:只吃 (status, bodyText),不碰网络、不查库。
 * - **审核优先于鉴权**:403 既可能是审核也可能是凭证;body 命中审核词才归 audit,
 *   否则按 auth 处理 —— 顺序写死在这里,消费方不得自行改判。
 * - **audit 必须明说不罚号**:这是给用户的承诺,也是给运维的判据(不冷却、不摘号)。
 */

export type UpstreamErrorCategory =
  | 'audit'
  | 'auth'
  | 'rate'
  | 'quota'
  | 'invalid_request'
  | 'too_large'
  | 'not_found'
  | 'server'
  | 'network'
  | 'unknown'

export interface UpstreamErrorExplain {
  category: UpstreamErrorCategory
  /** 给用户看的中文一句话(不含内部实现细节,不泄露上游原文) */
  message_zh: string
  /** 是否应记在账号侧(触发冷却/降级);审核与参数类都不得罚号 */
  penalizes_account: boolean
  /** 是否值得原样重试(参数/审核类重试无意义) */
  retryable: boolean
}

/** 审核相关关键词(大小写不敏感);覆盖主流上游的英文与中文措辞。 */
const AUDIT_PATTERN =
  /content[_ ]?filter|moderation|moderated|safety|sensitive|prohibit|violat|not\s*allowed|policy\s*violation|审核|敏感|违规|不当内容|内容安全/i

/** 额度/计费不足关键词。 */
const QUOTA_PATTERN = /quota|credit|insufficient|balance|余额|额度|积分|欠费|套餐/i

/** 限流关键词。 */
const RATE_PATTERN = /rate[\s_-]*limit|too\s*many\s*requests|throttl|频率|限流|请求过快/i

/**
 * 判定并给中文解释。`status` 传 0 表示"没有 HTTP 状态"(连接失败/抛错)。
 *
 * 判序固定:审核 → 鉴权 → 额度 → 限流 → 参数/超长 → 404 → 5xx → 未知。
 * 审核排在鉴权之前是有意的:上游把审核拒绝常包成 403,先判 auth 会把用户引到"重新登录"这条错路。
 */
export function explainUpstreamError(status: number, bodyText: string): UpstreamErrorExplain {
  const text = typeof bodyText === 'string' ? bodyText : ''
  const hasAudit = AUDIT_PATTERN.test(text)
  const hasQuota = QUOTA_PATTERN.test(text)
  const hasRate = RATE_PATTERN.test(text)

  if (hasAudit) {
    return {
      category: 'audit',
      message_zh: '内容触发上游安全审核,请修改后重试;本次不计入账号失败,也不会冷却或摘除账号。',
      penalizes_account: false,
      retryable: false,
    }
  }

  if (status === 401 || status === 403) {
    return {
      category: 'auth',
      message_zh: '上游拒绝了本账号凭证,已尝试换票;若持续失败该账号需要重新登录或重新导入。',
      penalizes_account: true,
      retryable: false,
    }
  }

  if (hasQuota || status === 402) {
    return {
      category: 'quota',
      message_zh: '上游额度或积分不足,已切换其它可用账号;请及时补充额度。',
      penalizes_account: true,
      retryable: true,
    }
  }

  if (status === 429 || hasRate) {
    return {
      category: 'rate',
      message_zh: '上游限流,已按上游给出的等待时间退避并尝试其它账号;稍后重试即可。',
      penalizes_account: true,
      retryable: true,
    }
  }

  if (status === 413) {
    return {
      category: 'too_large',
      message_zh: '请求体超过上游上限,请缩短输入或减少上下文后再试;本次不计入账号失败。',
      penalizes_account: false,
      retryable: false,
    }
  }

  if (status === 400 || status === 422) {
    return {
      category: 'invalid_request',
      message_zh: '请求参数不被上游接受(如模型不支持该参数),请检查后重试;本次不计入账号失败。',
      penalizes_account: false,
      retryable: false,
    }
  }

  if (status === 404) {
    return {
      category: 'not_found',
      message_zh: '上游没有找到该模型或路径(可能是短时抖动),已做短冷却并尝试其它通道。',
      penalizes_account: false,
      retryable: true,
    }
  }

  if (status >= 500) {
    return {
      category: 'server',
      message_zh: '上游服务异常(5xx),已切尝试其它通道;稍后重试即可。',
      penalizes_account: true,
      retryable: true,
    }
  }

  if (status === 0) {
    return {
      category: 'network',
      message_zh: '无法连接上游(连接中断或超时),已尝试重试与其它通道。',
      penalizes_account: true,
      retryable: true,
    }
  }

  return {
    category: 'unknown',
    message_zh: `上游返回未分类失败(${status}),已如实透传;如反复出现请附带请求 id 排查。`,
    penalizes_account: false,
    retryable: false,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
