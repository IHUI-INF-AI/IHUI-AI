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

import { fetchAiServiceJson } from '../client'

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
