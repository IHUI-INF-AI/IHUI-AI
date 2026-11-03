// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { useState } from 'react'

export interface MessageActionsProps {
  onMarkRead?: () => void
  onPin?: () => void
  onDelete?: () => void
  pinned?: boolean
  /**
   * 无障碍标签(spec 键名空间 messageCenter.*;2026-11-01 对齐 RN/共享屏)。
   * 缺省回落到组件内既有措辞,不新增键;调用方可覆盖以贴合所在屏语境。
   */
  markReadLabel?: string
  deleteLabel?: string
  pinLabel?: string
}

export default function MessageActions({
  onMarkRead,
  onPin,
  onDelete,
  pinned = false,
  markReadLabel,
  deleteLabel,
  pinLabel,
}: MessageActionsProps) {
  const [expanded, setExpanded] = useState(false)
  const tt = useTt()

  return (
    <View className="relative">
      <View
        className="w-7 h-7 flex items-center justify-center rounded-md "
        onClick={() => setExpanded(!expanded)}
        hoverClass="opacity-60"
      >
        <Text className="text-muted-foreground text-sm">⋯</Text>
      </View>

      {expanded && (
        <View className="absolute right-0 top-9 z-10 bg-card rounded-lg shadow-lg py-1 min-w-[240rpx]">
          {/* 与共享屏 spec 同口径:操作位只在给了处理函数时渲染,不挂"点了没反应"的假按钮 */}
          {onMarkRead ? (
            <View
              className="flex items-center px-3 py-2 "
              aria-role="button"
              aria-label={markReadLabel ?? tt('messageCenter.markRead', '标记已读')}
              onClick={() => {
                onMarkRead()
                setExpanded(false)
              }}
              hoverClass="opacity-60"
            >
              <Text className="text-sm text-foreground">
                {markReadLabel ?? tt('messageCenter.markRead', '标记已读')}
              </Text>
            </View>
          ) : null}
          {onPin ? (
            <View
              className="flex items-center px-3 py-2 "
              aria-role="button"
              aria-label={
                pinLabel ??
                (pinned ? tt('message.unpin', '取消置顶') : tt('message.pin', '置顶会话'))
              }
              onClick={() => {
                onPin()
                setExpanded(false)
              }}
              hoverClass="opacity-60"
            >
              <Text className="text-sm text-foreground">
                {pinned ? tt('message.unpin', '取消置顶') : tt('message.pin', '置顶会话')}
              </Text>
            </View>
          ) : null}
          {onDelete ? (
            <View
              className="flex items-center px-3 py-2 "
              aria-role="button"
              aria-label={deleteLabel ?? tt('messageCenter.deleteConv', '删除会话')}
              onClick={() => {
                onDelete()
                setExpanded(false)
              }}
              hoverClass="opacity-60"
            >
              <Text className="text-sm text-destructive">
                {deleteLabel ?? tt('messageCenter.deleteConv', '删除会话')}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
