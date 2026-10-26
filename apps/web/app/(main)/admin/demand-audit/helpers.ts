// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createWebSocketHook } from '@/hooks/create-websocket-hook'
import { useAuthStore } from '@/stores/auth'
import { refreshAccessTokenOnce } from '@ihui/api-client'
import { shouldRefreshNow } from '@ihui/shared/auth/auto-refresh'
import type { WsChatMsg } from './types'

/**
 * 构造 /ws/chat 握手地址(每次建连/重连都会被 createWebSocketHook 现调一次)。
 *
 * 2026-10-26 修「access 过期后连不上、且永远不会换新」:
 *  ① 凭据现取:hook 递进来的那一枚是它自己 render 时订阅到的,重连那一轮未必还是最新的;
 *     以 store 当前值为准(store 一旦被别的路径续期,下一跳立刻用新凭据)。
 *  ② 手里这枚已到期/即将到期 ⇒ **顺手发起一次续期**(全局单飞,不会重复打 /auth/refresh)。
 *     urlBuilder 是同步契约,本跳仍带旧凭据(判不出/没换到一律原样放行 —— 失效方向是
 *     "多损失一跳",绝不是把用户登出或干脆不连);新票写回 store 后 createWebSocketHook
 *     的 token 订阅会自己带新凭据重连,于是一次过期最多丢一跳,而不是无限期拿旧 token 刷握手。
 *  ③ 续期判据取共享层单源 `shouldRefreshNow`(与 web 的 setTimeout 调度、RN/Taro 的周期检查
 *     同一把尺子),不在端内复算 exp(§0.6)。
 */
export function buildChatWsUrl(token: string | null): string {
  if (typeof window === 'undefined') return ''
  const credential = useAuthStore.getState().token ?? token
  if (!credential) return ''
  if (shouldRefreshNow(credential)) void refreshAccessTokenOnce()
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = process.env.NEXT_PUBLIC_WS_CHAT_URL || '/ws/chat'
  return `${proto}//${window.location.host}${path}?token=${encodeURIComponent(credential)}`
}

export function isWsChatMsg(d: unknown): d is WsChatMsg {
  return typeof d === 'object' && d !== null && ('type' in d || 'event' in d)
}

export const useChatWs = createWebSocketHook<WsChatMsg>({
  urlBuilder: buildChatWsUrl,
  messageGuard: isWsChatMsg,
})

export const EDIT_FIELDS: { key: string; label: string; type?: 'date' | 'textarea' }[] = [
  { key: 'agentId', label: 'Agent ID' },
  { key: 'agentName', label: 'Agent名称' },
  { key: 'categoryId', label: '分类ID' },
  { key: 'startTime', label: '开始时间', type: 'date' },
  { key: 'startUser', label: '发起用户' },
  { key: 'startPhone', label: '发起电话' },
  { key: 'startName', label: '发起人' },
  { key: 'examineUser', label: '审核人' },
  { key: 'examineUserId', label: '审核人ID' },
  { key: 'examineTime', label: '审核时间', type: 'date' },
  { key: 'desc', label: '描述', type: 'textarea' },
  { key: 'follow', label: '跟进', type: 'textarea' },
  { key: 'agentAvatar', label: '头像', type: 'textarea' },
  { key: 'prologue', label: '开场白', type: 'textarea' },
]

export const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'agentName', label: 'Agent名称' },
  { key: 'agentCreatTime', label: '创建时间' },
  { key: 'reviewTime', label: '审核时间' },
  { key: 'saleType', label: '销售方式' },
  { key: 'agentPeople', label: '面向群体' },
  { key: 'developer', label: '开发者' },
  { key: 'reviewName', label: '审核人' },
  { key: 'reviewStatus', label: '审核状态' },
]

export const AGENT_INFO: { key: string; label: string }[] = [
  { key: 'group', label: '序号' },
  { key: 'type', label: '状态' },
  { key: 'agentName', label: 'Agent名称' },
  { key: 'agentDesc', label: '描述' },
  { key: 'agentImage', label: '图片' },
  { key: 'agentType', label: '类型' },
  { key: 'createTime', label: '创建时间' },
  { key: 'agentSaleMethod', label: '销售方式' },
  { key: 'account', label: '价格' },
  { key: 'agentFreeTimeEnd', label: '免费结束' },
  { key: 'discountMonth', label: '折扣' },
  { key: 'agentTargetGroup', label: '目标群体' },
  { key: 'createName', label: '开发者' },
]

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
