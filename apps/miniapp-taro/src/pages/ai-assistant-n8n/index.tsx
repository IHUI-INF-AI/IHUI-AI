// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

/** n8n 工作流状态映射(对齐 RN N8nModelScreen badgeRun/badgeStop + dotRun/dotStop) */
function getStatusInfo(
  status: unknown,
  tt: (k: string, fb: string) => string,
): { label: string; cls: string; dot: string } {
  const s = String(status || '').toLowerCase()
  if (s === 'active' || s === 'running' || s === '1' || s === 'published') {
    return {
      label: tt('aiAssistantN8n.statusActive', '运行中'),
      cls: 'text-success bg-[var(--color-success-light)]',
      dot: 'bg-[var(--color-success)]',
    }
  }
  if (s === 'draft' || s === '0') {
    return {
      label: tt('aiAssistantN8n.statusDraft', '草稿'),
      cls: 'text-muted-foreground bg-card',
      dot: 'bg-[var(--color-text-tertiary)]',
    }
  }
  if (s === 'inactive' || s === 'stopped' || s === 'offline') {
    return {
      label: tt('aiAssistantN8n.statusInactive', '已停用'),
      cls: 'text-muted-foreground bg-card',
      dot: 'bg-[var(--color-text-tertiary)]',
    }
  }
  return {
    label: tt('aiAssistantN8n.statusUnknown', '未知'),
    cls: 'text-muted-foreground bg-card',
    dot: 'bg-[var(--color-text-tertiary)]',
  }
}

export default function AiAssistantN8n() {
  const { t } = useI18n()
  const tt = useTt()
  const [list, setList] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = (await api.getN8nWorkflows()) as { list?: Array<Record<string, unknown>> }
      setList(res?.list || [])
    } catch (e) {
      logger.error('unknown', '加载N8N助手', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback(
    (item: Record<string, unknown>) => {
      const url = String(item.url || item.webhookUrl || item.n8nUrl || '')
      if (!url) {
        Taro.showToast({ title: tt('aiAssistantN8n.noUrl', '暂无访问地址'), icon: 'none' })
        return
      }
      Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
    },
    [tt],
  )

  return (
    <View className="min-h-screen bg-background">
      {/* 对齐 RN header:px 10dp=20rpx / py 12dp=24rpx / 标题 20dp=40rpx w600 / 透出 root 背景 */}
      <View className="flex flex-row items-center px-[20rpx] py-[24rpx] bg-background">
        <Text className="text-[40rpx] font-semibold text-foreground">
          {t('aiAssistantN8n.title')}
        </Text>
      </View>
      {/* 对齐 RN listBody:padding 10dp=20rpx;separator 12dp=24rpx */}
      <View className="p-[20rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-center text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('common.loading')}
            </Text>
          </View>
        ) : error ? (
          <View className="mt-[16rpx] px-[24rpx] py-[16rpx] rounded-[24rpx] bg-[var(--color-danger-light)]">
            {/* 对齐 RN errorBar:px12 py8 dp / 12dp=24rpx 圆角 / danger.light 底 / 14dp=28rpx destructive 文字 + brand 重试 */}
            <View className="flex flex-row items-center justify-between">
              <Text className="flex-1 text-[28rpx] text-destructive">
                {tt('aiAssistantN8n.loadFailed', '加载失败')}
              </Text>
              <Text
                className="ml-[16rpx] text-[28rpx] font-semibold text-[var(--color-brand)]"
                onClick={loadData}
              >
                {t('common.retry')}
              </Text>
            </View>
          </View>
        ) : list.length ? (
          <View className="flex flex-col gap-[24rpx]">
            {list.map((item, idx) => {
              const id = String(item.id || idx)
              const name = String(item.name || item.title || t('aiAssistantN8n.defaultName'))
              const desc = String(item.description || item.desc || '')
              const statusInfo = getStatusInfo(item.status, tt)
              return (
                <ThemeRoot
                  key={id}
                  className="p-[24rpx] rounded-[24rpx] border border-[var(--color-border)] bg-background"
                >
                  <View key={id} onClick={() => onItemClick(item)} hoverClass="opacity-60">
                    {/* 对齐 RN cardHead/cardTitleRow:dot 8dp=16rpx 圆点 + 名称 16dp=32rpx w600 */}
                    <View className="flex flex-row items-center justify-between">
                      <View className="flex flex-row items-center flex-1 min-w-0">
                        <View
                          className={`w-[16rpx] h-[16rpx] rounded-[8rpx] mr-[16rpx] flex-shrink-0 ${statusInfo.dot}`}
                        />
                        <Text className="text-[32rpx] font-semibold text-foreground flex-1 min-w-0 truncate">
                          {name}
                        </Text>
                      </View>
                      {/* 对齐 RN badge:11dp=22rpx w600 / px 8dp=16rpx py 3dp=6rpx / 12dp=24rpx 圆角 */}
                      <Text
                        className={`py-[6rpx] px-[16rpx] rounded-[24rpx] text-[22rpx] font-semibold flex-shrink-0 ml-[16rpx] ${statusInfo.cls}`}
                      >
                        {statusInfo.label}
                      </Text>
                    </View>
                    {desc ? (
                      <Text className="block mt-[16rpx] text-[28rpx] text-muted-foreground line-clamp-2">
                        {desc}
                      </Text>
                    ) : null}
                    {/* 对齐 RN cardUrl:mt 8dp=16rpx / 11dp=22rpx / brand 色 */}
                    <View className="mt-[16rpx]">
                      <Text className="text-[22rpx] text-[var(--color-brand)]">
                        {tt('aiAssistantN8n.openWorkflow', '打开工作流')} →
                      </Text>
                    </View>
                  </View>
                </ThemeRoot>
              )
            })}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-center text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('aiAssistantN8n.empty')}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
