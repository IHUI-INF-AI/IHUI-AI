// 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'
import type { TFunction, AppOrderStatus, OrderItem, OrderTab } from '@ihui/types'
import { useTt } from '@/i18n'

/** 订单状态/Tab/列表项类型 re-export(单一来源 @ihui/types) */
export type { AppOrderStatus, OrderItem, OrderTab }

/**
 * Taro 适配层:OrderScreen(订单列表共享屏)
 *
 * 复用 packages/app/src/features/order/OrderScreen 的 props 契约 + 状态机逻辑
 * (header 返回 + tab 切换栏 + 订单卡片列表 + 下拉刷新),仅替换 RN 元素为
 * @tarojs/components 原语:
 * - TouchableOpacity → View + onTap
 * - ScrollView horizontal → ScrollView scrollX
 * - RefreshControl → ScrollView refresherEnabled/refresherTriggered/onRefresherRefresh
 * - StyleSheet.create → CSSProperties 函数(view/text 分组,避免联合类型)
 * - getTokens/AppThemeTokens → getRnTokens/RnThemeTokens(共享 design-tokens)
 *
 * 颜色统一通过 token 注入(禁止硬编码 hex/rgb),px → rpx 单位换算(1px = 2rpx)。
 * i18n 三级降级:t prop → useTt() I18nContext → 硬编码中文 fallback。
 *
 * 注:相比 canonical OrderScreenProps(@ihui/types 中 t 为必填),此处 t 改为可选,
 * 以支持适配层三级降级;其余字段名 + 类型完全对齐。
 */
export interface OrderScreenProps {
  /** i18n 翻译函数(可选);未传则用 I18nContext t,再降级硬编码中文 */
  t?: TFunction
  items: OrderItem[]
  /** 当前激活 tab */
  activeTab: OrderTab
  /** tab 切换回调,平台注入重新拉取逻辑 */
  onSelectTab: (tab: OrderTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击订单卡片回调,平台注入导航跳转 */
  onPressItem: (item: OrderItem) => void
  onBack: () => void
  /** 已解析主题,默认 'light' */
  colorScheme?: RnThemeMode
}

const TABS: OrderTab[] = ['all', 'pending', 'paid', 'shipped', 'completed']

/** tab 标签硬编码 fallback(i18n 未命中时降级) */
const TAB_FALLBACK: Record<string, string> = {
  all: '全部',
  pending: '待付款',
  paid: '已付款',
  shipped: '已发货',
  completed: '已完成',
}

/** 订单状态标签硬编码 fallback(i18n 未命中时降级) */
const STATUS_FALLBACK: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

/** 订单状态徽章配色(复用源文件 statusColors 逻辑,token 驱动) */
const statusColors = (
  status: AppOrderStatus,
  tk: RnThemeTokens,
): { bg: string; text: string } => {
  switch (status) {
    case 'pending':
      return { bg: tk.warning.amberLight, text: tk.warning.amberText }
    case 'paid':
      return { bg: tk.success.light, text: tk.success.deepText }
    case 'shipped':
      return { bg: tk.indigo.light, text: tk.indigo.deep }
    case 'completed':
      return { bg: tk.success.light, text: tk.success.deepText }
    case 'cancelled':
      return { bg: tk.danger.light, text: tk.danger.DEFAULT }
    case 'refunded':
      return { bg: tk.surface.muted, text: tk.text.tertiary }
    default:
      return { bg: tk.surface.muted, text: tk.text.tertiary }
  }
}

// ===== 样式函数(view/text 分组,避免 style 联合类型) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
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
  errorText: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(8),
    fontSize: toRpx(12),
    color: tk.danger.DEFAULT,
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
  }),
  listBody: (): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(16),
    paddingBottom: toRpx(16),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(16),
    paddingBottom: toRpx(16),
    borderRadius: toRpx(8),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tk.border.light,
    marginBottom: toRpx(8),
    backgroundColor: tk.surface.light,
  }),
  cardHead: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  cardTitleWrap: (): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    marginRight: toRpx(8),
  }),
  badge: (bg: string): CSSProperties => ({
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(4),
    backgroundColor: bg,
    overflow: 'hidden',
    flexShrink: 0,
  }),
  metaRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: toRpx(6),
  }),
  amountRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: toRpx(8),
  }),
}

const textStyles = {
  back: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.medium,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(18),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  tab: (tk: RnThemeTokens, active: boolean): CSSProperties => ({
    fontSize: toRpx(12),
    color: active ? tk.success.DEFAULT : tk.text.secondary,
    fontWeight: active ? '600' : '400',
  }),
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
    marginTop: toRpx(8),
  }),
  cardTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    fontWeight: '500',
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  badge: (text: string): CSSProperties => ({
    fontSize: toRpx(11),
    color: text,
  }),
  orderNo: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  metaTime: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  amountLabel: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  amountValue: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: '600',
    color: tk.text.primary,
  }),
}

export function OrderScreen({
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
}: OrderScreenProps) {
  const tk = getRnTokens(colorScheme)
  const tt = useTt()

  // i18n 三级降级:t prop → useTt() I18nContext → 硬编码中文 fallback
  const tr = (key: string, fallback: string): string => {
    if (tProp) {
      const v = tProp(key)
      // tProp 返回值等于 key 视为未命中,降级到 fallback
      return v !== key ? v : fallback
    }
    return tt(key, fallback)
  }

  const tabLabel = (tab: OrderTab): string =>
    tr(`order.tab.${tab}`, TAB_FALLBACK[tab] ?? String(tab))
  const statusLabel = (status: AppOrderStatus): string =>
    tr(`order.status.${status}`, STATUS_FALLBACK[status] ?? String(status))

  return (
    <View style={viewStyles.container(tk)}>
      <View style={viewStyles.header()}>
        <View style={viewStyles.backBtn()} onTap={onBack}>
          <Text style={textStyles.back(tk)}>{tr('common.back', '返回')}</Text>
        </View>
        <Text style={textStyles.title(tk)}>{tr('order.title', '我的订单')}</Text>
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
                <Text style={textStyles.tab(tk, active)}>{tabLabel(tab)}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {error ? <Text style={viewStyles.errorText(tk)}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={viewStyles.center()}>
          <Text style={textStyles.muted(tk)}>{tr('common.loading', '加载中...')}</Text>
        </View>
      ) : (
        <ScrollView
          scrollY
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={onRefresh}
          style={viewStyles.listScroll()}
        >
          <View style={viewStyles.listBody()}>
            {items.length === 0 ? (
              <View style={viewStyles.center()}>
                <Text style={textStyles.muted(tk)}>{tr('order.empty', '暂无订单')}</Text>
              </View>
            ) : (
              items.map((item: OrderItem) => {
                const sc = statusColors(item.status, tk)
                return (
                  <View key={item.id} onTap={() => onPressItem(item)}>
                    <View style={viewStyles.card(tk)}>
                      <View style={viewStyles.cardHead()}>
                        <View style={viewStyles.cardTitleWrap()}>
                          <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                        </View>
                        <View style={viewStyles.badge(sc.bg)}>
                          <Text style={textStyles.badge(sc.text)}>
                            {statusLabel(item.status)}
                          </Text>
                        </View>
                      </View>
                      <View style={viewStyles.metaRow()}>
                        <Text style={textStyles.orderNo(tk)}>{item.orderNo}</Text>
                        <Text style={textStyles.metaTime(tk)}>{item.createdAt}</Text>
                      </View>
                      <View style={viewStyles.amountRow()}>
                        <Text style={textStyles.amountLabel(tk)}>
                          {tr('order.amount', '金额')}
                        </Text>
                        <Text style={textStyles.amountValue(tk)}>
                          ¥{item.amount.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
