// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, type TtFn, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

type CategoryKey = 'all' | 'office' | 'writing' | 'coding' | 'education' | 'life'

const CATEGORY_KEYWORDS = (tt: TtFn): Record<Exclude<CategoryKey, 'all'>, string[]> => ({
  office: [
    tt('ai.agentList.categories.office', '办公'),
    t('aiAgent.d1'),
    t('aiAgent.d2'),
    'excel',
    'word',
    'ppt',
    t('messageInput.document'),
    t('aiAgent.d3'),
    'office',
  ],
  writing: [
    tt('aiAgent.d4', '写'),
    t('aigcPublish.typeText'),
    t('bookmark.type.article'),
    t('aiAgent.d5'),
    t('aiAgent.d6'),
    t('feedback.content'),
    t('ai.agentList.categories.writing'),
    t('aiAgent.d7'),
  ],
  coding: [
    t('aigroup.r1'),
    t('ai.agentList.categories.coding'),
    t('aigroup.r2'),
    t('pagesindexindex.d5'),
    'bug',
    t('aigroup.r3'),
    t('aigroup.r4'),
    t('aigroup.r5'),
    'python',
    'javascript',
    'code',
  ],
  education: [
    tt('aiAgent.d8', '学'),
    t('aiAgent.d9'),
    t('aiAgent.d10'),
    t('aiAgent.d11'),
    t('aiAgent.d12'),
    t('aiAgent.d13'),
    t('ai.agentList.categories.education'),
    t('aiAgent.d14'),
    t('aiAgent.d15'),
  ],
  life: [
    tt('ai.agentList.categories.life', '生活'),
    t('aiAgent.d16'),
    t('aiAgent.d17'),
    t('aiAgent.d18'),
    t('aiAgent.d19'),
    t('aiAgent.d20'),
    t('aiAgent.d21'),
    'life',
  ],
})

function detectCategory(
  name: string,
  desc: string,
  keywords: Record<Exclude<CategoryKey, 'all'>, string[]>,
): string {
  const text = `${name} ${desc}`.toLowerCase()
  for (const [key, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => text.includes(kw.toLowerCase()))) {
      return key
    }
  }
  return 'other'
}

export default function AiGroup() {
  const { t } = useI18n()
  const tt = useTt()
  const [list, setList] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = (await api.getAgentList()) as { list?: Array<Record<string, unknown>> }
      setList(res?.list || [])
    } catch (e) {
      logger.error('unknown', t('aigroup.q1'), e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => {
    loadData()
  })

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return list
    return list.filter((item) => {
      const name = String(item.name || '')
      const desc = String(item.desc || '')
      return detectCategory(name, desc, CATEGORY_KEYWORDS(tt)) === activeCategory
    })
  }, [list, activeCategory, tt])

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${id}` })
  }, [])

  const categories: Array<{ key: CategoryKey; label: string }> = [
    { key: 'all', label: tt('aiGroup.tabAll', '全部') },
    { key: 'office', label: tt('aiGroup.tabOffice', '办公') },
    { key: 'writing', label: tt('aiGroup.tabWriting', '写作') },
    { key: 'coding', label: tt('aiGroup.tabCoding', '编程') },
    { key: 'education', label: tt('aiGroup.tabEducation', '教育') },
    { key: 'life', label: tt('aiGroup.tabLife', '生活') },
  ]

  return (
    <View className="min-h-screen bg-background">
      {/* 页头标题(对齐 SharedAgentScreen title: fontSize 22dp→44rpx / 700 / px-20rpx pt-pb-16rpx) */}
      <Text className="px-[20rpx] pt-[16rpx] pb-[16rpx] text-[44rpx] font-bold text-foreground">
        {t('aiGroup.title')}
      </Text>
      {/* 分类 chips(对齐 RN AgentScreen 分类 tab: bg-muted / 激活 bg-primary 反白, radius 8dp→16rpx) */}
      <ScrollView
        scrollX
        enhanced
        showScrollbar={false}
        className="whitespace-nowrap px-[20rpx] pb-[16rpx]"
      >
        {categories.map((cat) => (
          <View
            key={cat.key}
            className={`inline-block py-[12rpx] px-[28rpx] mr-[16rpx] rounded-[16rpx] ${activeCategory === cat.key ? 'bg-primary' : 'bg-[var(--color-muted)]'}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            <Text
              className={
                activeCategory === cat.key
                  ? 'text-[26rpx] font-semibold text-[var(--color-primary-foreground)]'
                  : 'text-[26rpx] text-muted-foreground'
              }
            >
              {cat.label}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View className="p-[32rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-center text-muted-foreground text-[28rpx]">
              {t('common.loading')}
            </Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-center text-[28rpx] text-[var(--color-danger)]">
              {tt('aiGroup.loadFailed', '加载失败')}
            </Text>
            <View
              className="mt-[24rpx] py-[16rpx] px-[32rpx] bg-primary rounded-[24rpx]"
              onClick={loadData}
            >
              <Text className="text-[32rpx] text-[var(--color-primary-foreground)]">
                {t('common.retry')}
              </Text>
            </View>
          </View>
        ) : filtered.length ? (
          <View className="flex flex-col gap-[24rpx]">
            {filtered.map((item) => {
              const id = String(item.id || '')
              const name = String(item.name || '')
              const desc = String(item.desc || '')
              const avatar = (item.avatar as string) || '/static/default-agent.png'
              const uses = Number(item.uses || 0)
              const isVip = Boolean(item.isVipExclusive)
              return (
                <ThemeRoot
                  key={id}
                  className="flex flex-row items-center p-[28rpx] rounded-[24rpx] border border-[var(--color-border)] bg-[var(--color-surface-light)]"
                >
                  <View
                    key={id}
                    className="flex flex-row items-center flex-1 min-w-0"
                    onClick={() => onItemClick(id)}
                  >
                    <Image
                      className="w-[96rpx] h-[96rpx] rounded-[24rpx] bg-[var(--color-muted)] shrink-0"
                      src={avatar}
                      mode="aspectFill"
                    />
                    <View className="flex-1 min-w-0 ml-[24rpx]">
                      <View className="flex items-center gap-[12rpx]">
                        <Text className="flex-1 text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                          {name || t('aiGroup.agent')}
                        </Text>
                        {isVip ? (
                          // VIP 徽章(对齐 SharedAgentScreen vipBadge: bg-warning 反白, radius 4dp→8rpx)
                          <View className="py-[8rpx] px-[12rpx] rounded-[8rpx] bg-[var(--color-warning)] shrink-0">
                            <Text className="text-[20rpx] font-semibold text-[var(--color-surface-light)]">
                              VIP
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {desc ? (
                        <Text className="block mt-[16rpx] text-[28rpx] leading-[36rpx] text-muted-foreground overflow-hidden text-ellipsis line-clamp-2">
                          {desc}
                        </Text>
                      ) : null}
                      {uses > 0 ? (
                        <Text className="block mt-[16rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
                          {tt('aiGroup.useCount', '{n}人使用', { n: uses })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </ThemeRoot>
              )
            })}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-center text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('aiGroup.empty')}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
