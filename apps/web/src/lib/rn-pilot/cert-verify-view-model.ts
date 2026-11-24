// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 证书验证页 → 共享 CertVerifyScreen 视图模型的适配层。
 *
 * 取数契约保持改造前 web 现读:`GET /certificates/verify?no=`(web 既有参数名),
 * 响应 `{ certificate: { certNo, title, holderName, issueDate, status } }`。该响应
 * **没有颁发机构**,改造前 web 也不展示来源行 —— 共享屏把 `issuer` 改为可选后,
 * web 不传即省略整行。`certNo` 由共享屏新增展示位承载(web 侧原本就在展示)。
 */

import type { TFunction } from '@ihui/types'
import type { CertVerifyResult } from '@ihui/rn-app/pilot'

/** `GET /certificates/verify?no=` 响应中的证书行(web 侧既有契约)。 */
export interface WebCertRow {
  certNo: string
  title: string
  holderName: string | null
  issueDate: string | null
  status: number
}

/** 共享词条全键 → web `certVerify` 命名空间相对键。 */
const SHARED_KEY_TO_PAGE: Record<string, string> = {
  'certVerify.title': 'title',
  'certVerify.certNo': 'certNo',
  'certVerify.placeholder': 'certNoPlaceholder',
  'certVerify.verify': 'verifyBtn',
  'certVerify.valid': 'verified',
  'certVerify.invalid': 'notFound',
  'certVerify.holder': 'holderName',
  'certVerify.issuedAt': 'issueDate',
}

/**
 * 共享 TFunction 的文案注入:业务词条走 web 既有 `certVerify` 词表。
 *
 * `certVerify.issuer` 与两个 `common.*` 在 web 词表里没有对应键;本页不注入
 * `issuer`(响应里就没有),因此该键不可达,仅给出中文兜底以免传空。
 */
export function createCertVerifyT(t: (key: string) => string): TFunction {
  return (key) => {
    if (key === 'certVerify.issuer') return '颁发机构'
    if (key === 'common.back') return '返回'
    if (key === 'common.loading') return '加载中...'
    const mapped = SHARED_KEY_TO_PAGE[key]
    return mapped ? t(mapped) : key
  }
}

/** 证书行 → 共享屏结果卡片。`issuer` 不注入 ⇒ 来源行不渲染。 */
export function toCertResult(row: WebCertRow): CertVerifyResult {
  return {
    valid: true,
    certNo: row.certNo,
    title: row.title,
    holder: row.holderName ?? '',
    issuedAt: row.issueDate ? row.issueDate.slice(0, 10) : '',
  }
}

/**
 * 未找到/请求失败 → 共享屏无效卡片。
 *
 * 改造前 web 的 notfound 分支带副标题「请核对证书编号后重试」;共享屏无效卡片只有
 * 标题位。标题文案经 `certVerify.invalid → notFound` 注入,副标题与图标为功能退让。
 */
export const CERT_NOT_FOUND_RESULT: CertVerifyResult = {
  valid: false,
  title: '',
  holder: '',
  issuedAt: '',
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
