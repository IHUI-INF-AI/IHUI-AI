// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌‌‌‌​‌‌‌​‍‍‌‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌‌​​​​‍‍‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​​‌‌‌‌​‍‍​‌​​​‌‌‌‌‌‍‍​‌‌‌​‌‌‌​‍‍​‌‌‌‌‌‌‍‍​​‌‌‌‌​‌‍‍​​‌‌‌‌‌‍‍‌‌‌‌‍‍​​‌‌‌‌‌‌‍‍​​‌‌‌‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App 管理端 API(D15③④)
 * 对接后端 apps/api/src/routes/github-app.ts 的 GET /api/github-app/installations:
 * 安装台账(来自 webhook installation 事件落库)+ webhook/App 凭据配置状态布尔。
 * 后端契约:config 只回布尔,绝不回任何 secret 值。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// ===================== 类型定义 =====================

/** 安装台账行(与 services/github-app/store.ts 的 GithubAppInstallationRow 对齐) */
export interface GithubAppInstallation {
  installationId: number
  accountLogin?: string | null
  targetType?: string | null
  installedByUserId?: number | null
  status: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

/** webhook secret / App 凭据配置状态(只报已配置与否,无任何值) */
export interface GithubAppConfigStatus {
  webhookSecretConfigured: boolean
  appCredentialsConfigured: boolean
}

export interface GithubAppInstallationsData {
  installations: GithubAppInstallation[]
  config: GithubAppConfigStatus
}

// ===================== GET /api/github-app/installations =====================

export async function listAdminGithubAppInstallations(): Promise<
  ApiResult<GithubAppInstallationsData>
> {
  return fetchApi<GithubAppInstallationsData>('/api/github-app/installations')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌‌‌‌​‌‌‌​‍‍‌‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌‌​​​​‍‍‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​​‌‌‌‌​‍‍​‌​​​‌‌‌‌‌‍‍​‌‌‌​‌‌‌​‍‍​‌‌‌‌‌‌‍‍​​‌‌‌‌​‌‍‍​​‌‌‌‌‌‍‍‌‌‌‌‍‍​​‌‌‌‌‌‌‍‍​​‌‌‌‌​‍‍​​‌‌​‌‌​⁠
