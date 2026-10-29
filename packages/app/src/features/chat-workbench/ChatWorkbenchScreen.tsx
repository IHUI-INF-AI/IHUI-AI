// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 聊天工作台共享屏 — props 注入式跨端组件(2026-10-29 自 web 提进共享层)。
 *
 * 对齐 web `apps/web/app/(main)/chat/workbench/page.tsx` → `WorkbenchShell`:
 * 顶栏(标题 + 新建会话)+ 会话栏(搜索 + 薄行列表)+ 状态档(加载 / 错误 + 重试 / 空态)。
 *
 * 平台无关(本件):布局、取词、排序调用、选中判据、日期格式化。
 * 平台特定(薄壳注入):取数(GET /api/chat/conversations?pageSize=100,与 web 同一出口)、
 * 导航跳转(选会话 → 既有 Chat 屏 / 新建 → 同一 Chat 屏的新会话态)、返回动作、主题与语言。
 *
 * 刻意不承载(形态映射结论,不是漏做):分屏窗格(PaneSplitContainer / useChatPaneSync /
 * pane store 家族 = DOM 指针手势 + 端内 zustand)、对话内核(ChatPaneBody 是 web DOM 树,
 * 移动端对话本体由既有 ChatScreen 承载)、大屏模式(localStorage 偏好 + documentElement 属性)。
 * 排序与选中两个算式一律 import @ihui/shared,不在本件复算(AGENTS §0.6)。
 */
import { useMemo } from 'react'
import { Plus } from 'lucide-react-native'
import { Text, TouchableOpacity, View } from 'react-native'
import { sortPinnedFirst } from '@ihui/shared/utils'

import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { SearchInput } from '../../components/SearchInput'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { createChatWorkbenchStyles } from './chat-workbench-styles'
import type { ChatWorkbenchConversationItem } from './chat-workbench-types'
import { WorkbenchSessionRail } from './WorkbenchSessionRail'

export interface ChatWorkbenchScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 宿主语言(日期格式化用;缺省走 Intl 默认语言) */
  locale?: string
  onBack: () => void
  /** 会话集(未排序未过滤:排序/过滤算式在本件,单一口径) */
  conversations: readonly ChatWorkbenchConversationItem[]
  /** 当前选中会话(深链或薄壳状态;null = 未选) */
  selectedId?: string | null
  loading?: boolean
  error?: string | null
  /** 搜索关键词(受控) */
  keyword?: string
  onKeywordChange?: (keyword: string) => void
  onSelectConversation?: (conversationId: string) => void
  onNewConversation?: () => void
  onRefresh?: () => void
}

/**
 * 关键词过滤(标题面)。
 * 与 web `filterConversationsByKeyword` 同语义的**最小档**:那条出口另带 folder/tag 两个匹配面,
 * 其数据源是侧栏客户端元数据 orgMap(端内 zustand + localStorage),移动端列表载荷不带该元数据,
 * 故本件只按标题匹配 —— 是承载面收窄,不是同一把尺的第二份实现。
 */
function filterByTitle(
  items: readonly ChatWorkbenchConversationItem[],
  keyword: string,
): ChatWorkbenchConversationItem[] {
  const q = keyword.trim().toLowerCase()
  if (!q) return [...items]
  return items.filter((item) => item.title?.toLowerCase().includes(q))
}

export function ChatWorkbenchScreen({
  t,
  colorScheme = 'light',
  locale,
  onBack,
  conversations,
  selectedId = null,
  loading = false,
  error = null,
  keyword = '',
  onKeywordChange,
  onSelectConversation,
  onNewConversation,
  onRefresh,
}: ChatWorkbenchScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createChatWorkbenchStyles(tk), [tk])
  const items = useMemo(
    () => sortPinnedFirst(filterByTitle(conversations, keyword)),
    [conversations, keyword],
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('chatWorkbenchPage.title')}
        </Text>
        <View style={styles.headerActions}>
          {onNewConversation ? (
            <TouchableOpacity
              style={styles.headBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('chatWorkbenchPage.newConversation')}
              onPress={onNewConversation}
            >
              <Plus size={14} color={tk.text.primary} strokeWidth={2} />
              <Text style={styles.headBtnText}>{t('chatWorkbenchPage.newConversation')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {onKeywordChange ? (
        <View style={styles.searchBox}>
          <SearchInput
            value={keyword}
            onChangeText={onKeywordChange}
            placeholder={t('chatWorkbenchPage.searchPlaceholder')}
            voiceEnabled={false}
            colorScheme={colorScheme}
          />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.rail}>
          <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('chatWorkbenchPage.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <WorkbenchSessionRail
          items={items}
          selectedId={selectedId}
          colorScheme={colorScheme}
          locale={locale}
          emptyTitle={
            keyword.trim() ? t('chatWorkbenchPage.searchNoResult') : t('chatWorkbenchPage.empty')
          }
          styles={styles}
          onSelect={(id) => onSelectConversation?.(id)}
        />
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
