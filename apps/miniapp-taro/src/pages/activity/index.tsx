// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/activity/ActivityScreen UI 与
// apps/mobile-rn ActivityScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { fetchApi } from '@ihui/api-client'
import type { ActivityItem } from '@ihui/types'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// 对齐共享屏 ACTIVITY_STATUS_KEYS 状态文案键映射
const ACTIVITY_STATUS_KEYS: Record<ActivityItem['status'], string> = {
  upcoming: 'activity.status_upcoming',
  ongoing: 'activity.status_ongoing',
  ended: 'activity.status_ended',
}

const ACTIVITY_STATUS_FALLBACK: Record<ActivityItem['status'], string> = {
  upcoming: '即将开始',
  ongoing: '进行中',
  ended: '已结束',
}

// 对齐共享屏 statusColor:ongoing→brand,upcoming→amber,ended→tertiary
function statusColor(status: ActivityItem['status'], tk: RnThemeTokens): string {
  if (status === 'ongoing') return tk.brand.DEFAULT
  if (status === 'upcoming') return tk.warning.amber
  return tk.text.tertiary
}

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐共享屏 createStyles) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tk.surface.bg,
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    columnGap: toRpx(12),
  }),
  errorText: (): CSSProperties => ({
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: toRpx(48),
    paddingBottom: toRpx(48),
  }),
  listBody: (): CSSProperties => ({
    padding: toRpx(14),
  }),
  separator: (): CSSProperties => ({
    height: toRpx(12),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    padding: toRpx(14),
    borderRadius: toRpx(12),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tk.border.light,
    backgroundColor: tk.surface.light,
  }),
  titleRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: toRpx(8),
  }),
  badge: (color: string): CSSProperties => ({
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(12),
    backgroundColor: color,
    overflow: 'hidden',
  }),
  joinBtn: (): CSSProperties => ({
    marginTop: toRpx(8),
    paddingTop: toRpx(6),
    paddingBottom: toRpx(6),
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  }),
}

const textStyles = {
  back: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.text.medium,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(20),
    fontWeight: '700',
    color: tk.text.primary,
  }),
  error: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
  }),
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.secondary,
    marginTop: toRpx(8),
  }),
  cardTitle: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(16),
    fontWeight: '700',
    color: tk.text.primary,
  }),
  badgeText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(10),
    color: tk.surface.light,
  }),
  cardDesc: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    lineHeight: toRpx(18),
    color: tk.text.medium,
  }),
  meta: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  joinText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.brand.DEFAULT,
  }),
}

export default function ActivityList() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  // 对齐 mobile-rn ActivityScreen wrapper 状态机:items/loading/error + load/onRefresh
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<ActivityItem[]>('/activities')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(tt('activity.loadFailed', '加载活动失败'))
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [tt])

  useDidShow(() => {
    void load()
  })

  usePullDownRefresh(() => {
    void load()
  })

  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk)}>
        <View style={viewStyles.header()}>
          <View onTap={goBack}>
            <Text style={textStyles.back(tk)}>{tt('common.back', '返回')}</Text>
          </View>
          <Text style={textStyles.title(tk)}>{tt('activity.title', '平台活动')}</Text>
        </View>

        {error ? (
          <View style={viewStyles.errorText()}>
            <Text style={textStyles.error(tk)}>{error}</Text>
          </View>
        ) : null}

        {loading && items.length === 0 ? (
          <View style={viewStyles.center()}>
            <Text style={textStyles.muted(tk)}>{tt('common.loading', '加载中...')}</Text>
          </View>
        ) : (
          <ScrollView scrollY style={{ flex: 1 }}>
            <View style={viewStyles.listBody()}>
              {items.length === 0 ? (
                <View style={viewStyles.center()}>
                  <Text style={textStyles.muted(tk)}>{tt('activity.empty', '暂无活动')}</Text>
                </View>
              ) : (
                items.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <View style={viewStyles.separator()} /> : null}
                    <View style={viewStyles.card(tk)}>
                      <View style={viewStyles.titleRow()}>
                        <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                        <View style={viewStyles.badge(statusColor(item.status, tk))}>
                          <Text style={textStyles.badgeText(tk)}>
                            {tt(
                              ACTIVITY_STATUS_KEYS[item.status],
                              ACTIVITY_STATUS_FALLBACK[item.status],
                            )}
                          </Text>
                        </View>
                      </View>
                      <Text style={textStyles.cardDesc(tk)}>{item.description}</Text>
                      <Text style={textStyles.meta(tk)}>
                        {`${tt('activity.startTime', '开始时间')}: ${item.startTime}`}
                      </Text>
                      <Text style={textStyles.meta(tk)}>
                        {`${tt('activity.endTime', '结束时间')}: ${item.endTime}`}
                      </Text>
                      <Text style={textStyles.meta(tk)}>
                        {`${tt('activity.participants', '参与人数')}: ${item.participants}`}
                      </Text>
                      <View style={viewStyles.joinBtn()}>
                        <Text style={textStyles.joinText(tk)}>
                          {tt('activity.joinNow', '立即参与')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
