// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Artifact 预览端点(2026-09-01 立,P1-1 Artifact iframe 渲染,对标 Claude Artifacts)。
 * 对应 ai-service 8803 的产物访问接口:
 *  - GET /api/artifacts/token?file=<相对路径> → 换取 30 分钟签名访问 token(JWT 保护)
 *  - GET /api/artifacts/f/<token>             → iframe 直接加载产物 HTML(无需 Authorization)
 */
import type { ApiResult } from '@ihui/types'

import { buildQs, type PageData, type PageQuery } from '../utils.js'
import { fetchAiServiceJson, fetchApi, fetchText } from '../client.js'

/** 产物 kind 联合(唯一源 @ihui/shared/artifact 的 DeliverableKind;本包零依赖不得
 *  import @ihui/shared —— recovery-gate.ts 同款"同形移植"惯例,消费侧不得再抄第二份)。 */
export type ArtifactKind = 'html_report' | 'slides' | 'sheet' | 'doc' | 'video_ref'

// ===================== 类型定义 =====================

/** 产物访问 token 签发响应 */
export interface ArtifactTokenResponse {
  /** 短期签名 token(30 分钟,HS256 + 独立 aud=ihui-artifacts) */
  token: string
  /** iframe 可直接加载的产物地址(/api/artifacts/f/<token>,无需 Authorization header) */
  url: string
  /** token 有效期(秒) */
  expires_in: number
}

// ===================== 接口函数 =====================

/** 为产物相对路径换取签名访问 token(需登录;iframe 用 url 加载,不带 header) */
export async function getArtifactToken(file: string): Promise<ApiResult<ArtifactTokenResponse>> {
  return fetchAiServiceJson<ArtifactTokenResponse>('/api/artifacts/token', { params: { file } })
}

// ===================== 产物中心(对齐 apps/api routes/artifacts.ts,2026-10-31)=====================

/** 枚举端投影行(与 apps/api GET /api/artifacts 的 list 项逐字段对齐,白名单字段) */
export interface ArtifactListItem {
  id: string
  kind: ArtifactKind
  name: string
  version: number
  created_at: string
  session_id: string
  /** 签名预览链指针(ai-service token 端点的 file 参数) */
  payload_ref: string
}

/** 枚举当前用户产物 — GET /api/artifacts?page&pageSize(created_at 倒序分页) */
export async function getArtifacts(
  query: PageQuery = {},
): Promise<ApiResult<PageData<ArtifactListItem>>> {
  return fetchApi<PageData<ArtifactListItem>>(`/api/artifacts${buildQs(query)}`)
}

/** 产物 kind → 允许的导出格式(与 apps/api SUPPORTED_FMTS 逐值一致;video_ref 无导出形态) */
export const ARTIFACT_SUPPORTED_FMTS: Readonly<
  Record<ArtifactKind, readonly ('html' | 'md' | 'csv')[]>
> = {
  html_report: ['html'],
  slides: ['html', 'md'],
  sheet: ['csv'],
  doc: ['md'],
  video_ref: [],
}

/** 导出下载产物 — GET /api/artifacts/:id/download(文本体;非本人一律 404,出口前 sha256 复验)。
 *  fmt 必填:调用方按 item.kind 从 ARTIFACT_SUPPORTED_FMTS 选(video_ref 按钮禁用不发起);
 *  后端默认格式随 kind 走,fetchText 拿不到响应头,不猜。404/400 由 fetchText 抛出带 status。 */
export async function getArtifactDownload(id: string, fmt: 'html' | 'md' | 'csv'): Promise<string> {
  return fetchText(`/api/artifacts/${id}/download?fmt=${fmt}`)
}
