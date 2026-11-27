// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpRight, Copy, Check } from 'lucide-react'

import type { NoticeDetailData } from '@ihui/types'
import { noticeDetailCopyText } from '@ihui/shared/notifications'
import { Button } from '@ihui/ui-react'
import { Modal } from '@/components/feedback'
import { formatDate } from '@/lib/date-utils'
import { NOTICE_TYPE_META } from './NotificationCenter'

export interface NoticeDetailDialogProps {
  /** null = 关闭;非空 = 显示该条全文 */
  detail: NoticeDetailData | null
  onClose: () => void
  /** 「查看会话」:detail.sessionId 存在且传了回调才渲染入口 */
  onOpenSession?: (sessionId: string) => void
}

/** 站内消息全文弹窗(2026-11-27 三端统一口径:单击消息 = 就地看全文)。
 *
 *  列表行只显示截断的标题/摘要,详情必须给出**完整正文**(换行保留、可滚动),
 *  并把「复制」「查看会话」放进弹层,而不是让用户点一下只看到"已读"状态变化。
 *  Web 端壳;RN/小程序共用 packages/app 的同字段 Sheet,数据投影三端共用 @ihui/shared。 */
export function NoticeDetailDialog({ detail, onClose, onOpenSession }: NoticeDetailDialogProps) {
  const t = useTranslations('messageDetail')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [copied, setCopied] = React.useState(false)

  // 每次换一条消息都要重置复制态,否则上一条的「已复制」会串到这一条。
  React.useEffect(() => {
    setCopied(false)
  }, [detail?.id])

  const handleCopy = () => {
    if (!detail) return
    const text = noticeDetailCopyText(detail)
    if (!text) return
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        // 剪贴板权限被拒时不假装成功:按钮保持「复制」,用户可再次点击
      })
  }

  // 列表与详情的类型图标同源(NotificationCenter 的 NOTICE_TYPE_META),不端内另抄一份。
  const meta = NOTICE_TYPE_META[detail?.level ?? 'info'] ?? NOTICE_TYPE_META.info
  const Icon = meta.icon

  return (
    <Modal open={detail !== null} onClose={onClose} size="md" title={t('title')}>
      {detail && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-px flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-body font-semibold leading-snug text-foreground">
                {detail.title || t('title')}
              </p>
              {detail.createdAt && (
                <p className="mt-0.5 text-label tabular-nums text-muted-foreground">
                  {formatDate(detail.createdAt, locale)}
                </p>
              )}
            </div>
          </div>
          {/* 全文区:保留换行与长串换行,超长内容内部滚动,不把弹窗撑出屏幕 */}
          <div className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/30 px-3 py-2.5 text-body leading-relaxed text-foreground">
            {detail.content || t('notFound')}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!detail.content}>
              {copied ? (
                <Check className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1 h-3.5 w-3.5" />
              )}
              {copied ? t('copied') : t('copy')}
            </Button>
            <div className="flex items-center gap-2">
              {detail.sessionId && onOpenSession && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenSession(detail.sessionId as string)}
                >
                  {t('viewSession')}
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" onClick={onClose} data-testid="notice-detail-close">
                {tc('close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
