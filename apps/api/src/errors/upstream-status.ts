// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 L7648(2026-10-25):上游响应状态 → 对外出栈状态的唯一映射实现。
 *
 * 语义:api 侧鉴权层(authenticate)验过用户会话之后,来自上游
 * (ai-service / LiteLLM / 第三方 LLM / 号池渠道)的 401/403 是"上游凭据错误",
 * 不是"用户会话失效"。若原样以 401 出栈,api-client 只按 isAuthEndpoint 排除,
 * 用户会被带进"你要重新登录"——而真实原因是"别人家的凭据错了"。
 * 真 401 只有 api 自己的鉴权层(plugins/auth.ts 的显式 statusCode 标注)能发。
 *
 * 消费纪律:本函数只用于**失败分支**(调用方已判 !resp.ok / !result.ok);
 * 成功路径的状态码不在映射射程内。
 */

import { ErrorCode } from './codes.js'

/** 上游凭据类状态:LiteLLM/第三方 key 失效(401)或上游侧授权不足(403)。 */
function isUpstreamCredentialStatus(upstreamStatus: number): boolean {
  return upstreamStatus === 401 || upstreamStatus === 403
}

/** 上游凭据失效时的对外 message(不回显上游细节,防泄漏上游 URL/凭据形态)。 */
export const UPSTREAM_AUTH_FAILED_MESSAGE = '上游服务凭据无效,请稍后重试或联系管理员'

export interface UpstreamOutbound {
  /** 对外出栈的 HTTP 状态码(永不 401/403 —— 那两档被读作会话/权限结论)。 */
  status: number
  /** true = 上游凭据类失败被改判,调用方必须换用 UPSTREAM_AUTH_FAILED_MESSAGE + errorCode。 */
  remapped: boolean
}

/**
 * 上游失败状态 → 对外出栈状态:
 *  - 401/403 → 502 + UPSTREAM_AUTH_FAILED(remapped=true);
 *  - 其余 [400,600) 保留原语义(422 校验 / 404 不存在 / 429 限流,前端各有处理);
 *  - 区间外(网络层折叠值/异常值)按 502 兜底(v1-multimodal 既有先例同口径)。
 */
export function mapUpstreamOutbound(upstreamStatus: number): UpstreamOutbound {
  if (isUpstreamCredentialStatus(upstreamStatus)) {
    return { status: ErrorCode.UPSTREAM_AUTH_FAILED.status, remapped: true }
  }
  const status = upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502
  return { status, remapped: false }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
