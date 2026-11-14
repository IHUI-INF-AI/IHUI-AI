// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — IM 适配器凭证读取器(2026-11-13 立)。
 *
 * 凭证单源:直接读 im_adapters 表的 credentialsJson(含 appId/appSecret),
 * 不另存一份 → IM 与考勤同步一处改、处处生效(见 design §3「凭证单源」)。
 *
 * 安全:本文件只读取引用,不复制明文到别处、不写日志、不入仓。
 */

import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { imAdapters } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'
import type { PlatformCredentials, SyncSource } from './types.js'

/**
 * 读取某平台已启用适配器的凭证。
 *
 * @param userId  适配器归属用户(IM 配置按 userId+platform 唯一)
 * @param source  平台标识(feishu/dingtalk/wecom)
 * @returns 平台凭证;未配置或未启用 → 抛 AppError(由调用方决定是否跳过该平台)
 */
export async function loadPlatformCredentials(
  userId: string,
  source: SyncSource,
): Promise<PlatformCredentials> {
  const [adapter] = await db
    .select({
      platform: imAdapters.platform,
      enabled: imAdapters.enabled,
      credentialsJson: imAdapters.credentialsJson,
    })
    .from(imAdapters)
    .where(and(eq(imAdapters.userId, userId), eq(imAdapters.platform, source)))
    .limit(1)

  if (!adapter || !adapter.enabled) {
    throw new AppError(
      `平台 ${source} 的 IM 适配器未配置或未启用,无法同步考勤`,
      400,
      'SYNC_ADAPTER_NOT_ENABLED',
    )
  }

  const creds = adapter.credentialsJson as Record<string, unknown>
  const appId = typeof creds.appId === 'string' ? creds.appId : ''
  const appSecret = typeof creds.appSecret === 'string' ? creds.appSecret : ''

  if (!appId || !appSecret) {
    throw new AppError(
      `平台 ${source} 的 IM 适配器缺少 appId/appSecret,无法同步考勤`,
      400,
      'SYNC_CREDENTIALS_INCOMPLETE',
    )
  }

  // 钉钉部分考勤 API 需 agentId(待核实);有则带上,无则 undefined
  const agentId = typeof creds.agentId === 'string' ? creds.agentId : undefined

  return { appId, appSecret, agentId }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
