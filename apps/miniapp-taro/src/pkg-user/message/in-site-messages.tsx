// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 MessageCenterScreen items 卡片的端内子模块:共享屏 TABS 里 order/course 两类的
// 订单走 Web 同款 GET /notifications?type=order。course 不在通知类型枚举内,不发请求。类型徽章取用与共享屏 typeLabel
// 同一套静态键(未知值默认「系统」档,与 spec default 分支同形)。
// 本页拆 ./ 子模块由还原度门并入载体面(check-miniapp-mirror-fidelity localModuleRels)。
// 分页"加载更多":GET /notifications 回 list 与 total;hasMore = rows.length < total,
// 不足一页或取不到 total 时不渲染入口 —— 拿不准就不给假按钮。
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'

import { useEffect, useState } from 'react'
import { get, patch } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { onToast } from '@/host/on-toast'

/** 与 src/api getMessages 同形状;本模块只用到这些字段 */
interface InSiteMessageRow {
  id: string
  title: string | null
  content: string | null
  msgType: string
  createdAt: string
  /** 仅当通知行带回 isRead */
  isRead?: boolean
}

interface InSiteMessageListRes {
  list?: Array<{
    id: string
    title?: string | null
    content?: string | null
    type?: string | null
    createdAt?: string
    isRead?: boolean
  }>
  total?: number
}

function toNoticeRows(list: InSiteMessageListRes['list']): InSiteMessageRow[] {
  return (list ?? []).map((row) => ({
    id: row.id,
    title: row.title ?? null,
    content: row.content ?? null,
    msgType: row.type ?? '',
    createdAt: row.createdAt ?? '',
    ...(typeof row.isRead === 'boolean' ? { isRead: row.isRead } : {}),
  }))
}

export interface InSiteMessagePaneProps {
  /** 站内消息分类键,取值与共享屏 TABS 的 order/course 同源 */
  msgType: 'order' | 'course'
  /** 2026-11-27 三端统一:点行打开全文抽屉(由父级注入,本模块不自造第二份详情壳) */
  onOpen?: (row: InSiteMessageRow) => void
}

/** 与 Web 通知列表同一页长 */
const PAGE_SIZE = 10

/**
 * Web 通知类型只有 system/order/project/comment/mention/follow。
 * course 不在枚举里,发 type=course 会 400,与 Web 对 like/favorite 一样不发请求。
 */
const NOTIFICATION_TAB: Partial<Record<InSiteMessagePaneProps['msgType'], string>> = {
  order: 'order',
}

export function InSiteMessagePane({ msgType, onOpen }: InSiteMessagePaneProps) {
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
    const type = NOTIFICATION_TAB[msgType]
    if (!type) {
      setRows([])
      setTotal(0)
      setPage(1)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setPage(1)
    const cancel = waitUntilReady(() => {
      if (cancelled) return
      void get<InSiteMessageListRes>('/notifications', {
        type,
        page: 1,
        pageSize: PAGE_SIZE,
      })
        .then((res) => {
          if (cancelled) return
          setRows(toNoticeRows(res.list))
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
    const type = NOTIFICATION_TAB[msgType]
    if (!type) return
    setLoadingMore(true)
    const next = page + 1
    void get<InSiteMessageListRes>('/notifications', {
      type,
      page: next,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        const incoming = toNoticeRows(res.list)
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id))
          return [...prev, ...incoming.filter((r) => !seen.has(r.id))]
        })
        if (typeof res.total === 'number') setTotal(res.total)
        setPage(next)
      })
      .catch(() => {
        onToast(t('messageCenter.loadFailed'), { kind: 'error' })
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
    <View className="space-y-2 p-[20rpx]">
      {rows.map((row) => {
        const unread = row.isRead === false
        return (
          <View
            key={row.id}
            className={`rounded-lg border border-stroke-default px-[32rpx] py-[24rpx] ${
              unread ? 'bg-primary/5' : 'bg-card'
            }`}
            onClick={() => {
              // 先开全文(任何已读状态都有反馈),未读再走已读出口
              onOpen?.(row)
              if (!unread) return
              void patch(`/notifications/${encodeURIComponent(row.id)}/read`)
                .then(() => {
                  setRows((prev) =>
                    prev.map((item) => (item.id === row.id ? { ...item, isRead: true } : item)),
                  )
                })
                .catch(() => {
                  onToast(t('common.failed'), { kind: 'error' })
                })
            }}
          >
            <View className="flex flex-row items-center gap-[12rpx]">
              <Text className="rounded-md bg-muted px-[10rpx] py-[2rpx] text-caption font-semibold text-muted-foreground">
                {typeLabel(row.msgType)}
              </Text>
              <Text
                className={`flex-1 truncate text-body font-medium ${
                  unread ? 'text-primary' : 'text-foreground'
                }`}
              >
                {row.title || row.content || t('message.unnamedRoom')}
              </Text>
              {unread ? (
                <View className="h-[12rpx] w-[12rpx] shrink-0 rounded-full bg-primary" />
              ) : null}
            </View>
            {row.title && row.content ? (
              <Text className="mt-[4rpx] line-clamp-2 text-label text-muted-foreground">
                {row.content}
              </Text>
            ) : null}
            <Text className="mt-[8rpx] text-label tabular-nums text-muted-foreground">
              {row.createdAt}
            </Text>
          </View>
        )
      })}
      {/* 加载更多(spec 同位:hasMore 为假时整块不渲染;loadingMore 期间禁重复触发) */}
      {hasMore ? (
        <View
          className={`block text-center text-body py-[20rpx] ${
            loadingMore ? 'text-muted-foreground' : 'text-foreground'
          }`}
          hoverClass={loadingMore ? 'none' : 'opacity-60'}
          onClick={loadMore}
        >
          <Text>{t('messageCenter.loadMore')}</Text>
        </View>
      ) : null}
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
