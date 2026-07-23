import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getAgentList } from '@/api'
import {
  SearchBar,
  ModelTypeButtonGroup,
  ModelConfigDialog,
  BottomActionBar,
  EmptyState,
  type AgentInfo as AgentItem,
  type ModelConfig,
  type ModelType,
} from '@/components'
import { useI18n } from '@/i18n'
import './agent.css'

type CategoryKey = 'recommend' | 'office' | 'writing' | 'coding' | 'education' | 'life'

const CATEGORY_KEYWORDS: Record<Exclude<CategoryKey, 'recommend'>, string[]> = {
  office: ['办公', '会议', '邮件', 'excel', 'word', 'ppt', '文档', '表格', 'office'],
  writing: ['写', '文案', '文章', '创作', '小说', '内容', '写作', '文字'],
  coding: ['代码', '编程', '程序', '开发', 'bug', '函数', '前端', '后端', 'python', 'javascript', 'code'],
  education: ['学', '教', '课', '知识', '考试', '题', '教育', '讲解', '题解'],
  life: ['生活', '健康', '美食', '旅游', '运动', '购物', '日常', 'life'],
}

function detectCategory(name: string, desc: string): string {
  const text = `${name} ${desc}`.toLowerCase()
  for (const key of Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<CategoryKey, 'recommend'>>) {
    if (CATEGORY_KEYWORDS[key].some((kw) => text.includes(kw.toLowerCase()))) {
      return key
    }
  }
  return 'other'
}

export default function AgentPage() {
  const { t } = useI18n()
  const [list, setList] = useState<AgentItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<ModelType | ''>('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('recommend')
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<ModelConfig>({
    temperature: 0.7,
    maxTokens: 2048,
    streamEnabled: true,
  })

  const filtered = useMemo(() => {
    let arr = list
    if (activeType) {
      arr = arr.filter((a) => (a.category || '').toLowerCase().includes(activeType))
    }
    if (activeCategory !== 'recommend') {
      arr = arr.filter((a) => (a.category || '') === activeCategory)
    }
    if (keyword) {
      const kw = keyword.toLowerCase()
      arr = arr.filter(
        (a) =>
          (a.name || '').toLowerCase().includes(kw) || (a.desc || '').toLowerCase().includes(kw),
      )
    }
    return arr
  }, [list, keyword, activeType, activeCategory])

  const load = useCallback(async () => {
    try {
      const res = await getAgentList()
      const arr = (res.list || []).map((a) => ({
        id: String(a.id),
        name: a.name,
        desc: a.desc,
        avatar: a.avatar,
        category: detectCategory(a.name || '', a.desc || ''),
        uses: a.uses,
        isVipExclusive: a.isVipExclusive,
      })) as AgentItem[]
      setList(arr)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const goDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${id}` })
  }, [])

  const onSendQuery = useCallback(() => {
    if (!keyword.trim()) return
    Taro.navigateTo({ url: `/pages/ai/chat?prompt=${encodeURIComponent(keyword)}` })
  }, [keyword])

  useDidShow(load)

  const categories: Array<{ key: CategoryKey; label: string }> = [
    { key: 'recommend', label: t('ai.agentList.categories.recommend') },
    { key: 'office', label: t('ai.agentList.categories.office') },
    { key: 'writing', label: t('ai.agentList.categories.writing') },
    { key: 'coding', label: t('ai.agentList.categories.coding') },
    { key: 'education', label: t('ai.agentList.categories.education') },
    { key: 'life', label: t('ai.agentList.categories.life') },
  ]

  const hasFilter = !!(keyword || activeType || activeCategory !== 'recommend')

  return (
    <View className="page">
      <View className="bg-card pb-2 sticky top-0 z-10">
        <SearchBar
          value={keyword}
          placeholder={t('ai.agent.searchPlaceholder')}
          onInput={setKeyword}
          onSearch={onSendQuery}
          onClear={() => setKeyword('')}
        />
        <ModelTypeButtonGroup activeType={activeType} onSelect={(tp) => setActiveType(tp)} />
        <ScrollView scrollX enhanced showScrollbar={false} className="whitespace-nowrap px-3 pt-1">
          {categories.map((cat) => {
            const active = activeCategory === cat.key
            return (
              <View
                key={cat.key}
                className={`inline-block px-4 py-2 mr-2 rounded-lg text-sm ${active ? 'bg-[var(--color-primary)] text-white' : 'bg-muted text-muted-foreground'}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                <Text>{cat.label}</Text>
              </View>
            )
          })}
        </ScrollView>
      </View>

      {loading ? (
        <EmptyState text={t('common.loading')} />
      ) : filtered.length === 0 ? (
        <EmptyState text={hasFilter ? t('ai.agentList.noResult') : t('ai.agent.empty')} />
      ) : (
        <View className="px-3 py-2">
          <Text className="block text-xs text-muted-foreground mb-2">
            {t('ai.agent.count', { n: filtered.length })}
          </Text>
          {filtered.map((agent) => (
            <View
              key={agent.id}
              className="flex items-center bg-card rounded-lg p-3 mb-3"
              onClick={() => goDetail(agent.id)}
            >
              <Image
                className="w-[100rpx] h-[100rpx] rounded-lg bg-muted"
                src={agent.avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="flex-1 ml-3 min-w-0">
                <View className="flex items-center">
                  <Text className="text-[30rpx] text-foreground font-semibold truncate">
                    {agent.name}
                  </Text>
                  {agent.isVipExclusive && (
                    <Text className="ml-2 text-[20rpx] px-[8rpx] py-[2rpx] rounded bg-amber-50 text-amber-600">
                      VIP
                    </Text>
                  )}
                </View>
                {agent.desc && (
                  <Text className="block text-[24rpx] text-muted-foreground mt-1 truncate">
                    {agent.desc}
                  </Text>
                )}
                <View className="flex items-center mt-1">
                  {agent.category && agent.category !== 'other' && (
                    <Text className="text-[20rpx] px-[8rpx] py-[2rpx] mr-2 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      {t(`ai.agentList.categories.${agent.category}`)}
                    </Text>
                  )}
                  {agent.uses !== undefined && (
                    <Text className="text-[22rpx] text-muted-foreground">
                      {t('ai.agentList.useCount', { n: agent.uses })}
                    </Text>
                  )}
                </View>
              </View>
              <Text className="text-muted-foreground ml-2">›</Text>
            </View>
          ))}
        </View>
      )}

      <View className="h-20" />

      <View className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <BottomActionBar
          value={keyword}
          onInput={setKeyword}
          onSend={onSendQuery}
          onAttach={() => setShowConfig(true)}
          placeholder={t('ai.agent.inputPlaceholder')}
        />
      </View>

      <ModelConfigDialog
        visible={showConfig}
        config={config}
        onChange={setConfig}
        onClose={() => setShowConfig(false)}
      />
    </View>
  )
}
