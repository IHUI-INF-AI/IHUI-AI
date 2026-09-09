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
// (RN token → app.css 语义变量,暗色经 ThemeRoot .dark 自动适配)
function statusColor(status: ActivityItem['status']): string {
  if (status === 'ongoing') return 'var(--color-brand)'
  if (status === 'upcoming') return 'var(--color-warning-amber)'
  return 'var(--color-text-tertiary)'
}

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐共享屏 createStyles)=====
// 颜色全部引用 app.css 语义 token(与 RN rn-tokens 一一映射):
// surface.bg→--color-background / surface.light(卡片白底)→--color-card /
// border.light→--color-border / text.primary→--color-foreground / text.secondary→--color-muted-foreground /
// text.tertiary→--color-text-tertiary / brand.DEFAULT→--color-brand / danger.DEFAULT→--color-danger /
// 徽章文字(RN surface.light 对比字)→--color-primary-foreground(亮白/暗黑,暗色下徽章底色提亮后保持可读)

const viewStyles = {
  container: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--color-background)',
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
  card: (): CSSProperties => ({
    padding: toRpx(14),
    borderRadius: toRpx(12),
    borderWidth: '2rpx',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-card)',
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
  back: (): CSSProperties => ({
    fontSize: toRpx(16),
    color: 'var(--color-text-medium)',
  }),
  title: (): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(20),
    fontWeight: '700',
    color: 'var(--color-foreground)',
  }),
  error: (): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-danger)',
  }),
  muted: (): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-muted-foreground)',
    marginTop: toRpx(8),
  }),
  cardTitle: (): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(16),
    fontWeight: '700',
    color: 'var(--color-foreground)',
  }),
  badgeText: (): CSSProperties => ({
    fontSize: toRpx(10),
    color: 'var(--color-primary-foreground)',
  }),
  cardDesc: (): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    lineHeight: toRpx(18),
    color: 'var(--color-text-medium)',
  }),
  meta: (): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(11),
    color: 'var(--color-text-tertiary)',
  }),
  joinText: (): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-brand)',
  }),
}

export default function ActivityList() {
  const tt = useTt()
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
      <View style={viewStyles.container()}>
        <View style={viewStyles.header()}>
          <View onTap={goBack}>
            <Text style={textStyles.back()}>{tt('common.back', '返回')}</Text>
          </View>
          <Text style={textStyles.title()}>{tt('activity.title', '平台活动')}</Text>
        </View>

        {error ? (
          <View style={viewStyles.errorText()}>
            <Text style={textStyles.error()}>{error}</Text>
          </View>
        ) : null}

        {loading && items.length === 0 ? (
          <View style={viewStyles.center()}>
            <Text style={textStyles.muted()}>{tt('common.loading', '加载中...')}</Text>
          </View>
        ) : (
          <ScrollView scrollY style={{ flex: 1 }}>
            <View style={viewStyles.listBody()}>
              {items.length === 0 ? (
                <View style={viewStyles.center()}>
                  <Text style={textStyles.muted()}>{tt('activity.empty', '暂无活动')}</Text>
                </View>
              ) : (
                items.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <View style={viewStyles.separator()} /> : null}
                    <View style={viewStyles.card()}>
                      <View style={viewStyles.titleRow()}>
                        <Text style={textStyles.cardTitle()} className="text-ellipsis">
                          {item.title}
                        </Text>
                        <View style={viewStyles.badge(statusColor(item.status))}>
                          <Text style={textStyles.badgeText()}>
                            {tt(
                              ACTIVITY_STATUS_KEYS[item.status],
                              ACTIVITY_STATUS_FALLBACK[item.status],
                            )}
                          </Text>
                        </View>
                      </View>
                      <Text style={textStyles.cardDesc()} className="text-ellipsis-2">
                        {item.description}
                      </Text>
                      <Text style={textStyles.meta()}>
                        {`${tt('activity.startTime', '开始时间')}: ${item.startTime}`}
                      </Text>
                      <Text style={textStyles.meta()}>
                        {`${tt('activity.endTime', '结束时间')}: ${item.endTime}`}
                      </Text>
                      <Text style={textStyles.meta()}>
                        {`${tt('activity.participants', '参与人数')}: ${item.participants}`}
                      </Text>
                      <View style={viewStyles.joinBtn()}>
                        <Text style={textStyles.joinText()}>
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
