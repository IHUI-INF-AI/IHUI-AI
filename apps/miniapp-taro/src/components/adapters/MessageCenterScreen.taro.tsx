// 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { useTt } from '@/i18n'

/**
 * Taro 适配层:MessageCenterScreen
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView + onTap,
 * 不适合共享层。
 *
 * 复用 packages/app/src/features/message-center/MessageCenterScreen 的 props 契约
 * + tab 切换状态机 + 卡片样式逻辑,替换 RN 元素:
 * - `TouchableOpacity` → `View` + `onTap`
 * - `RefreshControl` → ScrollView `refresherEnabled`/`refresherTriggered`/`onRefresherRefresh`
 * - `StyleSheet.create` → CSSProperties 函数(rpx 换算)
 * - `numberOfLines={1}` → CSS `text-overflow: ellipsis`
 * - `numberOfLines={2}` → CSS `-webkit-line-clamp: 2`
 * - `hitSlop` / `showsHorizontalScrollIndicator` → 省略(Taro 不需要/不支持)
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 RN 端主题一致。
 *
 * i18n 三级降级:`t` prop → `useTt()` I18nContext → 硬编码中文 fallback
 */

/** 消息中心 Tab key(可扩展为任意 string) */
export type MessageTab = 'system' | 'order' | 'course' | 'social' | (string & {})

/** 消息项(平台注入,字段对齐 @ihui/types/src/app.ts MessageCenterItem) */
export interface MessageCenterItem {
  id: string
  type: MessageTab
  title: string
  content: string
  /** 是否已读(未读用 success 色 border + 浅色背景) */
  read: boolean
  createdAt: string
}

/** 消息中心共享屏 props(字段对齐 @ihui/types/src/app.ts MessageCenterScreenProps) */
export interface MessageCenterScreenProps {
  t: TFunction
  items: MessageCenterItem[]
  /** 当前激活 tab */
  activeTab: MessageTab
  /** tab 切换回调,平台注入重新拉取逻辑 */
  onSelectTab: (tab: MessageTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击消息卡片回调,可选 */
  onPressItem?: (item: MessageCenterItem) => void
  onBack: () => void
  /** 已解析配色方案,默认 'light' */
  colorScheme?: RnThemeMode
}

const TABS: MessageTab[] = ['system', 'order', 'course', 'social']

/** Taro `rpx` 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

/** i18n 硬编码 fallback(三级降级最末层) */
const FALLBACK: Record<string, string> = {
  'common.back': '返回',
  'common.loading': '加载中...',
  'messageCenter.title': '消息中心',
  'messageCenter.empty': '暂无消息',
  'messageCenter.type.system': '系统',
  'messageCenter.type.order': '订单',
  'messageCenter.type.course': '课程',
  'messageCenter.type.social': '社交',
  'messageCenter.tab.system': '系统',
  'messageCenter.tab.order': '订单',
  'messageCenter.tab.course': '课程',
  'messageCenter.tab.social': '社交',
}

/** 容器样式(独立函数避免 style 联合类型) */
const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    height: '100%',
    backgroundColor: tk.surface.bg,
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
  }),
  backBtn: (): CSSProperties => ({
    paddingRight: toRpx(12),
  }),
  tabsScroll: (): CSSProperties => ({
    width: '100%',
    whiteSpace: 'nowrap',
  }),
  tabsInner: (): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
  }),
  tab: (tk: RnThemeTokens, active: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: toRpx(14),
    paddingRight: toRpx(14),
    paddingTop: toRpx(6),
    paddingBottom: toRpx(6),
    marginRight: toRpx(8),
    borderRadius: toRpx(8),
    backgroundColor: active ? tk.success.light : tk.surface.card,
    flexShrink: 0,
  }),
  errorWrap: (): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: toRpx(48),
    paddingBottom: toRpx(48),
  }),
  listScroll: (): CSSProperties => ({
    flex: 1,
    height: '100%',
  }),
  listBody: (): CSSProperties => ({
    padding: toRpx(16),
  }),
  card: (tk: RnThemeTokens, unread: boolean): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(16),
    paddingBottom: toRpx(16),
    borderRadius: toRpx(8),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: unread ? tk.success.DEFAULT : tk.border.light,
    backgroundColor: unread ? tk.success.light : 'transparent',
    marginBottom: toRpx(8),
  }),
  cardHead: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  typeTag: (tk: RnThemeTokens, isSystem: boolean): CSSProperties => ({
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(4),
    overflow: 'hidden',
    backgroundColor: isSystem ? tk.success.light : tk.surface.card,
  }),
  dot: (tk: RnThemeTokens): CSSProperties => ({
    width: toRpx(6),
    height: toRpx(6),
    borderRadius: toRpx(3),
    backgroundColor: tk.danger.DEFAULT,
    marginLeft: toRpx(8),
  }),
  meta: (): CSSProperties => ({
    marginLeft: 'auto',
  }),
  cardTitleWrap: (): CSSProperties => ({
    marginTop: toRpx(6),
  }),
  cardContentWrap: (): CSSProperties => ({
    marginTop: toRpx(4),
  }),
}

/** 文本样式集中管理(避免 style 联合类型) */
const textStyles = {
  backText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.medium,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(18),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  tabText: (tk: RnThemeTokens, active: boolean): CSSProperties => ({
    fontSize: toRpx(12),
    color: active ? tk.success.DEFAULT : tk.text.secondary,
    fontWeight: active ? '600' : '400',
  }),
  errorText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.danger.DEFAULT,
  }),
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
    marginTop: toRpx(8),
  }),
  type: (tk: RnThemeTokens, isSystem: boolean): CSSProperties => ({
    fontSize: toRpx(10),
    color: isSystem ? tk.success.DEFAULT : tk.text.secondary,
  }),
  meta: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  cardTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    fontWeight: '600',
    color: tk.text.primary,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }),
  cardContent: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(13),
    color: tk.text.medium,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
  }),
}

export function MessageCenterScreen({
  t: tProp,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: MessageCenterScreenProps) {
  const tk = getRnTokens(colorScheme)
  const tt = useTt()

  // i18n 三级降级:t prop → useTt() I18nContext → 硬编码中文 fallback
  const t: TFunction = tProp ?? ((key, options) => {
    const fb = FALLBACK[key] ?? key
    return tt(key, fb, options)
  })

  const typeLabel = (type: MessageTab): string => {
    switch (type) {
      case 'system':
        return t('messageCenter.type.system')
      case 'order':
        return t('messageCenter.type.order')
      case 'course':
        return t('messageCenter.type.course')
      case 'social':
        return t('messageCenter.type.social')
      default:
        return t('messageCenter.type.system')
    }
  }

  return (
    <View style={viewStyles.container(tk)}>
      <View style={viewStyles.header()}>
        <View style={viewStyles.backBtn()} onTap={onBack}>
          <Text style={textStyles.backText(tk)}>{t('common.back')}</Text>
        </View>
        <Text style={textStyles.title(tk)}>{t('messageCenter.title')}</Text>
      </View>

      <ScrollView scrollX style={viewStyles.tabsScroll()}>
        <View style={viewStyles.tabsInner()}>
          {TABS.map((tab) => {
            const active = tab === activeTab
            return (
              <View
                key={tab}
                style={viewStyles.tab(tk, active)}
                onTap={() => onSelectTab(tab)}
              >
                <Text style={textStyles.tabText(tk, active)}>
                  {t(`messageCenter.tab.${tab}`)}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {error ? (
        <View style={viewStyles.errorWrap()}>
          <Text style={textStyles.errorText(tk)}>{error}</Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={viewStyles.center()}>
          <Text style={textStyles.muted(tk)}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          scrollY
          style={viewStyles.listScroll()}
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={onRefresh}
        >
          <View style={viewStyles.listBody()}>
            {items.length === 0 ? (
              <View style={viewStyles.center()}>
                <Text style={textStyles.muted(tk)}>{t('messageCenter.empty')}</Text>
              </View>
            ) : (
              items.map((item: MessageCenterItem) => {
                const inner = (
                  <View style={viewStyles.card(tk, !item.read)}>
                    <View style={viewStyles.cardHead()}>
                      <View style={viewStyles.typeTag(tk, item.type === 'system')}>
                        <Text style={textStyles.type(tk, item.type === 'system')}>
                          {typeLabel(item.type)}
                        </Text>
                      </View>
                      {!item.read ? <View style={viewStyles.dot(tk)} /> : null}
                      <View style={viewStyles.meta()}>
                        <Text style={textStyles.meta(tk)}>{item.createdAt}</Text>
                      </View>
                    </View>
                    <View style={viewStyles.cardTitleWrap()}>
                      <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                    </View>
                    <View style={viewStyles.cardContentWrap()}>
                      <Text style={textStyles.cardContent(tk)}>{item.content}</Text>
                    </View>
                  </View>
                )
                if (onPressItem) {
                  return (
                    <View key={item.id} onTap={() => onPressItem(item)}>
                      {inner}
                    </View>
                  )
                }
                return <View key={item.id}>{inner}</View>
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
