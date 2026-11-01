// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 MessageCenterScreen items 卡片的端内子模块:共享屏 TABS 里 order/course 两类的
// 站内消息(edu_messages,GET /messages?msgType=)。类型徽章取用与共享屏 typeLabel
// 同一套静态键(未知值默认「系统」档,与 spec default 分支同形)。
// 本页拆 ./ 子模块由还原度门并入载体面(check-miniapp-mirror-fidelity localModuleRels)。
// 分页"加载更多"对齐 spec(onLoadMore/hasMore 支,2026-11-01):后端 GET /messages 本就回
// { list, total }(page/pageSize/msgType 均在 schema 内);hasMore = rows.length < total,
// 不足一页或取不到 total 时不渲染入口 —— 拿不准就不给假按钮。
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { get } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'

/** 与 src/api getMessages 同形状;本模块只用到这些字段 */
interface InSiteMessageRow {
  id: string
  title: string | null
  content: string | null
  msgType: string
  createdAt: string
}

interface InSiteMessageListRes {
  list: InSiteMessageRow[]
  total?: number
}

export interface InSiteMessagePaneProps {
  /** 站内消息分类键,取值与共享屏 TABS 的 order/course 同源 */
  msgType: 'order' | 'course'
}

/** 分页尺寸与 spec/RN 屏同源口径(后端默认 20;两处显式给值防漂移) */
const PAGE_SIZE = 20

export function InSiteMessagePane({ msgType }: InSiteMessagePaneProps) {
  const { t } = useI18n()
  // gate 对象每次渲染都是新字面量,只有 waitUntilReady(useCallback([]))是稳定引用;
  // effect 依赖只解构取它,取整枚 gate 会每次重渲染重跑 ⇒ 请求循环。
  const { waitUntilReady } = useAuthReadyGate()
  const [rows, setRows] = useState<InSiteMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPage(1)
    const cancel = waitUntilReady(() => {
      if (cancelled) return
      void get<InSiteMessageListRes>('/messages', { page: 1, pageSize: PAGE_SIZE, msgType })
        .then((res) => {
          if (cancelled) return
          setRows(res.list || [])
          setTotal(typeof res.total === 'number' ? res.total : 0)
        })
        .catch(() => {
          if (!cancelled) {
            setRows([])
            setTotal(0)
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })
    return () => {
      cancelled = true
      cancel()
    }
  }, [waitUntilReady, msgType])

  /** 下一页:按 id 去重防重入追加;失败显式喊出(loadFailed 与 spec 同词表),不静默吞。 */
  const loadMore = () => {
    if (loadingMore) return
    setLoadingMore(true)
    const next = page + 1
    void get<InSiteMessageListRes>('/messages', {
      page: next,
      pageSize: PAGE_SIZE,
      msgType,
    })
      .then((res) => {
        const incoming = res.list || []
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id))
          return [...prev, ...incoming.filter((r) => !seen.has(r.id))]
        })
        if (typeof res.total === 'number') setTotal(res.total)
        setPage(next)
      })
      .catch(() => {
        Taro.showToast({ title: t('messageCenter.loadFailed'), icon: 'none' })
      })
      .finally(() => setLoadingMore(false))
  }

  const hasMore = total > 0 && rows.length < total

  const typeLabel = (type: string): string => {
    if (type === 'order') return t('messageCenter.type.order')
    if (type === 'course') return t('messageCenter.type.course')
    return t('message.tabs.system')
  }

  if (loading) {
    return (
      <Text className="block text-center text-body text-muted-foreground py-[96rpx]">
        {t('common.loading')}
      </Text>
    )
  }
  if (!rows.length) {
    return (
      <Text className="block text-center text-body text-muted-foreground py-[96rpx]">
        {t('message.empty')}
      </Text>
    )
  }
  return (
    <View className="p-[20rpx]">
      {rows.map((row) => (
        <View key={row.id} className="py-[20rpx] px-[16rpx] rounded-xl">
          <View className="flex flex-row items-center gap-[12rpx]">
            <Text className="px-[10rpx] py-[2rpx] rounded-md bg-muted text-caption font-semibold text-muted-foreground">
              {typeLabel(row.msgType)}
            </Text>
            <Text className="flex-1 text-strong font-semibold text-foreground truncate">
              {row.title || row.content || t('message.unnamedRoom')}
            </Text>
          </View>
          {row.title && row.content ? (
            <Text className="block mt-[4rpx] text-[length:26rpx] text-muted-foreground truncate">
              {row.content}
            </Text>
          ) : null}
          <Text className="block mt-[4rpx] text-caption text-muted-foreground">
            {row.createdAt}
          </Text>
        </View>
      ))}
      {/* 加载更多(spec 同位:hasMore 为假时整块不渲染;loadingMore 期间禁重复触发) */}
      {hasMore ? (
        <Text
          className={`block text-center text-body py-[20rpx] ${
            loadingMore ? 'text-muted-foreground' : 'text-foreground'
          }`}
          onClick={loadMore}
        >
          {t('messageCenter.loadMore')}
        </Text>
      ) : null}
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
