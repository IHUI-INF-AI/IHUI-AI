/**
 * FollowListPage — 关注/粉丝通用列表页(2026-08-21 立)。
 *
 * 复用扩展侧边栏既有范式(get 接口 + 加载/错误/空态 + Card 列表),
 * 供 我的关注(/me/following)与 我的粉丝(/me/fans)两个路由共用。
 */
import { createElement, useEffect, useState } from 'react'
import { User, type LucideIcon } from 'lucide-react'
import type { ApiResult } from '@ihui/types'
import { type FollowUser, type PageData, type PageQuery } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDate } from '../../../lib/date-utils'

interface FollowListPageProps {
  /** 页面标题 i18n key */
  titleKey: string
  /** 空态提示 i18n key */
  emptyKey: string
  /** 列表图标(lucide 组件或 ReactNode,向后兼容 emoji 字符串) */
  icon: LucideIcon | string
  /** 数据拉取函数(关注/粉丝分页接口) */
  fetchList: (query: PageQuery) => Promise<ApiResult<PageData<FollowUser>>>
}

export function FollowListPage({ titleKey, emptyKey, icon, fetchList }: FollowListPageProps) {
  const { t } = useI18n()
  const [items, setItems] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchList({ page: 1, pageSize: 30 })
      if (res.success) setItems(res.data.list)
      else setError(res.error || t('common.failed'))
    } catch {
      setError(t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时加载一次,不随 t 变化重跑
  }, [])

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="m-2 bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs">
        <div className="mb-2">{error}</div>
        <button
          type="button"
          onClick={load}
          className="px-2 py-1 rounded-md border border-destructive bg-transparent text-destructive text-xs cursor-pointer hover:bg-destructive/10"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t(titleKey)}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground py-10 px-4 text-sm">
          <span className="text-3xl" aria-hidden>
            {typeof icon === 'function'
              ? createElement(icon as LucideIcon, { size: 28, className: 'shrink-0' })
              : icon}
          </span>
          <div>{t(emptyKey)}</div>
        </div>
      ) : (
        items.map((u) => (
          <Card key={u.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-3 flex items-center gap-2.5 min-[640px]:p-3">
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted shrink-0 flex items-center justify-center text-base">
                  <User size={20} className="text-muted-foreground" aria-hidden />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{u.nickname || u.username}</div>
                {u.bio ? (
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{u.bio}</div>
                ) : (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t('page.follow.followedAt')} {fmtDate(u.followedAt)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

export default FollowListPage
