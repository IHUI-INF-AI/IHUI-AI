import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

type CategoryKey = 'all' | 'office' | 'writing' | 'coding' | 'education' | 'life'

const CATEGORY_KEYWORDS: Record<Exclude<CategoryKey, 'all'>, string[]> = {
  office: ['办公', '会议', '邮件', 'excel', 'word', 'ppt', '文档', '表格', 'office'],
  writing: ['写', '文案', '文章', '创作', '小说', '内容', '写作', '文字'],
  coding: ['代码', '编程', '程序', '开发', 'bug', '函数', '前端', '后端', 'python', 'javascript', 'code'],
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
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('aiGroup.title')}</Text>
      </View>
      <ScrollView scrollX enhanced showScrollbar={false} className="tabs">
        {categories.map((cat) => (
          <View
            key={cat.key}
            className={`tab${activeCategory === cat.key ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            <Text>{cat.label}</Text>
          </View>
        ))}
      </ScrollView>
      <View className="page-content">
        {loading ? (
          <View className="state-box">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="state-box">
            <Text className="state-text">{tt('aiGroup.loadFailed', '加载失败')}</Text>
            <View className="retry-btn" onClick={loadData}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : filtered.length ? (
          <View className="card-list">
            {filtered.map((item) => {
              const id = String(item.id || '')
              const name = String(item.name || '')
              const desc = String(item.desc || '')
              const avatar = (item.avatar as string) || '/static/default-agent.png'
              const uses = Number(item.uses || 0)
              const isVip = Boolean(item.isVipExclusive)
              return (
                <View key={id} className="agent-card" onClick={() => onItemClick(id)}>
                  <Image className="avatar" src={avatar} mode="aspectFill" />
                  <View className="info">
                    <View className="title-row">
                      <Text className="name">{name || t('aiGroup.agent')}</Text>
                      {isVip ? <Text className="vip-tag">VIP</Text> : null}
                    </View>
                    {desc ? <Text className="desc">{desc}</Text> : null}
                    <View className="meta-row">
                      {uses > 0 ? (
                        <Text className="uses">
                          {tt('aiGroup.useCount', '{n}人使用', { n: uses })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text className="arrow">›</Text>
                </View>
              )
            })}
          </View>
        ) : (
          <View className="state-box">
            <Text className="state-text">{t('aiGroup.empty')}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
