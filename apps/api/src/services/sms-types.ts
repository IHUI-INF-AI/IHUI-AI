// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 短信通道的共享类型。
 *  单独一份是因为通道现在有两家(阿里云 / 腾讯云):让其中一家的模块导出这些词汇,
 *  另一家就得反向 import 它,两个服务模块互相引用迟早成环。类型放中间,依赖只朝一个方向走。 */

/** 发码场景。与 routes/auth.ts 的 sendCodeSchema.scene 同一闭集。 */
export type SmsScene = 'register' | 'login' | 'reset' | 'phone-binding'

/** 一次投递的诚实结论。`reason` 只放厂商错误码或配置键名 —— 云侧原文、异常正文与凭据
 *  一律不得进这里(守门 67:它会被调用方拼进对外 message)。
 *  requestId / serialNo 只用于回执对账与审计,不含任何用户内容;缺省不影响既有判据。 */
export interface SmsDeliveryResult {
  sent: boolean
  reason?: string
  requestId?: string
  serialNo?: string
  templateId?: string
}

/** 短信用途分类。验证码(code)与通知/营销分开计数:营销类要受退订黑名单与月度上限约束。 */
export type SmsMessageCategory = 'code' | 'notice' | 'marketing'

/** 腾讯云已报审的通知类模板(固定文案、无变量)。key 与 env 键一一对应,见 sms-tencent.ts。 */
export const SMS_NOTICE_TEMPLATE_KEYS = [
  'binding-success',
  'new-device',
  'password-changed',
  'maintenance',
  'account-cancel',
  'membership-expiry',
  'payment-success',
  'content-reject',
  'security-limit',
  'service-restore',
] as const
export type SmsNoticeTemplateKey = (typeof SMS_NOTICE_TEMPLATE_KEYS)[number]

/** 已报审通过的营销类模板(固定文案、无变量,结尾均含「拒收请回复R」)。
 *  「邀请好友」("invite")已于 2026-10-26 被腾讯云判**永久不可过审**:
 *  运营商监管明确禁止推广拉新类短信,审核意见为「禁止发送推广拉新类短信」。
 *  模板不可修改、不可重投,因此从可选集中移除 —— 留在列表里只会让人反复选中再失败。 */
export const SMS_MARKETING_TEMPLATE_KEYS = ['new-feature', 'promo'] as const
export type SmsMarketingTemplateKey = (typeof SMS_MARKETING_TEMPLATE_KEYS)[number]

export type SmsTemplateKey = SmsNoticeTemplateKey | SmsMarketingTemplateKey

/** 结构化模板发送参数。`fallbackContent` 只在腾讯模板尚未过审、需要回落阿里云通知模板时使用。 */
export interface TemplatedSmsOptions {
  category: 'notice' | 'marketing'
  templateKey: SmsTemplateKey
  /** 阿里云/代理兜底正文(阿里云变量上限 35 字符,过长会被云侧拒发) */
  fallbackContent?: string
  /** 审计用业务标识,不参与发送 */
  bizType?: string
  bizId?: string
  /** 批量任务已自行做过频控时置 true,避免同一号码被两层计数重复扣减 */
  skipRateLimit?: boolean
  /** 仅解析配置、不真发(用于后台预览与不耗额度的联调) */
  dryRun?: boolean
}

export interface TemplatedSmsResult {
  success: boolean
  error?: string
  provider?: 'tencent' | 'aliyun' | 'proxy'
  requestId?: string
  templateId?: string
  /** 同一 bizType+bizId 已发过 ⇒ 本次没有真实发送,但业务上视为成功(幂等)。 */
  deduplicated?: boolean
}

/** 发送失败归类,供调用方选状态码。不得靠 `msg` 文案猜 —— 文案会改,归类不会。 */
type SendCodeFailure = 'rate_limited' | 'delivery_failed'

export interface SendCodeResult {
  success: boolean
  msg: string
  failure?: SendCodeFailure
}

/** 通道选择。缺省 `auto` = 历史行为(阿里云 → 自建代理),不改变任何已配环境的现状。 */
export type SmsProvider = 'auto' | 'aliyun' | 'tencent' | 'proxy'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
