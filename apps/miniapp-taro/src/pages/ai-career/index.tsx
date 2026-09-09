// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

/** 从智能体描述中提取前 2 个关键词作为标签 */
function extractTags(name: string, desc: string): string[] {
  const text = `${name} ${desc}`
  const tagMap: Array<{ keyword: string; tag: string }> = [
    { keyword: t('aicareer.q1'), tag: t('aicareer.q2') },
    { keyword: t('aicareer.q3'), tag: t('aicareer.q4') },
    { keyword: t('aicareer.q5'), tag: t('aicareer.q6') },
    { keyword: t('aicareer.q7'), tag: t('aicareer.q8') },
    { keyword: t('aicareer.q9'), tag: t('aicareer.q10') },
    { keyword: t('aicareer.q11'), tag: t('aicareer.q12') },
    { keyword: t('aicareer.q13'), tag: t('aicareer.q14') },
    { keyword: t('aicareer.q15'), tag: t('aicareer.q16') },
    { keyword: t('aicareer.q17'), tag: t('aicareer.q18') },
    { keyword: t('aiAssistant.catStudy'), tag: t('aiAssistant.catStudy') },
    { keyword: t('favorites.manage'), tag: t('favorites.manage') },
    { keyword: t('aicareer.q19'), tag: t('aicareer.q20') },
  ]
  const tags: string[] = []
  for (const { keyword, tag } of tagMap) {
    if (text.includes(keyword) && !tags.includes(tag)) {
      tags.push(tag)
      if (tags.length >= 2) break
    }
  }
  return tags
}

export default function AiCareer() {
  const { t } = useI18n()
  const tt = useTt()
  const [list, setList] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = (await api.getAgentList()) as { list?: Array<Record<string, unknown>> }
      setList(res?.list || [])
    } catch (e) {
      logger.error('unknown', t('aicareer.q21'), e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/agent-dialogue/index?id=${id}` })
  }, [])

  return (
    <View className="min-h-screen bg-background">
      {/* 对齐 RN header:px 10dp=20rpx / pt 4dp=8rpx pb 8dp=16rpx / 标题 22dp=44rpx w700 */}
      <View className="px-[20rpx] pt-[8rpx] pb-[16rpx] bg-background">
        <Text className="text-[44rpx] font-bold text-foreground">{t('aiCareer.title')}</Text>
      </View>
      {/* 对齐 RN FlatList contentContainer:padding 16dp=32rpx / paddingBottom 32dp=64rpx;separator 12dp=24rpx */}
      <View className="px-[32rpx] pt-[32rpx] pb-[64rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-center text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('common.loading')}
            </Text>
          </View>
        ) : error ? (
          <View className="px-[20rpx] py-[16rpx] bg-[var(--color-danger-light)]">
            <View className="flex flex-row items-center justify-between">
              <Text className="flex-1 text-[28rpx] text-destructive">
                {tt('aiCareer.loadFailed', '加载失败')}
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
            {list.map((item) => {
              const id = String(item.id || '')
              const name = String(item.name || '')
              const desc = String(item.desc || '')
              const avatar = (item.avatar as string) || '/static/default-agent.png'
              const tags = extractTags(name, desc)
              const uses = Number(item.uses || 0)
              return (
                <ThemeRoot
                  key={id}
                  className="p-[28rpx] rounded-[24rpx] border border-[var(--color-border)] bg-card"
                >
                  <View key={id} onClick={() => onItemClick(id)} hoverClass="opacity-60">
                    {/* 对齐 RN cardHead:头像 44dp=88rpx / 12dp=24rpx 圆角 / muted 底 / 右距 10dp=20rpx */}
                    <View className="flex flex-row items-start">
                      <Image
                        className="w-[88rpx] h-[88rpx] rounded-[24rpx] bg-muted flex-shrink-0"
                        src={avatar}
                        mode="aspectFill"
                      />
                      <View className="flex-1 min-w-0 ml-[20rpx]">
                        <Text className="text-[32rpx] font-semibold text-foreground">
                          {name || t('aiCareer.guide')}
                        </Text>
                        {desc ? (
                          <Text className="mt-[16rpx] text-[28rpx] leading-[36rpx] text-muted-foreground line-clamp-2">
                            {desc}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {/* 对齐 RN tagRow:gap 6dp=12rpx / mt 10dp=20rpx;tag px8 py4 dp / 12dp=24rpx 圆角 / muted 底 / 11dp=22rpx 次级字 */}
                    {(tags.length > 0 || uses > 0) && (
                      <View className="flex flex-row items-center flex-wrap gap-[12rpx] mt-[20rpx]">
                        {tags.map((tag, idx) => (
                          <Text
                            key={idx}
                            className="py-[8rpx] px-[16rpx] rounded-[24rpx] text-[22rpx] text-muted-foreground bg-[var(--color-muted)]"
                          >
                            {tag}
                          </Text>
                        ))}
                      </View>
                    )}
                    {/* 对齐 RN cardFoot:gap 16dp=32rpx / mt 12dp=24rpx;meta 11dp=22rpx 三级色;CTA px14dp h30dp 圆角 24rpx brand 底 */}
                    {uses > 0 ? (
                      <View className="flex flex-row items-center gap-[32rpx] mt-[24rpx]">
                        <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                          {tt('aiCareer.useCount', '{n}人使用', { n: uses })}
                        </Text>
                        <View className="ml-auto flex flex-row items-center justify-center px-[28rpx] h-[60rpx] rounded-[24rpx] bg-[var(--color-brand)]">
                          <Text className="text-[28rpx] font-semibold text-[var(--color-surface-light)]">
                            {tt('aiAssistant.startChat', '开始对话')}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </ThemeRoot>
              )
            })}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-center text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('aiCareer.empty')}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
