// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联群发：按显式目标 / 标签 / 全部联系人圈选，逐条走 manager.send。
 * 不绕过白名单、敏感词、限流与审计；单次最多 100 个目标，批间限速。
 */

import type {
  WechatBroadcastInput,
  WechatBroadcastResult,
  WechatBroadcastTargetResult,
} from '@ihui/types'
import { AppError } from '../../errors/AppError.js'
import { listContacts } from './contacts.js'
import { wechatHubManager } from './manager.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 纯筛选：标签任一命中；默认跳过 blocked；同一目标去重。 */
export function selectBroadcastTargets(
  contacts: Array<{ platformUserId: string; tags: string[]; blocked: boolean }>,
  tags: string[],
  includeBlocked: boolean,
): string[] {
  const wanted = tags.map((tag) => tag.trim()).filter(Boolean)
  const picked = contacts
    .filter((contact) => includeBlocked || !contact.blocked)
    .filter((contact) => wanted.length === 0 || contact.tags.some((tag) => wanted.includes(tag)))
    .map((contact) => contact.platformUserId)
  return Array.from(new Set(picked))
}

async function resolveTargets(userId: string, input: WechatBroadcastInput): Promise<string[]> {
  if (input.targets?.length) {
    return Array.from(new Set(input.targets.map((item) => item.trim()).filter(Boolean)))
  }
  const contacts = await listContacts(userId, input.accountId)
  return selectBroadcastTargets(contacts, input.tags ?? [], input.includeBlocked ?? false)
}

export async function broadcast(
  userId: string,
  input: WechatBroadcastInput,
): Promise<WechatBroadcastResult> {
  const targets = await resolveTargets(userId, input)
  if (targets.length === 0) {
    throw new AppError('群发目标为空', 400, 'WECHAT_BROADCAST_EMPTY_TARGET')
  }
  if (targets.length > 100) {
    throw new AppError('单次群发最多 100 个目标', 400, 'WECHAT_BROADCAST_TOO_MANY')
  }
  if (!input.text?.trim() && !input.mediaUrl) {
    throw new AppError('群发内容为空', 400, 'WECHAT_BROADCAST_EMPTY_CONTENT')
  }

  const batchSize = Math.min(Math.max(input.batchSize ?? 20, 1), 50)
  const results: WechatBroadcastTargetResult[] = []
  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize)
    for (const target of batch) {
      try {
        const result = await wechatHubManager.send(userId, {
          accountId: input.accountId,
          target,
          kind: input.kind ?? 'text',
          text: input.text,
          mediaUrl: input.mediaUrl,
          dryRun: input.dryRun,
        })
        results.push({
          target,
          ok: result.ok,
          status: result.status,
          platformMessageId: result.platformMessageId,
          reason: result.reason,
        })
      } catch (e) {
        results.push({
          target,
          ok: false,
          status: 'local-error',
          platformMessageId: null,
          reason: e instanceof Error ? e.message : String(e),
        })
      }
    }
    if (i + batchSize < targets.length) await sleep(200)
  }
  const sent = results.filter((item) => item.ok).length
  return { total: results.length, sent, failed: results.length - sent, results }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
