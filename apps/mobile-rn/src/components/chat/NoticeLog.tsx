// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NoticeLog —— 对话内「提示留痕」的 **RN 渲染层**(2026-11 立)。
 *
 * 立因:轻提示(toast)是瞬时的,用户看到后一闪即消、既无法回看也无法记住。用户要求
 * 「凡 toast 都要在 AI 对话框里留痕」,故每次 showToast 额外落一条本记录,挂在消息列表
 * 尾部(`messageListSlots.orphanTailNode`,随对话滚动、恒常驻),可回看、可选中复制。
 *
 * 2026-11 收口:记录模型(`ChatNotice`/`NoticeKind`)、去重与上限(`appendNotice`/`NOTICE_LOG_CAP`)、
 * 持久化编解码(`serializeNoticeLog`/`parseNoticeLog`/`loadNoticeLog`/`saveNoticeLog`)全部下沉到
 * `@ihui/shared/chat/notice-log`,本文件**只做渲染**。这样 web 端留痕与本端是同一份行为契约 ——
 * 「RN 改一处、web 随源头同动」,而不是两端各养一套(历史教训见 `utils/host-toast.ts` 头注)。
 *
 * 边界:
 * - **不进后端上下文 / 历史**:记录是独立的 `notices` state,不混入 `messages`,故不会被
 *   当成对话内容发给模型,也不会落库 —— 它只是客户端的一份可视 trace。
 * - 文案原样来自 toast(各端已本地化),本组件零硬编码中文,不新增 i18n 键。
 */
import type { ReactElement } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { AlertTriangle, Check, Info, X, type LucideIcon } from 'lucide-react-native'
import type { ChatNotice, NoticeKind } from '@ihui/shared/chat/notice-log'
import { tokens } from '../../theme/active-tokens'

// 记录模型与纯逻辑的**唯一真相源**在 shared;此处转出只为让既有 importer 不必改路径。
export {
  appendNotice,
  NOTICE_LOG_CAP,
  type ChatNotice,
  type NoticeKind,
} from '@ihui/shared/chat/notice-log'

const ICONS: Readonly<Record<NoticeKind, LucideIcon>> = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
}

const COLORS: Readonly<Record<NoticeKind, string>> = {
  success: tokens.success.DEFAULT,
  error: tokens.danger.DEFAULT,
  warning: tokens.warning.DEFAULT,
  info: tokens.text.secondary,
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function NoticeLog({ notices }: { notices: readonly ChatNotice[] }): ReactElement | null {
  if (notices.length === 0) return null
  return (
    <View style={styles.wrap}>
      {notices.map((n) => {
        const Icon = ICONS[n.kind]
        return (
          <View key={n.id} style={styles.row}>
            <Icon size={12} color={COLORS[n.kind]} />
            <Text style={styles.time}>{fmtTime(n.ts)}</Text>
            <Text style={styles.text} selectable>
              {n.text}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border.light,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  time: {
    fontSize: 11,
    lineHeight: 16,
    color: tokens.text.tertiary,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: tokens.text.secondary,
  },
})
