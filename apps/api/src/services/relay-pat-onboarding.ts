// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PAT 一键引导层(2026-11-18 立)。
 *
 * 立因:Qoder 官方 SDK 只认 PAT(本仓 scripts/qoder-sdk-chat-probe.mjs 实证),
 * 但"去哪拿、粘什么形态、粘完算不算成功"这三件事此前散在人脑里:运营拿错票形、
 * 或者粘对了却以为没生效。本层把它固化成**可查询的引导计划 + 形态判据 + 结果判定**。
 *
 * 纪律:
 *   · 形态通过 ≠ 有效 —— 只有真实调用通过才算有效(判据 `judgePatProbeResult`);
 *   · 本层不校验、不回显、不比较票值(只判"像不像一枚票"与状态码语义);
 *   · 拿不到输入(未粘/未调用)一律 `unjudged`,不冒绿不冒红。
 */

export type PatStepState = 'done' | 'todo' | 'warn'
export interface PatStep {
  id: string
  title: string
  hint: string
  state: PatStepState
}

export interface PatPlan {
  issuanceUrl: string | null
  tokenShape: { looksValid: boolean; reason: string }
  steps: PatStep[]
  /** 一句话结论 */
  verdict: string
}

/** PAT 形态判据(只看形态,不判有效性) */
export function inspectPatShape(raw: unknown): { looksValid: boolean; reason: string } {
  const original = typeof raw === 'string' ? raw : ''
  const s = original.trim()
  if (!s) return { looksValid: false, reason: '未粘贴内容:先到官方集成页生成一枚 PAT' }
  if (original !== s) return { looksValid: false, reason: '首尾含空白字符:复制时多带了空格或换行,请重新复制纯票串' }
  if (/\s/.test(s)) return { looksValid: false, reason: '中间含空白字符:票串不该有空格,请检查是否被编辑器折行' }
  if (s.length < 16) return { looksValid: false, reason: `长度 ${s.length} 偏短:正常 PAT 长于 16 位,可能只复制了片段` }
  if (s.length > 512) return { looksValid: false, reason: `长度 ${s.length} 异常:可能把整页内容都粘进来了` }
  if (!/^[A-Za-z0-9._~+/=-]+$/.test(s)) return { looksValid: false, reason: '含非法字符:票串应为字母数字与 . _ ~ + / = - 之一' }
  return { looksValid: true, reason: '形态通过(注意:形态通过不等于有效,生效与否看真实调用)' }
}

/**
 * 生成引导计划。issuanceUrl 由能力表传入(单源),本层不内置域名。
 */
export function planPatOnboarding(input: { issuanceUrl?: string | null; pastedToken?: unknown; enabled?: boolean }): PatPlan {
  const shape = inspectPatShape(input.pastedToken)
  const issuanceUrl = input.issuanceUrl?.trim() ? input.issuanceUrl.trim() : null

  const steps: PatStep[] = [
    {
      id: 'open-issuance',
      title: '打开官方集成页生成 PAT',
      hint: issuanceUrl ? `在 ${issuanceUrl} 生成一枚 PAT(不要用账号密码或设备票代替)` : '能力表未登记生成入口:先补 issuanceUrl,否则用户不知道去哪拿票',
      state: issuanceUrl ? 'done' : 'warn',
    },
    {
      id: 'paste-token',
      title: '粘贴纯票串',
      hint: shape.looksValid ? '形态已通过,进入下一步验证' : shape.reason,
      state: shape.looksValid ? 'done' : 'todo',
    },
    {
      id: 'probe-once',
      title: '做一次真实调用验证',
      hint: '形态通过不等于有效:用一次最小请求核对,只有上游返回成功才算生效',
      state: shape.looksValid ? 'todo' : 'todo',
    },
    {
      id: 'enable',
      title: '确认后启用',
      hint: '新入池的账号默认停用;验证通过再启用,避免把坏票放进调度',
      state: input.enabled === true ? 'done' : 'todo',
    },
  ]

  const verdict = !issuanceUrl
    ? '缺生成入口:先补能力表的 issuanceUrl'
    : !shape.looksValid
      ? `票形未过:${shape.reason}`
      : input.enabled === true
        ? '票形通过且已启用(若曾验证失败请先停用)'
        : '票形通过,待在真实调用上验证后再启用'

  return { issuanceUrl, tokenShape: shape, steps, verdict }
}

/**
 * 验证结果判定:只有上游成功才算有效。
 */
export function judgePatProbeResult(input: {
  httpStatus?: number | null
  bodyText?: string | null
}): { state: 'valid' | 'invalid' | 'unjudged'; reason: string } {
  const status = typeof input.httpStatus === 'number' ? input.httpStatus : null
  if (status === null) return { state: 'unjudged', reason: '没有拿到状态码:未发起或未记录,不能判' }
  if (status >= 200 && status < 300) return { state: 'valid', reason: `上游 ${status}:PAT 生效` }
  if (status === 401 || status === 403) return { state: 'invalid', reason: `上游 ${status}:票被判无效(过期/无权限/不是 PAT)` }
  if (status === 429) return { state: 'unjudged', reason: '上游 429 限流:无法区分票本身有效性与配额,需稍后重试' }
  if (status >= 500) return { state: 'unjudged', reason: `上游 ${status} 服务端错误:与票无关,不能据此判票无效` }
  const text = typeof input.bodyText === 'string' ? input.bodyText.slice(0, 200) : ''
  return { state: 'unjudged', reason: `上游 ${status} 非鉴权类状态:${text || '无正文'} —— 不据此判票` }
}

export const __test__ = { inspectPatShape }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
