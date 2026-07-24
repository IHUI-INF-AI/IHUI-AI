import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

/** 从智能体描述中提取前 2 个关键词作为标签 */
function extractTags(name: string, desc: string): string[] {
  const text = `${name} ${desc}`
  const tagMap: Array<{ keyword: string; tag: string }> = [
    { keyword: '面试', tag: '面试' },
    { keyword: '简历', tag: '简历' },
    { keyword: '职业', tag: '职业规划' },
    { keyword: '规划', tag: '职业规划' },
    { keyword: '职场', tag: '职场' },
    { keyword: '晋升', tag: '晋升' },
    { keyword: '跳槽', tag: '跳槽' },
    { keyword: '薪资', tag: '薪资' },
    { keyword: '技能', tag: '技能提升' },
    { keyword: '学习', tag: '学习' },
    { keyword: '管理', tag: '管理' },
    { keyword: '沟通', tag: '沟通' },
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
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
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
      logger.error('unknown', '加载生涯指导', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/agent-dialogue/index?id=${id}` })
  }, [])

  return (
    <View className="min-h-screen bg-background">
      <View className="p-[24rpx] bg-card">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('aiCareer.title')}</Text>
      </View>
      <View className="p-[24rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{tt('aiCareer.loadFailed', '加载失败')}</Text>
            <View className="mt-[24rpx] py-[16rpx] px-[48rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[26rpx]" onClick={loadData}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : list.length ? (
          <View className="flex flex-col gap-[16rpx]">
            {list.map((item) => {
              const id = String(item.id || '')
              const name = String(item.name || '')
              const desc = String(item.desc || '')
              const avatar = (item.avatar as string) || '/static/default-agent.png'
              const tags = extractTags(name, desc)
              const uses = Number(item.uses || 0)
              return (
                <View key={id} className="p-[24rpx] bg-card rounded-[12rpx]" onClick={() => onItemClick(id)}>
                  <View className="flex items-start">
                    <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-background flex-shrink-0" src={avatar} mode="aspectFill" />
                    <View className="flex-1 min-w-0 ml-[24rpx]">
                      <Text className="text-[30rpx] font-semibold text-foreground">{name || t('aiCareer.guide')}</Text>
                      {desc ? <Text className="mt-[8rpx] text-[24rpx] text-muted-foreground line-clamp-2">{desc}</Text> : null}
                    </View>
                  </View>
                  {(tags.length > 0 || uses > 0) && (
                    <View className="flex items-center flex-wrap gap-[12rpx] mt-[16rpx]">
                      {tags.map((tag, idx) => (
                        <Text key={idx} className="py-[4rpx] px-[16rpx] rounded-[6rpx] text-[22rpx] text-primary bg-[rgba(0,122,255,0.08)]">
                          {tag}
                        </Text>
                      ))}
                      {uses > 0 ? (
                        <Text className="text-[22rpx] text-muted-foreground ml-auto">
                          {tt('aiCareer.useCount', '{n}人使用', { n: uses })}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('aiCareer.empty')}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
