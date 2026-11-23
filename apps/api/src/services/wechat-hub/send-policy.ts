// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联（WeChat Hub）出站策略。
 *
 * 纯函数：不读写数据库，只按账号 runtime 的 metadata 与调用方传入的限流窗口判定。
 * 目标不在白名单、命中敏感词、超出每分钟限额时返回本地拒绝结果；通过返回 null。
 * 白名单开启但清单为空按 fail-closed 处理（一律拒绝），避免"开了白名单却谁都能发"。
 */

import type { WechatSendInput, WechatSendResult } from '@ihui/types'
import type { WechatRuntimeAccount } from './types.js'
import { localRejected } from './types.js'
import { asNumber, asStringArray } from './views.js'

type RateWindows = Map<string, { minute: number; count: number }>

export function applySendPolicy(
  runtime: WechatRuntimeAccount,
  input: WechatSendInput,
  rateWindows: RateWindows,
): WechatSendResult | null {
  if (!input.target || input.target.length > 255) {
    return localRejected('target 为空或过长', 'target-invalid')
  }
  if (input.kind === 'text' || !input.kind) {
    const text = input.text ?? ''
    if (text.trim().length === 0) return localRejected('文本为空', 'text-empty')
    if (text.length > 5_000) return localRejected('文本超过 5000 字', 'text-too-long')
    const blockedWords = asStringArray(runtime.metadata.blockedWords)
    const hit = blockedWords.find((word) => word && text.includes(word))
    if (hit) return localRejected(`命中敏感词：${hit}`, 'blocked-word')
  } else {
    const url = input.mediaUrl ?? ''
    if (!/^https?:\/\//.test(url))
      return localRejected('媒体 URL 必须是 http(s)', 'media-url-invalid')
  }

  const allowedTargets = asStringArray(runtime.metadata.allowedTargets)
  if (runtime.allowlistEnabled && !allowedTargets.includes(input.target)) {
    return localRejected(
      allowedTargets.length === 0 ? '白名单已开启但清单为空，拒绝发送' : '目标不在白名单内',
      'allowlist',
    )
  }

  const perMinute = asNumber(runtime.metadata.rateLimitPerMinute) ?? 20
  const minute = Math.floor(Date.now() / 60_000)
  const key = `${runtime.id}:${minute}`
  const window = rateWindows.get(key) ?? { minute, count: 0 }
  if (window.count >= perMinute) {
    return localRejected(`触发限流：${perMinute} 条/分钟`, 'rate-limit')
  }
  window.count += 1
  rateWindows.set(key, window)
  if (rateWindows.size > 1_000) {
    for (const [oldKey, value] of rateWindows) {
      if (value.minute < minute - 5) rateWindows.delete(oldKey)
    }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
