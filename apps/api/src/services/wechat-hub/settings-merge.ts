// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​​​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍‌​‌‌​‌‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号设置 → metadata 的合并。
 *
 * metadata 是同一个 jsonb 字段，里面同时住着：白名单、敏感词、限流、出站 Webhook、
 * 斜杠指令开关、定时任务、联系人映射、朋友圈归档游标、agent 模型覆盖……
 * 任何一次「整块覆盖」都会把别人的东西冲掉，所以这里是唯一的写入口，
 * 只改 patch 点名的那几个键，其余键原样带过。
 */

import { asRecord, type JsonRecord } from './views.js'
import { normalizeOutboundWebhookUrl } from './webhook-outbound.js'

/** 可被 PATCH 的设置在 metadata 上的投影（allowlistEnabled 是列字段，不在这里）。 */
export interface WechatSettingsPatch {
  allowedTargets?: string[]
  blockedWords?: string[]
  rateLimitPerMinute?: number
  outboundWebhookUrl?: string
  /** 斜杠指令总开关；默认关闭 */
  commandsEnabled?: boolean
  /** 群聊里是否响应指令；默认关闭，避免群成员消耗模型额度 */
  commandsInGroup?: boolean
  /** 单条指令黑名单，例如 ['report'] */
  disabledCommands?: string[]
  /** 账号级自动回复模型覆盖，空串表示回落全局 WECHAT_HUB_AGENT_MODEL */
  agentModel?: string
}

export const MIN_RATE_LIMIT = 1
export const MAX_RATE_LIMIT = 120
export const MAX_AGENT_MODEL_LENGTH = 80

export function mergeSettingsMetadata(raw: unknown, patch: WechatSettingsPatch): JsonRecord {
  const metadata: JsonRecord = { ...asRecord(raw) }

  if (patch.allowedTargets) metadata.allowedTargets = patch.allowedTargets
  if (patch.blockedWords) metadata.blockedWords = patch.blockedWords

  if (patch.rateLimitPerMinute !== undefined) {
    metadata.rateLimitPerMinute = Math.max(
      MIN_RATE_LIMIT,
      Math.min(MAX_RATE_LIMIT, patch.rateLimitPerMinute),
    )
  }

  if (patch.outboundWebhookUrl !== undefined) {
    const normalized = normalizeOutboundWebhookUrl(patch.outboundWebhookUrl)
    if (normalized) metadata.outboundWebhookUrl = normalized
    else delete metadata.outboundWebhookUrl
  }

  if (
    patch.commandsEnabled !== undefined ||
    patch.commandsInGroup !== undefined ||
    patch.disabledCommands !== undefined
  ) {
    const current = asRecord(metadata.commands)
    metadata.commands = {
      enabled: patch.commandsEnabled ?? current.enabled === true,
      groupEnabled: patch.commandsInGroup ?? current.groupEnabled === true,
      disabled: patch.disabledCommands ?? (Array.isArray(current.disabled) ? current.disabled : []),
    }
  }

  if (patch.agentModel !== undefined) {
    const model = patch.agentModel.trim().slice(0, MAX_AGENT_MODEL_LENGTH)
    const agent = asRecord(metadata.agent)
    if (model) {
      metadata.agent = { ...agent, model }
    } else {
      const next: Record<string, unknown> = { ...agent }
      delete next.model
      if (Object.keys(next).length > 0) metadata.agent = next
      else delete metadata.agent
    }
  }

  return metadata
}
