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
      <View className="p-[24rpx] bg-card">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('aiGroup.title')}</Text>
      </View>
      <ScrollView
        scrollX
        enhanced
        showScrollbar={false}
        className="whitespace-nowrap py-[16rpx] px-[24rpx] bg-card"
      >
        {categories.map((cat) => (
          <View
            key={cat.key}
            className={`inline-block py-[12rpx] px-[28rpx] mr-[16rpx] rounded-[8rpx] text-[26rpx] ${activeCategory === cat.key ? 'text-primary font-semibold' : 'text-muted-foreground bg-background'}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            <Text>{cat.label}</Text>
          </View>
        ))}
      </ScrollView>
      <View className="p-[24rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">
              {t('common.loading')}
            </Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">
              {tt('aiGroup.loadFailed', '加载失败')}
            </Text>
            <View
              className="mt-[24rpx] py-[16rpx] px-[48rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[26rpx]"
              onClick={loadData}
            >
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : filtered.length ? (
          <View className="flex flex-col gap-[16rpx]">
            {filtered.map((item) => {
              const id = String(item.id || '')
              const name = String(item.name || '')
              const desc = String(item.desc || '')
              const avatar = (item.avatar as string) || '/static/default-agent.png'
              const uses = Number(item.uses || 0)
              const isVip = Boolean(item.isVipExclusive)
              return (
                <ThemeRoot className="flex items-center p-[24rpx] bg-card rounded-[12rpx]">
      <View key={id}
                  onClick={() => onItemClick(id)}
                >
                  <Image
                    className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-background shrink-0"
                    src={avatar}
                    mode="aspectFill"
                  />
                  <View className="flex-1 min-w-0 ml-[24rpx]">
                    <View className="flex items-center">
                      <Text className="text-[30rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {name || t('aiGroup.agent')}
                      </Text>
                      {isVip ? (
                        // 保留:#d97706 为 VIP 深金色(amber-600),tokens.css 仅有亮金 --color-vip-gold-start(#ffd700)/--color-vip-gold-end(#ffaa00),深金≠亮金,替换会降低浅底对比度且无对应 rgba 背景 token,保留原值
                        <Text className="ml-[12rpx] py-[2rpx] px-[12rpx] rounded-[6rpx] text-[20rpx] text-[#d97706] bg-[rgba(217,119,6,0.1)] shrink-0">
                          VIP
                        </Text>
                      ) : null}
                    </View>
                    {desc ? (
                      <Text className="block mt-[8rpx] text-[24rpx] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {desc}
                      </Text>
                    ) : null}
                    <View className="flex items-center mt-[8rpx]">
                      {uses > 0 ? (
                        <Text className="text-[22rpx] text-primary">
                          {tt('aiGroup.useCount', '{n}人使用', { n: uses })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text className="ml-[16rpx] text-[32rpx] text-muted-foreground shrink-0">›</Text>
                </View>
    </ThemeRoot>
              )
            })}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">
              {t('aiGroup.empty')}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
