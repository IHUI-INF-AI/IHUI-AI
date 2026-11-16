// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/**
 * TitleUpdateCard — 设置页「任务标题 · 实时更新」卡片(2026-11-16 立)。
 *
 * 开关决定第 3 轮回复后是否按最新对话重估任务标题;关闭后标题固定为创建时生成的名称。
 * 侧栏悬停始终可同时看到「创建时标题 / 当前标题」,与本开关无关。
 * 读写复用 chat/title-update-policy 模块(localStorage + 事件广播)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui-react'

import {
  readTitleAutoUpdate,
  writeTitleAutoUpdate,
  TITLE_UPDATE_POLICY_EVENT,
} from '@/components/chat/title-update-policy'

export function TitleUpdateCard() {
  const t = useTranslations('chat.titleAutoUpdate')
  const [enabled, setEnabled] = React.useState(true)

  React.useEffect(() => {
    const sync = () => setEnabled(readTitleAutoUpdate())
    sync()
    window.addEventListener(TITLE_UPDATE_POLICY_EVENT, sync)
    return () => window.removeEventListener(TITLE_UPDATE_POLICY_EVENT, sync)
  }, [])

  return (
    <Card data-testid="title-update-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium">{t('label')}</p>
            <p className="mt-0.5 text-body text-muted-foreground">{t('desc')}</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={writeTitleAutoUpdate}
            aria-label={t('label')}
            data-testid="title-update-switch"
            className="shrink-0"
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default TitleUpdateCard
