// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import type { Agent } from '@ihui/api-client'
import { getAgentList } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

type AgentItem = Pick<Agent, 'id' | 'name'> & {
  description?: string
  avatar?: string
  useCount?: number
  tags?: string[]
}

type SortType = 'hot' | 'new'

export default function CategoryDetailPage() {
  const { t } = useI18n()
  const [list, setList] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortType>('hot')
  const [categoryId, setCategoryId] = useState('')

  const load = useCallback(async () => {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const id = (current?.options?.id || current?.options?.categoryId || '') as string
    setCategoryId(id)
    setLoading(true)
    try {
      const res = await getAgentList()
      let agents: AgentItem[] = (res.list || []).map((a) => ({
        id: a.id,
        name: a.name,
        description: a.desc,
        avatar: a.avatar,
        useCount: a.uses,
      }))
      if (sort === 'hot') {
        agents = [...agents].sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      } else {
        agents = [...agents].reverse()
      }
      setList(agents)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sort])

  useDidShow(load)

  const handleSelect = (agent: AgentItem) => {
    Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${agent.id}` })
  }

  const toggleSort = () => {
    setSort(sort === 'hot' ? 'new' : 'hot')
  }

  return (
    <ThemeRoot>
      {/* RN: container bg surface.bg */}
      <View className="min-h-screen bg-background">
        {/* RN header: paddingHorizontal 10dp=20rpx, paddingBottom 12dp=24rpx; 顶部 48dp 为 RN 状态栏补偿,小程序由系统导航栏承担 */}
        <View className="flex items-center justify-between px-[20rpx] pt-[16rpx] pb-[24rpx]">
          <Text className="text-[40rpx] font-semibold text-foreground">
            {categoryId
              ? t('categoryDetail.categoryId', { id: categoryId })
              : t('categoryDetail.allCategories')}
          </Text>
          {/* RN tab: paddingHorizontal 10dp=20rpx, paddingVertical 6dp=12rpx, radius 6dp=12rpx, bg surface.card */}
          <View
            className="flex items-center px-[20rpx] py-[12rpx] rounded-[12rpx] bg-card"
            onClick={toggleSort}
          >
            <Text className="text-[28rpx] text-muted-foreground">
              {sort === 'hot' ? t('categoryDetail.hot') : t('categoryDetail.new')}
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="px-[20rpx] py-[32rpx]">
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} className="flex items-center gap-[24rpx] py-[24rpx] animate-pulse">
                <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" />
                <View className="flex-1 space-y-2">
                  <View className="h-3 w-1/3 rounded bg-muted" />
                  <View className="h-2.5 w-2/3 rounded bg-muted" />
                </View>
              </View>
            ))}
          </View>
        ) : list.length === 0 ? (
          <View className="flex items-center justify-center py-[56rpx]">
            <Text className="text-[32rpx] text-muted-foreground">{t('categoryDetail.empty')}</Text>
          </View>
        ) : (
          <View className="px-[20rpx] pb-[48rpx]">
            {list.map((agent) => (
              <View
                key={agent.id}
                className="flex items-center gap-[24rpx] p-[24rpx] mb-[24rpx] bg-card border border-[var(--color-border)] rounded-[12rpx]"
                onClick={() => handleSelect(agent)}
              >
                {agent.avatar ? (
                  <Image
                    className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted"
                    src={agent.avatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="flex items-center justify-center w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted">
                    <Text className="text-[32rpx] font-medium text-muted-foreground">
                      {agent.name.charAt(0)}
                    </Text>
                  </View>
                )}
                <View className="flex-1 min-w-0">
                  <Text className="block text-[32rpx] font-semibold text-foreground truncate">
                    {agent.name}
                  </Text>
                  <Text className="block text-[28rpx] text-muted-foreground truncate mt-[16rpx]">
                    {agent.description || t('categoryDetail.noDesc')}
                  </Text>
                  {agent.tags && agent.tags.length > 0 && (
                    <View className="flex flex-wrap mt-[8rpx]">
                      {agent.tags.slice(0, 2).map((tag, i) => (
                        <Text
                          key={i}
                          className="text-[20rpx] px-[12rpx] py-[4rpx] mr-[8rpx] rounded bg-muted text-muted-foreground"
                        >
                          {tag}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
                {agent.useCount !== undefined && (
                  <Text className="text-[28rpx] text-muted-foreground">
                    {t('categoryDetail.useCount', { n: agent.useCount })}
                  </Text>
                )}
                {/* RN itemArrow '›': fontSize 20dp=40rpx, color text.tertiary */}
                <Text className="text-[40rpx] text-[var(--color-text-tertiary)]">›</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
