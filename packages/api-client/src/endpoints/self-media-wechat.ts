// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公众号文章流水线端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 * apps/api 侧(均已注册,prefix `/api`,apps/api/src/routes/index.ts:1064;
 * 插件级 authenticate preHandler apps/api/src/routes/self-media-routes.ts:87-95):
 *  - POST /api/self-media/wechat/generate  (self-media-routes.ts:115-117)
 *  - POST /api/self-media/wechat/validate  (self-media-routes.ts:119-121)
 *  - POST /api/self-media/wechat/publish   (self-media-routes.ts:123-125)
 *  - GET  /api/self-media/wechat/history?limit (self-media-routes.ts:127-131)
 *
 * 信封:api 层 proxyToAiService 原样透传上游 body(self-media-routes.ts:67-83),
 * ai-service 这三条 POST 返回**裸 JSON**(无 {code,message,data} 包装):
 *  - generate → { ok, returncode, mdPath, stdout, stderr, duration_ms, dryRun }
 *    (apps/ai-service/app/routers/self_media.py:539-547)
 *  - validate → { ok, returncode, stdout, stderr }(self_media.py:569-574)
 *  - publish  → { ok, returncode, stdout, stderr, dryRun }(self_media.py:621-627)
 *  - history  → { items, count }(self_media.py:630-634)
 * 裸 JSON 在 fetchApi 里整包视作 data(packages/api-client/src/client.ts:807-815),
 * 所以下列函数不做二次解包;失败仅来自 HTTP 非 2xx / 网络层。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** GET /api/self-media/wechat/history → items[](self_media.py:282-308 序列化后形状) */
export interface WechatHistoryItem {
  id: string
  category: string
  title: string
  /** generated / published / failed(self-media-routes.ts:40) */
  status: string
  draftId: string | null
  topicKeyword: string | null
  payload: {
    title?: string
    digest?: string
    mdPath?: string
    cover?: string
    topic?: string
  } | null
  createdAt: string | null
  updatedAt: string | null
}

export interface WechatHistoryResult {
  items: WechatHistoryItem[]
  count: number
}

/** 三条 POST 的共同返回体(publish 无 mdPath、validate 无 mdPath/dryRun) */
export interface WechatRunResult {
  ok: boolean
  /** 脚本退出码(publish/validate/generate 同字段) */
  returncode?: number
  /** 仅 generate:落盘的 md 路径(self_media.py:542) */
  mdPath?: string
  /** 脚本 stdout 末 6000 字符;validate 里是 22 项自检 JSON(self_media.py:565-566) */
  stdout?: string
  /** 脚本 stderr 末 2000 字符 */
  stderr?: string
  /** 仅 generate 的 LLM 阶段失败:{ ok:false, error, stage:'llm_generate' }(self_media.py:525) */
  error?: string
  duration_ms?: number
  dryRun?: boolean
}

export interface WechatGenerateBody {
  title: string
  digest?: string
  topic?: string
  mdPath?: string
  mdContent?: string
  dryRun?: boolean
}

/** web 同参数(apps/web/app/(main)/self-media/wechat/page.tsx:73)—— 默认 limit 20 */
export async function getWechatHistory(limit = 20): Promise<ApiResult<WechatHistoryResult>> {
  return fetchApi<WechatHistoryResult>(
    `/api/self-media/wechat/history?limit=${encodeURIComponent(String(limit))}`,
  )
}

/** 生成公众号文章(dry-run);脚本最长 180s(self_media.py:535),故放宽超时。 */
export async function generateWechatArticle(
  body: WechatGenerateBody,
): Promise<ApiResult<WechatRunResult>> {
  return fetchApi<WechatRunResult>('/api/self-media/wechat/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 200_000,
  })
}

/** 22 项自检(脚本最长 120s 级),入参只有 mdPath。 */
export async function validateWechatArticle(mdPath: string): Promise<ApiResult<WechatRunResult>> {
  return fetchApi<WechatRunResult>('/api/self-media/wechat/validate', {
    method: 'POST',
    body: JSON.stringify({ mdPath }),
    timeoutMs: 140_000,
  })
}

/** 推送草稿箱(dryRun 默认由调用方显式传 true);脚本最长 300s(self_media.py:618)。 */
export async function publishWechatArticle(body: {
  mdPath: string
  title: string
  digest?: string
  cover?: string
  dryRun?: boolean
}): Promise<ApiResult<WechatRunResult>> {
  return fetchApi<WechatRunResult>('/api/self-media/wechat/publish', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 320_000,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
