// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/announcement/AnnouncementScreen UI 与
// apps/mobile-rn AnnouncementScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { fetchApi } from '@ihui/api-client'
import type { AnnouncementItem } from '@ihui/types'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

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
    padding: toRpx(10),
  }),
  separator: (tk: RnThemeTokens): CSSProperties => ({
    height: '1px',
    backgroundColor: tk.border.light,
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    padding: toRpx(12),
    borderRadius: toRpx(12),
    backgroundColor: tk.surface.light,
  }),
  titleRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: toRpx(8),
  }),
  pinnedBadge: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(8),
    backgroundColor: tk.warning.amberLight,
    overflow: 'hidden',
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
    fontWeight: '600',
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
  pinnedText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(10),
    color: tk.warning.amberText,
  }),
  cardTitle: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(18),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  cardContent: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    lineHeight: toRpx(18),
    color: tk.text.medium,
  }),
  publishTime: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
}

export default function AnnouncementList() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  // 对齐 mobile-rn AnnouncementScreen wrapper 状态机:items/loading/error + load/onRefresh/onPressItem
  const [items, setItems] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<AnnouncementItem[]>('/announcements')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(tt('announcement.loadFailed', '加载公告失败'))
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

  const onPressItem = (item: AnnouncementItem) => {
    Taro.navigateTo({ url: `/pages/announcement/detail/index?id=${encodeURIComponent(item.id)}` })
  }

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
          <Text style={textStyles.title(tk)}>{tt('announcement.title', '平台公告')}</Text>
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
            {items.length === 0 ? (
              <View style={viewStyles.center()}>
                <Text style={textStyles.muted(tk)}>{tt('announcement.empty', '暂无公告')}</Text>
              </View>
            ) : (
              <View style={viewStyles.listBody()}>
                {items.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <View style={viewStyles.separator(tk)} /> : null}
                    <View style={viewStyles.card(tk)} onTap={() => onPressItem(item)}>
                      <View style={viewStyles.titleRow()}>
                        {item.pinned ? (
                          <View style={viewStyles.pinnedBadge(tk)}>
                            <Text style={textStyles.pinnedText(tk)}>
                              {tt('announcement.pinned', '置顶')}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                      </View>
                      <Text style={textStyles.cardContent(tk)}>{item.content}</Text>
                      <Text style={textStyles.publishTime(tk)}>
                        {`${tt('announcement.publishTime', '发布时间')}: ${item.publishTime}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
