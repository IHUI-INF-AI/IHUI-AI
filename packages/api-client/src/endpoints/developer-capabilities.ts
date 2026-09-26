// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 开发者「能力目录」面板所需的端点封装(O15)。
 *
 * 设计约束:
 * - 能力目录本身**不走 HTTP** —— 单一事实源是 `@ihui/types` 的 `capability-catalog.ts`
 *   (机器可读产物 `packages/types/generated/capabilities.json` 由同一份导出),
 *   前端直接 import 常量,避免"文档与运行时两套真相"。
 * - 本文件只补两件事:① key 级配额字段(窗口上限 / IP 名单)的**完整类型**;
 *   ② 真实存在但 api-client 尚无封装的 `GET /api/developer/api-keys/:id/usage`。
 * - 不重复实现 `GET /api/developer/api-keys` —— 复用 `./developer` 的 `getDeveloperApiKeys`。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { getDeveloperApiKeys, type DeveloperApiKeyItem } from './developer.js'

/**
 * 5h / 1d / 7d 窗口**上限**(调用次数的天花板)。
 * 后端 `SafeApiKey` 已随列表返回;`null` = 该窗口未设上限。
 * 注意:后端只暴露上限,**不暴露窗口内已用量**(无对应只读端点),
 * 因此界面必须显式标注"暂无数据",不得用 0 冒充已用量。
 */
export interface DeveloperKeyWindowLimits {
  rateLimit5h: number | null
  rateLimit1d: number | null
  rateLimit7d: number | null
}

/** IP / 模型白名单与黑名单(同样是 key 级配置,非用量)。
 * 注:后端 response-sanitizer 对字段名含 "token" 的子串做脱敏,
 * `maxTokensPerReq` 会被遮蔽成 '***',故此处不声明(避免类型与运行时不符)。 */
export interface DeveloperKeyAccessControls {
  allowedIps: string[] | null
  blockedIps: string[] | null
  allowedModels: string[] | null
}

/** 列表项全量形态:`DeveloperApiKeyItem` 是后端 `SafeApiKey` 的子集,此处补齐配额面。 */
export type DeveloperApiKeyWithQuota = DeveloperApiKeyItem &
  DeveloperKeyWindowLimits &
  DeveloperKeyAccessControls

/**
 * 我的 key(含配额字段)。
 * 复用 `getDeveloperApiKeys()` 的同一次请求,只做类型加宽:
 * 后端 SELECT 列表(`developer-api-keys-service.ts#listKeys`)本就返回这些列。
 */
export async function listDeveloperApiKeysWithQuota(): Promise<
  ApiResult<{ list: DeveloperApiKeyWithQuota[] }>
> {
  const result = await getDeveloperApiKeys()
  if (!result.success) return result
  return {
    ...result,
    data: { list: result.data.list as DeveloperApiKeyWithQuota[] },
  }
}

/** `GET /api/developer/api-keys/:id/usage` 的真实返回(由 api_logs 聚合)。 */
export interface DeveloperApiKeyUsage {
  callCount: number
  lastUsedAt: string | null
  topEndpoints: Array<{ path: string; method: string; count: number }>
}

/** 单把 key 的调用量统计。 */
export async function getDeveloperApiKeyUsage(
  keyId: string,
): Promise<ApiResult<DeveloperApiKeyUsage>> {
  return fetchApi<DeveloperApiKeyUsage>(`/api/developer/api-keys/${keyId}/usage`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
