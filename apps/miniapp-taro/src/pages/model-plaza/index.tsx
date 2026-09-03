// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, t } from '@/i18n'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { fetchModels, type LlmModel } from '@/api'
import { FALLBACK_MODELS } from '@ihui/shared/constants'
import ThemeRoot from '@/components/ThemeRoot'
import './index.css'

type ModelType = 'text' | 'image' | 'av'
type TypeFilter = 'all' | ModelType

interface ModelDisplay {
  id: string
  name: string
  provider: string
  desc: string
  inputPrice: string
  outputPrice: string
  tags: string[]
  payMode: string
  type: ModelType
  contextLength: number
}

const PAGE_SIZE = 8

/** 厂商图标(本地 SVG,统一颜色 #6366F1,源自 src/static/images/icons/ Lucide 集) */
const PROVIDER_ICONS: Record<string, string> = {
  OpenAI: '/static/images/icons/bot.svg',
  Anthropic: '/static/images/icons/brain.svg',
  Google: '/static/images/icons/search.svg',
  StepFun: '/static/images/icons/zap.svg',
  阿里云: '/static/images/icons/cloud.svg',
  百度: '/static/images/icons/paw-print.svg',
  字节: '/static/images/icons/rocket.svg',
  智谱: '/static/images/icons/sparkles.svg',
}

/** Mock 厂商优先顺序 */
const PROVIDER_ORDER = [
  'OpenAI',
  'Anthropic',
  'Google',
  'StepFun',
  t('modelplaza.r1'),
  t('modelplaza.r2'),
  t('modelplaza.r3'),
  t('modelplaza.r4'),
]

/**
 * Mock 数据 — API 失败或返回空时使用,保证视觉演示完整(对标原项目 modelPlazaData.js)。
 * 字段含 Input/Output 价格(¥/千token)、标签、计费模式。
 */
/** 已验证兜底模型(仅后端 /llm/models 不可达或返回空时降级,映射自共享 FALLBACK_MODELS) */
const FALLBACK_MODEL_DISPLAYS: ModelDisplay[] = FALLBACK_MODELS.map((f) => ({
  id: f.value,
  name: f.label,
  provider: f.vendor,
  desc: '',
  inputPrice: '0',
  outputPrice: '0',
  tags: [],
  payMode: t('common.free'),
  type: 'text',
  contextLength: 128000,
}))

function inferType(model: LlmModel): ModelType {
  const name = (model.name || '').toLowerCase()
  if (/dall-?e|stable|sdxl|wanx|vl|vision|kling|jimeng|draw|img|sora|veo/.test(name)) return 'image'
  if (/whisper|tts|voice|audio|asr|paraformer|suno|music/.test(name)) return 'av'
  return 'text'
}

export default function ModelPlazaIndex() {
  const { t } = useI18n()
  const tt = useTt()

  /** 类型 tab(全部用现有 common.all,其他文案为修复严重缺失直接硬编码) */
  const TYPE_TABS: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: tt('modelPlaza.tabAll', '全部') },
    { key: 'text', label: tt('modelPlaza.tabText', '文本') },
    { key: 'image', label: tt('modelPlaza.tabImage', '图像') },
    { key: 'av', label: tt('modelPlaza.tabAv', '音视频') },
  ]

  const inferTags = useCallback(
    (model: LlmModel): string[] => {
      const tags: string[] = []
      const name = (model.name || '').toLowerCase()
      if (/gpt-?4|gpt4/.test(name)) tags.push('GPT-4')
      else if (/gpt-?3/.test(name)) tags.push('GPT-3.5')
      else if (/claude/.test(name)) tags.push('Claude')
      else if (/gemini/.test(name)) tags.push('Gemini')
      else if (/qwen/.test(name)) tags.push('Qwen')
      else if (/glm/.test(name)) tags.push('GLM')
      else if (/doubao/.test(name)) tags.push('Doubao')
      else if (/ernie|wenxin/.test(name)) tags.push('ERNIE')
      else if (/step/.test(name)) tags.push('Step')
      if (model.context_length > 0) {
        const k = model.context_length / 1000
        tags.push(
          k >= 1000
            ? `${k / 1000}M${tt('modelPlaza.contextLength', '上下文')}`
            : `${k}K${tt('modelPlaza.contextLength', '上下文')}`,
        )
      }
      return tags
    },
    [tt],
  )

  const normalizeModel = useCallback(
    (raw: LlmModel): ModelDisplay => {
      return {
        id: String(raw.id ?? Math.random().toString(36).slice(2)),
        name: raw.name || '',
        provider: raw.provider || 'Unknown',
        desc: `${raw.provider || ''} ${raw.name || ''} ${tt('modelPlaza.providerModel', '模型')}`,
        inputPrice: String(raw.input_price ?? 0),
        outputPrice: '-',
        tags: inferTags(raw),
        payMode: tt('modelPlaza.payMode', '按量计费'),
        type: inferType(raw),
        contextLength: raw.context_length ?? 0,
      }
    },
    [inferTags, tt],
  )

  function typeLabel(type: ModelType): string {
    if (type === 'image') return tt('modelPlaza.tabImage', '图像')
    if (type === 'av') return tt('modelPlaza.tabAv', '音视频')
    return tt('modelPlaza.tabText', '文本')
  }

  const [models, setModels] = useState<ModelDisplay[]>([])
  const [providerId, setProviderId] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const initializedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchModels()
      const list = (res?.models || []).map(normalizeModel)
      setModels(list.length > 0 ? list : FALLBACK_MODEL_DISPLAYS)
    } catch {
      setModels(FALLBACK_MODEL_DISPLAYS)
    } finally {
      setLoading(false)
    }
  }, [normalizeModel])

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    void load()
  }, [load])

  // 厂商列表(从模型数据 distinct 提取,按 MOCK 顺序优先排序)
  const providers = useMemo(() => {
    const set = new Set<string>()
    models.forEach((m) => set.add(m.provider))
    return Array.from(set).sort((a, b) => {
      const ai = PROVIDER_ORDER.indexOf(a)
      const bi = PROVIDER_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [models])

  // 默认选第一个厂商(数据加载后初始化一次)
  useEffect(() => {
    if (providerId === '' && providers.length > 0) {
      setProviderId(providers[0] || '')
    }
  }, [providers, providerId])

  // 当前厂商 + 类型双过滤
  const filteredList = useMemo(() => {
    return models.filter(
      (m) => m.provider === providerId && (typeFilter === 'all' || m.type === typeFilter),
    )
  }, [models, providerId, typeFilter])

  // 客户端分页(每次显示 visibleCount 个,触底加载更多)
  const visibleList = filteredList.slice(0, visibleCount)
  const hasMore = visibleCount < filteredList.length

  // 切换厂商/类型时重置分页
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [providerId, typeFilter])

  useReachBottom(() => {
    if (hasMore) {
      setVisibleCount((c) => c + PAGE_SIZE)
    }
  })

  const currentProviderCount = models.filter((m) => m.provider === providerId).length

  return (
    <ThemeRoot><View className="model-plaza-page">
      <View className="page-header">
        <Text className="page-title">{t('modelPlaza.title')}</Text>
      </View>

      {/* 厂商分类横向滚动 */}
      <View className="provider-section">
        <ScrollView scrollX scrollWithAnimation showScrollbar={false} className="provider-tabs">
          <View className="provider-tabs-inner">
            {providers.map((p) => (
              <ThemeRoot><View
                key={p}
                className={`provider-tab${providerId === p ? ' active' : ''}`}
                onClick={() => setProviderId(p)}
              >
                <Image
                  className="provider-icon"
                  src={PROVIDER_ICONS[p] || '/static/images/icons/bot.svg'}
                  mode="aspectFit"
                />
                <Text className="provider-name">{p}</Text>
              </View>
            </ThemeRoot>))}
          </View>
        </ScrollView>
      </View>

      {/* 厂商头部 */}
      <View className="provider-header">
        <Text className="provider-name">{providerId || '-'}</Text>
        <Text className="provider-meta">
          {t('modelPlaza.modelCount', { n: currentProviderCount })}
          {currentProviderCount > filteredList.length
            ? t('modelPlaza.synced', { n: filteredList.length })
            : ''}
        </Text>
      </View>

      {/* type tab */}
      <View className="type-tabs">
        {TYPE_TABS.map((tab) => (
          <ThemeRoot><View
            key={tab.key}
            className={`type-tab${typeFilter === tab.key ? ' active' : ''}`}
            onClick={() => setTypeFilter(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        </ThemeRoot>))}
      </View>

      {/* 模型列表 */}
      <View className="model-list">
        {loading ? (
          <View className="state-wrap">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : visibleList.length === 0 ? (
          <View className="state-wrap">
            <Text className="state-text">{t('modelPlaza.empty')}</Text>
          </View>
        ) : (
          visibleList.map((m) => (
            <ThemeRoot><View key={`${m.provider}-${m.id}`} className="model-card">
              <View className="card-top">
                <Text className="model-name">{m.name}</Text>
                <Text className={`model-type-tag type-${m.type}`}>{typeLabel(m.type)}</Text>
              </View>
              <View className="card-price">
                <Text className="price-label">Input</Text>
                <Text className="price-value">
                  ¥{m.inputPrice}/{tt('modelPlaza.perKTokens', '千token')}
                </Text>
                {m.outputPrice !== '-' ? (
                  <>
                    <Text className="price-divider">|</Text>
                    <Text className="price-label">Output</Text>
                    <Text className="price-value">
                      ¥{m.outputPrice}/{tt('modelPlaza.perKTokens', '千token')}
                    </Text>
                  </>
                ) : (
                  <Text className="price-extra">({m.payMode})</Text>
                )}
              </View>
              {m.desc ? <Text className="card-desc">{m.desc}</Text> : null}
              {m.tags.length > 0 ? (
                <View className="card-tags">
                  {m.tags.map((tag, i) => (
                    <ThemeRoot><Text key={i} className="tag-item">
                      {tag}
                    </Text>
                  </ThemeRoot>))}
                </View>
              ) : null}
              <View className="card-footer">
                <Text className="pay-mode">{m.payMode}</Text>
              </View>
       </ThemeRoot>     </View>
          ))
        )}

        {!loading && hasMore ? (
          <View className="state-wrap small">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : null}

        {!loading && !hasMore && visibleList.length > 0 ? (
          <View className="state-wrap small">
            <Text className="state-text">{tt('modelPlaza.no</ThemeRoot>More', '— 没有更多了 —')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
