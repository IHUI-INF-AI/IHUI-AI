// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/**
 * WebSearchCard — 设置页「网页搜索」开关卡片
 * (2026-09-21 自聊天输入区工具栏迁入统一设置页,与折叠策略迁移同批)
 *
 * D22 网页搜索:开启后普通问答(未选插件工具)也携带 web_search 最小工具集,
 * mergeAgentTools() 消费,与 selectedTools 互不替代。
 * 状态绑定 chat store(webSearchEnabled / setWebSearchEnabled),
 * localStorage 'ihui_web_search_enabled' 持久化链路不变,请求侧零改动。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Globe } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui-react'

import { useChatStore } from '@/stores/chat'

/** 设置页「网页搜索」开关卡片 */
export function WebSearchCard() {
  const t = useTranslations('chat')
  const webSearchEnabled = useChatStore((s) => s.webSearchEnabled)
  const setWebSearchEnabled = useChatStore((s) => s.setWebSearchEnabled)

  return (
    <Card data-testid="web-search-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          {t('webSearch')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t('webSearchDesc')}
          </span>
          <Switch
            id="settings-web-search"
            data-testid="settings-web-search"
            checked={webSearchEnabled}
            onCheckedChange={setWebSearchEnabled}
            className="shrink-0"
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default WebSearchCard
