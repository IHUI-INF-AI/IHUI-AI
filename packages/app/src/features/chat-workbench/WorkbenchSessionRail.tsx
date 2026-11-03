// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作台会话栏共享件(2026-10-29 提自 web `apps/web/src/components/chat/workbench/workbench-session-rail.tsx`)。
 *
 * 只承载**能跨端映射的那一面**:薄行(标题 + 置顶标记 + 日期)+ 选中态 + 空态/无结果态。
 * web 侧栏独有的三件事在这里刻意不存在(不是漏做,是形态映射结论,详见交付报告三桶表):
 * - 行菜单(重命名/收藏/置顶/归档/删除)= DropdownMenu + Radix 锚点 + 端内 mutation 出口;
 * - 拖入分屏(draggable + dataTransfer)= DOM 指针手势;
 * - 日期分组头(groupByDate 住在 web 端内 DOM 模块,不可跨端取用)。
 * 选中判据不在此复算:走 `@ihui/shared/ui/chat-workbench-shell-spec` 的 isRailRowSelected。
 */
import { MessageSquare, Pin } from 'lucide-react-native'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { isRailRowSelected } from '@ihui/shared/ui/chat-workbench-shell-spec'

import { getTokens } from '../../theme/tokens'
import { EmptyState } from '../../components/ScreenStates'
import type { ChatWorkbenchStyles } from './chat-workbench-styles'
import type { ChatWorkbenchConversationItem } from './chat-workbench-types'

export interface WorkbenchSessionRailProps {
  /** 已按 sortPinnedFirst 排好序并过滤过的会话集(排序算式单源,本件不再排第二次) */
  items: readonly ChatWorkbenchConversationItem[]
  selectedId: string | null
  colorScheme: 'light' | 'dark'
  /** 语言(日期格式化用 Intl.DateTimeFormat,AGENTS §3);缺省走宿主默认语言 */
  locale?: string
  /** 空列表标题:由调用方按"是否在搜索"给出 t('chatWorkbenchPage.empty') 或 …searchNoResult */
  emptyTitle: string
  styles: ChatWorkbenchStyles
  onSelect: (conversationId: string) => void
}

/** 会话行的日期档:取 ISO 串按 locale 量出「月/日」;无效时刻回落到原始串截断,不抛。 */
function formatConversationDay(iso: string, locale?: string): string {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return ''
  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(new Date(ts))
}

export function WorkbenchSessionRail({
  items,
  selectedId,
  colorScheme,
  locale,
  emptyTitle,
  styles,
  onSelect,
}: WorkbenchSessionRailProps) {
  const tk = getTokens(colorScheme)

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={<MessageSquare size={22} color={tk.text.tertiary} strokeWidth={2} />}
          title={emptyTitle}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.rail}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((item) => {
        const active = isRailRowSelected(item.id, selectedId)
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, active ? styles.rowActive : null]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.id)}
          >
            <MessageSquare
              size={14}
              color={active ? tk.brandAccent.deep : tk.text.tertiary}
              strokeWidth={2}
            />
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.pinned ? <Pin size={12} color={tk.brandAccent.deep} strokeWidth={2} /> : null}
            <Text style={styles.rowTime}>{formatConversationDay(item.lastMessageAt, locale)}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
