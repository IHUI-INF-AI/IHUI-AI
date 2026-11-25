// 镜像 packages/app/src/features/square/SquareScreen.tsx（端内原生实现，声明与承载同一屏）
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-24:承接底部第 4 个 tab「动态」。
 * 载体 = 端内原生实现(自 pkg-user/square 整体迁入主包,tabBar 页必须留主包),
 * 依据 existing 第 10 行结论「不套 RN 壳 —— 该壳在本端渲染为空」:数据走 Taro.request,
 * UI 用 Taro 原生组件,与 web 广场页 / RN NewsScreen 同源同业务(已发布资讯分页流)。
 * 与「分享星球」页刻意解耦:share 是 35KB 完整业务页,保留原样退为普通页,入口移到「我的」页。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { BASE_URL } from '@/utils/api-config'
import ThemeRoot from '@/components/ThemeRoot'
import { rnRadius } from '@ihui/design-tokens'
import { useTt } from '@/i18n'
import type { ArticleRow, Envelope } from './types'
import { PAGE_SIZE, authHeader, fmtDate, goDetail } from './helpers'

export default function SquarePage() {
  const tt = useTt()
  const [rows, setRows] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef(1)
  const totalRef = useRef(0)
  const busyRef = useRef(false)

  const load = useCallback(async (reset: boolean) => {
    if (busyRef.current) return
    busyRef.current = true
    const nextPage = reset ? 1 : pageRef.current
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)
    try {
      const res = await Taro.request({
        url: `${BASE_URL}/news/articles`,
        method: 'GET',
        data: { page: nextPage, pageSize: PAGE_SIZE },
        header: authHeader(),
      })
      const body = res.data as Envelope
      if (!body || body.success === false) {
        throw new Error(body?.message || '加载失败，请稍后重试')
      }
      const list = body.data?.list ?? []
      totalRef.current = body.data?.total ?? list.length
      pageRef.current = nextPage + 1
      setRows((prev) => (reset ? list : [...prev, ...list]))
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络异常，请稍后重试')
      if (reset) setRows([])
    } finally {
      busyRef.current = false
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void load(true)
  }, [load])

  useReachBottom(() => {
    if (!loadingMore && rows.length < totalRef.current) void load(false)
  })

  const hasMore = rows.length < totalRef.current

  return (
    <ThemeRoot>
      <View style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
        <View
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24rpx 32rpx',
            backgroundColor: 'var(--color-card)',
            borderBottom: '1rpx solid var(--color-border)',
          }}
        >
          <View>
            <Text style={{ fontSize: '32rpx', fontWeight: 600, color: 'var(--color-foreground)' }}>
              动态
            </Text>
            <Text
              style={{
                display: 'block',
                fontSize: '22rpx',
                color: 'var(--color-muted-foreground)',
                marginTop: '6rpx',
              }}
            >
              AI 与行业最新资讯
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ padding: '80rpx 32rpx', alignItems: 'center' }}>
            <Text style={{ fontSize: '26rpx', color: 'var(--color-muted-foreground)' }}>
              加载中…
            </Text>
          </View>
        ) : error ? (
          <View style={{ padding: '80rpx 32rpx', alignItems: 'center' }}>
            <Text style={{ fontSize: '26rpx', color: 'var(--color-destructive)' }}>{error}</Text>
            <View
              onClick={() => void load(true)}
              style={{
                marginTop: '24rpx',
                padding: '12rpx 32rpx',
                borderRadius: rnRadius.md,
                backgroundColor: 'var(--color-muted)',
              }}
            >
              <Text style={{ fontSize: '24rpx', color: 'var(--color-foreground)' }}>重试</Text>
            </View>
          </View>
        ) : rows.length === 0 ? (
          <View style={{ padding: '120rpx 32rpx', alignItems: 'center' }}>
            <Text style={{ fontSize: '26rpx', color: 'var(--color-muted-foreground)' }}>
              暂无内容
            </Text>
            <View
              onClick={() => void load(true)}
              style={{
                marginTop: '24rpx',
                padding: '12rpx 32rpx',
                borderRadius: rnRadius.md,
                backgroundColor: 'var(--color-muted)',
              }}
            >
              <Text style={{ fontSize: '24rpx', color: 'var(--color-foreground)' }}>刷新</Text>
            </View>
          </View>
        ) : (
          <View>
            <View
              style={{
                margin: '24rpx 24rpx 0',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                backgroundColor: 'var(--color-card)',
              }}
            >
              {rows.map((item, idx) => (
                <View
                  key={item.id}
                  onClick={() => goDetail(item.id)}
                  style={{
                    display: 'flex',
                    padding: '26rpx 28rpx',
                    borderTop: idx === 0 ? 'none' : '1rpx solid var(--color-border)',
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: '28rpx',
                        color: 'var(--color-foreground)',
                        fontWeight: 600,
                      }}
                    >
                      {item.title}
                    </Text>
                    {item.summary ? (
                      <Text
                        style={{
                          display: 'block',
                          fontSize: '24rpx',
                          color: 'var(--color-muted-foreground)',
                          marginTop: '8rpx',
                        }}
                      >
                        {item.summary}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        display: 'block',
                        fontSize: '22rpx',
                        color: 'var(--color-muted-foreground)',
                        marginTop: '10rpx',
                      }}
                    >
                      {item.authorName || item.categoryName || '官方'}
                      {typeof item.viewCount === 'number'
                        ? ` · ${tt('articleList.views', '{{count}} 次阅读', { count: item.viewCount })}`
                        : ''}
                      {item.publishedAt || item.createdAt
                        ? ` · ${fmtDate(item.publishedAt ?? item.createdAt)}`
                        : ''}
                    </Text>
                  </View>
                  {item.coverImage ? (
                    <Image
                      src={item.coverImage}
                      mode="aspectFill"
                      style={{
                        width: '160rpx',
                        height: '112rpx',
                        marginLeft: '20rpx',
                        borderRadius: 'var(--radius-md)',
                      }}
                    />
                  ) : null}
                </View>
              ))}
            </View>
            <View style={{ padding: '24rpx 0', alignItems: 'center' }}>
              <Text style={{ fontSize: '22rpx', color: 'var(--color-muted-foreground)' }}>
                {loadingMore ? '加载中…' : hasMore ? '上拉加载更多' : '没有更多了'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
