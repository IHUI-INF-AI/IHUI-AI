import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

type CategoryKey = 'all' | 'office' | 'writing' | 'coding' | 'education' | 'life'

const CATEGORY_KEYWORDS: Record<Exclude<CategoryKey, 'all'>, string[]> = {
  office: ['办公', '会议', '邮件', 'excel', 'word', 'ppt', '文档', '表格', 'office'],
  writing: ['写', '文案', '文章', '创作', '小说', '内容', '写作', '文字'],
  coding: [
    '代码',
    '编程',
    '程序',
    '开发',
    'bug',
    '函数',
    '前端',
    '后端',
    'python',
    'javascript',
    'code',
  ],
  education: ['学', '教', '课', '知识', '考试', '题', '教育', '讲解', '题解'],
  life: ['生活', '健康', '美食', '旅游', '运动', '购物', '日常', 'life'],
}

function detectCategory(name: string, desc: string): string {
  const text = `${name} ${desc}`.toLowerCase()
  for (const key of Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<CategoryKey, 'all'>>) {
    if (CATEGORY_KEYWORDS[key].some((kw) => text.includes(kw.toLowerCase()))) {
      return key
    }
  }
  return 'other'
}

export default function AiGroup() {
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
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = (await api.getAgentList()) as { list?: Array<Record<string, unknown>> }
      setList(res?.list || [])
    } catch (e) {
      logger.error('unknown', '加载AI团队', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return list
    return list.filter((item) => {
      const name = String(item.name || '')
      const desc = String(item.desc || '')
      return detectCategory(name, desc) === activeCategory
    })
  }, [list, activeCategory])

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
                <View
                  key={id}
                  className="flex items-center p-[24rpx] bg-card rounded-[12rpx]"
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
