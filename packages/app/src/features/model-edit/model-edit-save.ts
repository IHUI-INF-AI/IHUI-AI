// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ModelEditFieldValues } from '../../types'

/**
 * ModelEdit 保存数据层(2026-11-03 M4 api-B)。
 *
 * 只读真相:web 端没有独立「模型编辑」页,唯一同源写入口是
 * `apps/web/app/(main)/agents/edit/[id]/PageClient.tsx` 的 updateMut ——
 * `PUT /api/agents/:id`,可落库字段为 `price` / `isFree`;表单其余 7 项
 * (分类/部门/收费周期/限时/目标群体/折扣)后端没有对应列,不臆造端点。
 *
 * 本模块只做「表单 → 请求载荷」和「请求结果 → 成功/失败」的判定:
 * 成功态必须由真实请求回来后才产出,失败原样带出,不吞错、不假成功。
 */

export interface ModelEditBillingPayload {
  price: number
  isFree: boolean
}

/** 端点返回形状(@ihui/api-client 的 ApiResult 子集,避免共享包直接依赖端点实现) */
export interface ModelEditUpdateResult {
  success: boolean
  error?: string
}

export type ModelEditSaveOutcome = { ok: true } | { ok: false; error: Error }

/** 表单 → PUT /agents/:agentId 的可落库两列(与 web 编辑页字段名一致) */
export function buildModelEditBillingPayload(
  fields: ModelEditFieldValues,
): ModelEditBillingPayload {
  const isFree = fields.saleType === 'free'
  return {
    price: isFree ? 0 : Number(fields.price) || 0,
    isFree,
  }
}

/**
 * 提交保存。`updateBilling` 由宿主注入真实端点(共享包不直连 api-client)。
 * - 缺 agentId ⇒ 直接失败(带可见原因,不发请求、不弹成功);
 * - 请求 resolve 后按 `success` 判定;
 * - 传输层抛错/业务失败一律 `ok:false`,错误对象带出给宿主上屏。
 */
export async function submitModelEdit(
  updateBilling: (
    agentId: string,
    payload: ModelEditBillingPayload,
  ) => Promise<ModelEditUpdateResult>,
  agentId: string | undefined,
  fields: ModelEditFieldValues,
): Promise<ModelEditSaveOutcome> {
  if (!agentId) {
    return { ok: false, error: new Error('missing agentId') }
  }
  try {
    const result = await updateBilling(agentId, buildModelEditBillingPayload(fields))
    if (!result.success) {
      return { ok: false, error: new Error(result.error || 'save failed') }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
