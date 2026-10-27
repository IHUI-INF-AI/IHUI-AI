// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 扫码登录会话的协议同意判据 —— **唯一真相源**。
 *
 * 扫码 tab 不触发"提交"动作,共享 LoginForm 的协议弹窗原本只在提交时弹,
 * 于是访客停在扫码面板 = 从未同意条款,扫完直接换到 token。
 *
 * 同意状态只落一处:PC 端生成二维码时由 `/auth/qr/generate` 写入 Redis 会话
 * (`QrLoginState.agreementAccepted`)。扫码确认(`/auth/qr/confirm`)与发放
 * token(`/auth/qr/status`)都必须经本函数判定,不得在任一端点旁再写一份
 * `=== true`。缺省 / 脏值一律按未同意处理(fail-closed)—— 旧版本遗留的
 * pending 票据因此无法再换取 token。
 */

/** 未同意条款的机器可判错误码(HTTP 403 的 errorCode 字段)。 */
export const QR_AGREEMENT_REQUIRED = 'QR_AGREEMENT_REQUIRED'

/** 判据只依赖这一个字段;其余会话字段不参与。 */
export interface QrAgreementState {
  agreementAccepted?: boolean
}

/** 该扫码登录会话是否已同意用户协议与隐私政策。 */
export function isQrSessionAgreed(state: QrAgreementState | null | undefined): boolean {
  return state?.agreementAccepted === true
}
