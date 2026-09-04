// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/post-detail/PostDetailScreen UI 与
// apps/mobile-rn PostDetailScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import { getPlazaDetail } from '@ihui/api-client'
import type { PostDetailItem } from '@ihui/types'
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
  center: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
  }),
  backBtn: (): CSSProperties => ({
    alignSelf: 'flex-start',
  }),
  errorBackBtn: (): CSSProperties => ({
    alignSelf: 'flex-start',
    marginTop: toRpx(12),
  }),
  metaRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: toRpx(8),
    marginTop: toRpx(6),
    marginBottom: toRpx(12),
  }),
  circleBadge: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(4),
    backgroundColor: tk.surface.card,
    overflow: 'hidden',
  }),
  imageRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: toRpx(8),
    marginTop: toRpx(8),
  }),
  detailImage: (): CSSProperties => ({
    width: toRpx(100),
    height: toRpx(100),
    borderRadius: toRpx(8),
  }),
  statRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    columnGap: toRpx(12),
    marginTop: toRpx(16),
  }),
  statBtn: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(6),
    paddingBottom: toRpx(6),
    borderRadius: toRpx(12),
    backgroundColor: tk.surface.card,
  }),
  statIcon: (): CSSProperties => ({
    width: toRpx(12),
    height: toRpx(12),
    marginRight: toRpx(4),
  }),
}

const textStyles = {
  muted: (tk: RnThemeTokens): CSSProperties => ({
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
  circle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.secondary,
  }),
  meta: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  content: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    lineHeight: toRpx(22),
    color: tk.text.medium,
  }),
  detailText: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    lineHeight: toRpx(20),
    color: tk.text.secondary,
  }),
  statText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.medium,
  }),
}

export default function PlazaDetail() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  // 路由参数:广场需求 id(对齐 RN route.params.id)
  const id = Taro.getCurrentInstance().router?.params?.id ?? ''
  const [post, setPost] = useState<PostDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 加载:对齐 mobile-rn PostDetailScreen useEffect 状态机(getPlazaDetail → PostDetailItem 映射)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getPlazaDetail(id)
      if (cancelled) return
      if (res.success) {
        const item = res.data
        setPost({
          id: item.id,
          title: item.title,
          content: item.description ?? '',
          author: item.creator ?? tt('postDetail.anonymous', '匿名'),
          createdAt: item.createdAt ?? '',
          likes: 0,
          comments: 0,
          status: item.status,
          taskStatus: item.taskStatus,
          imgs: item.imgs,
          types: item.types,
          categories: item.categories,
          lowestPrice: item.lowestPrice,
          peakPrice: item.peakPrice,
          contact: item.contact,
          cycle: item.cycle,
          cycleUnit: item.cycleUnit,
          closingTime: item.closingTime,
        })
      } else {
        setError(res.error || tt('postDetail.loadFailed', '加载帖子失败'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, tt])

  const goBack = () => {
    // 详情页从广场 tab 进入,navigateBack 失败时回落 switchTab 广场(tab 页不可 navigateTo)
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/plaza/index/index' })
    })
  }

  // 图片列表归一化(对齐共享屏:兼容逗号分隔字符串与数组两种 imgs 结构)
  const imageUrls =
    typeof post?.imgs === 'string'
      ? post.imgs
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean)
      : (post?.imgs ?? [])

  if (loading) {
    return (
      <ThemeRoot>
        <View style={viewStyles.center()}>
          <Text style={textStyles.muted(tk)}>{tt('common.loading', '加载中...')}</Text>
        </View>
      </ThemeRoot>
    )
  }

  if (error || !post) {
    return (
      <ThemeRoot>
        <View style={viewStyles.center()}>
          <Text style={textStyles.error(tk)}>
            {error || tt('postDetail.loadFailed', '加载帖子失败')}
          </Text>
          <View style={viewStyles.errorBackBtn()} onTap={goBack}>
            <Text style={textStyles.back(tk)}>{tt('common.back', '返回')}</Text>
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
            <Text style={textStyles.title(tk)}>{post.title}</Text>
            <View style={viewStyles.metaRow()}>
              <Text style={textStyles.author(tk)}>{post.author}</Text>
              {post.circleName ? (
                <View style={viewStyles.circleBadge(tk)}>
                  <Text style={textStyles.circle(tk)}>#{post.circleName}</Text>
                </View>
              ) : null}
              <Text style={textStyles.meta(tk)}>{post.createdAt}</Text>
            </View>
            <Text style={textStyles.content(tk)}>{post.content}</Text>
            {imageUrls.length > 0 ? (
              <View style={viewStyles.imageRow()}>
                {imageUrls.map((url, index) => (
                  <Image
                    key={`${url}-${index}`}
                    src={url}
                    mode="aspectFill"
                    style={viewStyles.detailImage()}
                  />
                ))}
              </View>
            ) : null}
            {post.types?.length || post.categories?.length ? (
              <Text style={textStyles.detailText(tk)}>
                {`${tt('postDetail.typesLabel', '类型')}：${post.types?.join('、') || '-'} ${tt('postDetail.categoriesLabel', '分类')}：${post.categories?.join('、') || '-'}`}
              </Text>
            ) : null}
            {post.taskStatus || post.status ? (
              <Text style={textStyles.detailText(tk)}>
                {`${tt('postDetail.taskStatusLabel', '任务状态')}：${post.taskStatus || '-'} ${tt('postDetail.reviewStatusLabel', '审核状态')}：${post.status || '-'}`}
              </Text>
            ) : null}
            {post.lowestPrice != null || post.peakPrice != null ? (
              <Text style={textStyles.detailText(tk)}>
                {`${tt('postDetail.priceLabel', '价格')}：￥${post.lowestPrice ?? '-'} - ￥${post.peakPrice ?? '-'}`}
              </Text>
            ) : null}
            {post.cycle ? (
              <Text style={textStyles.detailText(tk)}>
                {`${tt('postDetail.cycleLabel', '周期')}：${post.cycle}${post.cycleUnit ?? ''}`}
              </Text>
            ) : null}
            {post.closingTime ? (
              <Text style={textStyles.detailText(tk)}>
                {`${tt('postDetail.closingTimeLabel', '截止时间')}：${post.closingTime}`}
              </Text>
            ) : null}
            {post.contact ? (
              <Text style={textStyles.detailText(tk)}>
                {`${tt('postDetail.contactLabel', '联系方式')}：${post.contact}`}
              </Text>
            ) : null}
            <View style={viewStyles.statRow()}>
              <View style={viewStyles.statBtn(tk)}>
                <Image
                  src="/static/images/icons/heart.svg"
                  mode="aspectFit"
                  style={viewStyles.statIcon()}
                />
                <Text style={textStyles.statText(tk)}>{post.likes}</Text>
              </View>
              <View style={viewStyles.statBtn(tk)}>
                <Image
                  src="/static/images/icons/message-circle.svg"
                  mode="aspectFit"
                  style={viewStyles.statIcon()}
                />
                <Text style={textStyles.statText(tk)}>{post.comments}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
