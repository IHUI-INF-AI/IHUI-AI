// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web agreement 页 → 共享 AgreementScreen 视图模型的适配层。
 *
 * 归一化表与 packages/app/src/features/agreement/agreement-type.ts 同源;web 试点经
 * `@ihui/rn-app/pilot` 消费,不改共享屏、不给共享屏加单端 prop,web 独有词表/回退标题
 * 全部在这里拼好后按既有 props 注入。
 */

/** 路由原始 type → 后端 AGREEMENT_TYPES 口径。 */
export const AGREEMENT_TYPE_MAP: Record<string, string> = {
  user: 'user-agreement',
  'user-protocol': 'user-agreement',
  'user-agreement': 'user-agreement',
  privacy: 'privacy-policy',
  'privacy-policy': 'privacy-policy',
  disclaimer: 'disclaimer',
  terms: 'terms-of-service',
  'terms-of-service': 'terms-of-service',
}

/** 归一化路由 type 为 API type(未知值原样透传,由后端校验)。 */
export function normalizeAgreementType(rawType: string): string {
  return AGREEMENT_TYPE_MAP[rawType] ?? rawType
}

const TYPE_TITLE: Record<string, { zh: string; en: string }> = {
  'user-agreement': { zh: '用户协议', en: 'User Agreement' },
  'privacy-policy': { zh: '隐私政策', en: 'Privacy Policy' },
  disclaimer: { zh: '免责声明', en: 'Disclaimer' },
  'terms-of-service': { zh: '服务条款', en: 'Terms of Service' },
}

/**
 * 取数前/取数失败时的标题兜底。保持改造前 web 行为:始终用 zh 文案(TYPE_TITLE.zh),
 * 未知 type 回退路由原始值。
 */
export function agreementFallbackTitle(apiType: string, rawType: string): string {
  return (TYPE_TITLE[apiType] ?? { zh: rawType, en: rawType }).zh
}

/** GET /api/agreements/current 返回体(web 侧既有契约)。 */
export interface AgreementPayload {
  id: string
  title: string
  content: string
  version?: string | null
  effectiveDate?: string | null
  type?: string | null
}

/** 共享屏 AgreementScreen 消费的视图模型(结构对齐 packages/app 的 AgreementContentView)。 */
export interface AgreementContentView {
  title?: string | null
  content: string
  version?: string | null
  effectiveDate?: string | null
}

/** 请求体 → 共享屏视图模型;无数据返回 null(共享屏走 loading/静态兜底分支)。 */
export function toAgreementContentView(
  payload: AgreementPayload | null | undefined,
): AgreementContentView | null {
  if (!payload) return null
  return {
    title: payload.title,
    content: payload.content,
    version: payload.version ?? null,
    effectiveDate: payload.effectiveDate ?? null,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
