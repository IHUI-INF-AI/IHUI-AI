// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/announcement-detail/AnnouncementDetailScreen UI 与
// apps/mobile-rn AnnouncementDetailScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { fetchApi } from '@ihui/api-client'
import type { AnnouncementDetailItem } from '@ihui/types'
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
  bodyScroll: (): CSSProperties => ({
    flex: 1,
  }),
  body: (): CSSProperties => ({
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(32),
  }),
  center: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: toRpx(16),
    backgroundColor: tk.surface.bg,
  }),
  backBtn: (): CSSProperties => ({
    alignSelf: 'flex-start',
  }),
  metaRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: toRpx(8),
    marginBottom: toRpx(12),
  }),
  btn: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(12),
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    height: toRpx(44),
    borderRadius: toRpx(12),
    backgroundColor: tk.brand.DEFAULT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
}

const textStyles = {
  muted: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  error: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
    marginBottom: toRpx(8),
    textAlign: 'center',
  }),
  back: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.text.secondary,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(22),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  author: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.secondary,
    fontWeight: '500',
  }),
  meta: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  content: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    lineHeight: toRpx(24),
    color: tk.text.medium,
  }),
  btnText: (tk: RnThemeTokens): CSSProperties => ({
    color: tk.surface.light,
    fontSize: toRpx(14),
  }),
}

export default function AnnouncementDetail() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  // 路由参数:公告 id(对齐 RN route.params.id)
  const id = Taro.getCurrentInstance().router?.params?.id ?? ''
  const [item, setItem] = useState<AnnouncementDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 加载:对齐 mobile-rn AnnouncementDetailScreen(fetchApi /announcements/:id)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setError('')
      try {
        const res = await fetchApi<AnnouncementDetailItem>(`/announcements/${id}`)
        if (!res.success) throw new Error()
        if (!cancelled) setItem(res.data ?? null)
      } catch {
        if (!cancelled) setError(tt('announcementDetail.loadFailed', '加载公告详情失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, tt])

  const goBack = () => {
    // 详情页从公告列表进入,navigateBack 失败时回落首页 tab
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  if (loading) {
    return (
      <ThemeRoot>
        <View style={viewStyles.center(tk)}>
          <Text style={textStyles.muted(tk)}>{tt('common.loading', '加载中...')}</Text>
        </View>
      </ThemeRoot>
    )
  }

  if (error || !item) {
    return (
      <ThemeRoot>
        <View style={viewStyles.center(tk)}>
          <Text style={textStyles.error(tk)}>
            {error || tt('announcementDetail.empty', '公告不存在或已删除')}
          </Text>
          <View style={viewStyles.btn(tk)} onTap={goBack}>
            <Text style={textStyles.btnText(tk)}>{tt('common.back', '返回')}</Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk)}>
        <ScrollView scrollY style={viewStyles.bodyScroll()}>
          <View style={viewStyles.body()}>
            <View style={viewStyles.backBtn()} onTap={goBack}>
              <Text style={textStyles.back(tk)}>{tt('common.back', '返回')}</Text>
            </View>
            <Text style={textStyles.title(tk)}>{item.title}</Text>
            <View style={viewStyles.metaRow()}>
              <Text style={textStyles.author(tk)}>{item.author}</Text>
              <Text style={textStyles.meta(tk)}>{item.publishTime}</Text>
            </View>
            <Text style={textStyles.content(tk)}>{item.content}</Text>
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
