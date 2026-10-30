// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发布监测端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 * apps/api 侧(prefix `/api`,apps/api/src/routes/index.ts:1066;插件级 authenticate
 * preHandler apps/api/src/routes/publish-routes.ts:370-373):
 *  - GET  /api/publish/monitor/overview?limit   (publish-routes.ts:748-751,query 原样透传)
 *  - POST /api/publish/monitor/verify           (publish-routes.ts:753-755)
 *  - POST /api/publish/monitor/refresh-metrics  (publish-routes.ts:757-759)
 *
 * 信封:三条都是「api 代理原样透传 ai-service body」(publish-routes.ts:263-299),
 * 上游用 _wrap_ok 包成 {code:0,message,data}(apps/ai-service/app/routers/publish.py:78-88),
 * 因此 fetchApi 按标准包络解包,本文件拿到的就是 data 本体:
 *  - overview → { items: MonitorItem[] }(publish.py:1575;limit 1..200 默认 20,publish.py:1520)
 *  - verify   → StyleCheck,已落库(publish.py:1603-1605)
 *  - refresh-metrics → Metrics | null(publish.py:1630-1632,无快照时 latest_metrics 为 null)
 *
 * 与 web 的差异(如实登记):apps/web/app/(main)/publish/monitor/page.tsx:33-36 把返回值
 * 直接当 `{items}` 读、未按包络再解一层,按 HEAD 的后端形状该页 items 恒空(web 侧潜在缺陷);
 * RN 端按真实信封取 data.items,不复刻该偏差。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 样式核验快照(形状同 web MonitorCard.tsx:35-42 与 publish.py 落库结构) */
export interface PublishStyleCheck {
  checked_at: string
  passed: boolean
  issues: string[]
  content_length: number
  images_total: number
  images_loaded: number
}

/** 互动指标快照(web MonitorCard.tsx:44-50) */
export interface PublishMetrics {
  views: number
  likes: number
  comments: number
  shares: number
  collected_at: string
}

/** 监测总览的单行(一篇内容 × 一个平台;web MonitorCard.tsx:52-66) */
export interface PublishMonitorItem {
  task_id: string
  title: string
  platform: string
  account_id: number | null
  /** publish_tasks.status:success / failed / running / pending / partial / skipped */
  status: string
  published_url: string | null
  platform_content_id: string | null
  created_at: string | null
  finished_at: string | null
  last_error: string | null
  resubmit_count: number
  style_check: PublishStyleCheck | null
  metrics: PublishMetrics | null
}

export interface PublishMonitorOverview {
  items: PublishMonitorItem[]
}

/** GET /api/publish/monitor/overview —— web 同参数 limit=20(page.tsx:34) */
export async function getPublishMonitorOverview(
  limit = 20,
): Promise<ApiResult<PublishMonitorOverview>> {
  return fetchApi<PublishMonitorOverview>('/api/publish/monitor/overview', { params: { limit } })
}

/** POST /api/publish/monitor/verify —— 入参只有 task_id(web MonitorCard.tsx:155-158) */
export async function verifyPublishStyle(taskId: string): Promise<ApiResult<PublishStyleCheck>> {
  return fetchApi<PublishStyleCheck>('/api/publish/monitor/verify', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId }),
  })
}

/** POST /api/publish/monitor/refresh-metrics —— 采集后回传最新快照(可能为 null) */
export async function refreshPublishMetrics(
  taskId: string,
): Promise<ApiResult<PublishMetrics | null>> {
  return fetchApi<PublishMetrics | null>('/api/publish/monitor/refresh-metrics', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId }),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
