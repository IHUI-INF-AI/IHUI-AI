// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PlazaPage — 广场聚合页(2026-07-25 立)。
 *
 * 数据源:getPlazaList() → GET /api/plaza(分页 PageData<PlazaItem>)。
 * 列表项:标题 + 摘要 + 来源(types)+ 创建者 + 时间,点击 chrome.tabs.create 跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { getPlazaList, type PlazaItem } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@ihui/ui-react'
import { apiFailureToText, toUserFriendlyMessage } from '@ihui/shared/utils'
import { useI18n } from '../../../src/i18n'
import { fmtDateOnly as fmtDate } from '../../../lib/date-utils'
import { openInWeb as openItemInWeb } from '../../../lib/open-in-web'

export default function PlazaPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<PlazaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPlazaList({ page: 1, pageSize: 20 })
      if (res.success) setItems(res.data.list)
      // 失败分支必须走共享唯一出口 `apiFailureToText`:它按 errorCode → HTTP status → 兜底
      // 定"这条错误是谁",再出中文。原写法 `res.error || t('common.failed')` 把服务端原始
      // message 直接上屏 —— 会话过期时展示的是英文原文 "Invalid or expired token",
      // 而这条端点根本没有 errorCode,身份只剩 `status` 一档,不走出口就一定丢。
      // (守门 135 判的是 `throw` 站点;本处是"message 直接进 state 显示"那一半,
      //  那道门结构上看不见 —— 见 packages/shared/src/utils/error-messages.ts 的
      //  apiFailureToText 头注。)
      else setError(apiFailureToText(res, t('common.failed')))
    } catch (e) {
      // 同一条判序:抛出来的多是网络/取消类 Error,原始 message 是英文(`fetch failed` 等),
      // 直接上屏等于把堆栈术语给用户。无 Error 时才回本页自己的词表键(保住本地化兜底)。
      setError(e instanceof Error ? toUserFriendlyMessage(e) : t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时加载一次,load 依赖 t/setState 但无需重跑
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
      <div className="m-2 flex flex-col items-center gap-2">
        <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs text-center">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.plaza')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((p) => (
            <Card
              key={p.id}
              className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openItemInWeb(`/plaza/${encodeURIComponent(p.id)}`)}
            >
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm leading-snug line-clamp-2">{p.title}</CardTitle>
              </CardHeader>
              {p.description ? (
                <CardContent className="px-3 pb-2 -mt-1">
                  <p className="m-0 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      {p.types?.[0] ? <Badge variant="secondary">{p.types[0]}</Badge> : null}
                      <span className="truncate">{p.creator || '—'}</span>
                    </span>
                    <span className="whitespace-nowrap">{fmtDate(p.createdAt)}</span>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="px-3 pb-2 -mt-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      {p.types?.[0] ? <Badge variant="secondary">{p.types[0]}</Badge> : null}
                      <span className="truncate">{p.creator || '—'}</span>
                    </span>
                    <span className="whitespace-nowrap">{fmtDate(p.createdAt)}</span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
