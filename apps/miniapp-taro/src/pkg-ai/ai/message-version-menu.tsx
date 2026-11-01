// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票59 小程序腿(2026-11-01):AI 回复的版本切换器 ← n/N → + 历史入口。
 *
 * 与 web `MessageVersionMenu`(apps/web/src/components/chat/message-list/
 * message-version-menu.tsx)同构交互:读数 `n/N` + 版本点选;判族/投影唯一源
 * `@ihui/shared/chat/message-version-family`(端内零第二份判族)。差别只在承载形态:
 * web 用 PortalPanel 弹层,小程序用平台原生 showActionSheet 作历史入口(与本页
 * 消息长按菜单同一弹层语言,不另起一套;非 alert/confirm,不触禁原生提示窗判据)。
 * 切换不写库、不发请求,只改读投影的激活版本(宿主持 activeVersionByRoot)。
 *
 * 平台特有:依赖 Taro API(showActionSheet)。
 */
import { useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useI18n } from '@/i18n'
import LineIcon from '@/components/LineIcon'
import {
  versionFamilyPosition,
  type VersionFamilyMessage,
} from '@ihui/shared/chat/message-version-family'

/** 切换器需要读正文摘要与 role,消息形状取共享族判定的超集 */
export interface VersionMenuMessage extends VersionFamilyMessage {
  readonly content: string
}

export interface MessageVersionMenuProps {
  messages: readonly VersionMenuMessage[]
  messageId?: string
  /** 选中某版本(宿主写 activeVersionByRoot[rootId] = messageId) */
  onSwitch: (rootId: string, messageId: string) => void
}

export default function MessageVersionMenu({
  messages,
  messageId,
  onSwitch,
}: MessageVersionMenuProps) {
  const { t } = useI18n()
  const pos = messageId ? versionFamilyPosition(messages, messageId) : null
  // hooks 必须无条件按同序调用 ⇒ 早退挪到全部 useCallback 之后(判据:rules-of-hooks)
  const prev = pos ? pos.members[pos.index - 1] : undefined
  const next = pos ? pos.members[pos.index + 1] : undefined
  const step = useCallback(
    (member: VersionMenuMessage | undefined): void => {
      if (member && pos) onSwitch(pos.rootId, member.id)
    },
    [onSwitch, pos],
  )
  const openHistory = useCallback((): void => {
    if (!pos) return
    void Taro.showActionSheet({
      itemList: pos.members.map(
        (m, i) => `${i + 1}/${pos.total} ${m.content.slice(0, 20).replace(/\n/g, ' ') || '—'}`,
      ),
      success: (res) => {
        const picked = pos.members[res.tapIndex]
        if (picked) onSwitch(pos.rootId, picked.id)
      },
    })
  }, [onSwitch, pos])
  // 族内只有一条不渲染(1/1 切换器只会骗用户去点,与 web 同判据);早退已挪到 hooks 之后
  if (!pos) return null

  return (
    <View className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-[4rpx]">
      <View
        className="inline-flex items-center px-1"
        onClick={() => step(prev)}
        hoverClass="opacity-60"
      >
        <LineIcon
          name="chevron-left"
          size={28}
          color={prev ? 'var(--color-muted-foreground)' : 'var(--color-border)'}
        />
      </View>
      <Text className="min-w-8 text-center text-[11px] font-semibold leading-none tabular-nums text-muted-foreground">
        {pos.index + 1}/{pos.total}
      </Text>
      <View
        className="inline-flex items-center px-1"
        onClick={() => step(next)}
        hoverClass="opacity-60"
      >
        <LineIcon
          name="chevron-right"
          size={28}
          color={next ? 'var(--color-muted-foreground)' : 'var(--color-border)'}
        />
      </View>
      <View className="inline-flex items-center px-1" onClick={openHistory} hoverClass="opacity-60">
        <LineIcon name="chevron-down" size={24} color="var(--color-muted-foreground)" />
        <Text className="ml-1 text-[10px] text-muted-foreground">
          {t('ai.messageVersion.history')}
        </Text>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
