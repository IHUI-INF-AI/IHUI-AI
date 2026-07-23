import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { fetchModels, type LlmModel } from '@/api'
import { useI18n } from '@/i18n'
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

/** 厂商图标(用 emoji 替代,避免依赖资源文件) */
const PROVIDER_ICONS: Record<string, string> = {
  OpenAI: '🤖',
  Anthropic: '🧠',
  Google: '🔍',
  StepFun: '⚡',
  阿里云: '☁️',
  百度: '🐻',
  字节: '🚀',
  智谱: '✨',
}

/** Mock 厂商优先顺序 */
const PROVIDER_ORDER = [
  'OpenAI',
  'Anthropic',
  'Google',
  'StepFun',
  '阿里云',
  '百度',
  '字节',
  '智谱',
]

/**
 * Mock 数据 — API 失败或返回空时使用,保证视觉演示完整(对标原项目 modelPlazaData.js)。
 * 字段含 Input/Output 价格(¥/千token)、标签、计费模式。
 */
const MOCK_MODELS: ModelDisplay[] = [
  { id: 'm1', name: 'gpt-4-turbo', provider: 'OpenAI', desc: '最新一代多模态大模型,支持文本/图像/代码生成', inputPrice: '0.06', outputPrice: '0.12', tags: ['GPT-4', '128K上下文', '多模态'], payMode: '按量计费', type: 'text', contextLength: 128000 },
  { id: 'm2', name: 'gpt-4-vision', provider: 'OpenAI', desc: '视觉理解模型,可解析图像内容', inputPrice: '0.08', outputPrice: '0.16', tags: ['视觉', '多模态'], payMode: '按量计费', type: 'image', contextLength: 128000 },
  { id: 'm3', name: 'dall-e-3', provider: 'OpenAI', desc: '高质量图像生成模型', inputPrice: '0.04', outputPrice: '-', tags: ['绘图', '1024P'], payMode: '按次计费', type: 'image', contextLength: 0 },
  { id: 'm4', name: 'claude-3-opus', provider: 'Anthropic', desc: 'Anthropic 旗舰大模型,长文理解优秀', inputPrice: '0.015', outputPrice: '0.075', tags: ['Claude 3', '200K上下文'], payMode: '按量计费', type: 'text', contextLength: 200000 },
  { id: 'm5', name: 'claude-3-sonnet', provider: 'Anthropic', desc: '平衡速度与能力的中间型号', inputPrice: '0.003', outputPrice: '0.015', tags: ['Claude 3', '快速'], payMode: '按量计费', type: 'text', contextLength: 200000 },
  { id: 'm6', name: 'gemini-1.5-pro', provider: 'Google', desc: 'Google 多模态大模型,支持超长上下文', inputPrice: '0.0125', outputPrice: '0.05', tags: ['Gemini', '1M上下文', '多模态'], payMode: '按量计费', type: 'text', contextLength: 1000000 },
  { id: 'm7', name: 'gemini-1.5-flash', provider: 'Google', desc: '快速响应的轻量级 Gemini 模型', inputPrice: '0.0005', outputPrice: '0.0015', tags: ['Gemini', '快速'], payMode: '按量计费', type: 'text', contextLength: 1000000 },
  { id: 'm8', name: 'step-2-16k', provider: 'StepFun', desc: '阶跃星辰大模型', inputPrice: '0.005', outputPrice: '0.02', tags: ['Step', '16K上下文'], payMode: '按量计费', type: 'text', contextLength: 16000 },
  { id: 'm9', name: 'qwen-max', provider: '阿里云', desc: '通义千问旗舰模型', inputPrice: '0.04', outputPrice: '0.12', tags: ['Qwen', '8K上下文'], payMode: '按量计费', type: 'text', contextLength: 8000 },
  { id: 'm10', name: 'qwen-vl-max', provider: '阿里云', desc: '通义千问 VL 视觉理解模型', inputPrice: '0.02', outputPrice: '0.06', tags: ['Qwen-VL', '视觉'], payMode: '按量计费', type: 'image', contextLength: 8000 },
  { id: 'm11', name: 'wenxin-4', provider: '百度', desc: '百度文心一言旗舰模型', inputPrice: '0.03', outputPrice: '0.09', tags: ['ERNIE', '8K上下文'], payMode: '按量计费', type: 'text', contextLength: 8000 },
  { id: 'm12', name: 'doubao-pro-4k', provider: '字节', desc: '字节豆包大模型,性价比之选', inputPrice: '0.001', outputPrice: '0.002', tags: ['豆包', '4K上下文', '性价比'], payMode: '按量计费', type: 'text', contextLength: 4000 },
  { id: 'm13', name: 'doubao-voice', provider: '字节', desc: '豆包语音合成模型', inputPrice: '0.002', outputPrice: '-', tags: ['TTS', '语音'], payMode: '按次计费', type: 'av', contextLength: 0 },
  { id: 'm14', name: 'glm-4', provider: '智谱', desc: '智谱清言 GLM-4 旗舰大模型', inputPrice: '0.05', outputPrice: '0.15', tags: ['GLM-4', '128K上下文'], payMode: '按量计费', type: 'text', contextLength: 128000 },
]

/** 类型 tab(全部用现有 common.all,其他文案为修复严重缺失直接硬编码) */
const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文本' },
  { key: 'image', label: '图像' },
  { key: 'av', label: '音视频' },
]

function inferType(model: LlmModel): ModelType {
  const name = (model.name || '').toLowerCase()
  if (/dall-?e|stable|sdxl|wanx|vl|vision|kling|jimeng|draw|img|sora|veo/.test(name)) return 'image'
  if (/whisper|tts|voice|audio|asr|paraformer|suno|music/.test(name)) return 'av'
  return 'text'
}

function inferTags(model: LlmModel): string[] {
  const tags: string[] = []
  const name = (model.name || '').toLowerCase()
  if (/gpt-?4|gpt4/.test(name)) tags.push('GPT-4')
  else if (/gpt-?3/.test(name)) tags.push('GPT-3.5')
  else if (/claude/.test(name)) tags.push('Claude')
  else if (/gemini/.test(name)) tags.push('Gemini')
  else if (/qwen/.test(name)) tags.push('Qwen')
  else if (/glm/.test(name)) tags.push('GLM')
  else if (/doubao/.test(name)) tags.push('豆包')
  else if (/ernie|wenxin/.test(name)) tags.push('ERNIE')
  else if (/step/.test(name)) tags.push('Step')
  if (model.context_length > 0) {
    const k = model.context_length / 1000
    tags.push(k >= 1000 ? `${k / 1000}M上下文` : `${k}K上下文`)
  }
  return tags
}

function normalizeModel(raw: LlmModel): ModelDisplay {
  return {
    id: String(raw.id ?? Math.random().toString(36).slice(2)),
    name: raw.name || '',
    provider: raw.provider || 'Unknown',
    desc: `${raw.provider || ''} ${raw.name || ''} 模型`,
    inputPrice: String(raw.input_price ?? 0),
    outputPrice: '-',
    tags: inferTags(raw),
    payMode: '按量计费',
    type: inferType(raw),
    contextLength: raw.context_length ?? 0,
  }
}

function typeLabel(t: ModelType): string {
  if (t === 'image') return '图像'
  if (t === 'av') return '音视频'
  return '文本'
}

export default function ModelPlazaIndex() {
  const { t } = useI18n()
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
      setModels(list.length > 0 ? list : MOCK_MODELS)
    } catch {
      setModels(MOCK_MODELS)
    } finally {
      setLoading(false)
    }
  }, [])

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
      (m) =>
        m.provider === providerId &&
        (typeFilter === 'all' || m.type === typeFilter),
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
    <View className="model-plaza-page">
      <View className="page-header">
        <Text className="page-title">{t('modelPlaza.title')}</Text>
      </View>

      {/* 厂商分类横向滚动 */}
      <View className="provider-section">
        <ScrollView scrollX scrollWithAnimation showScrollbar={false} className="provider-tabs">
          <View className="provider-tabs-inner">
            {providers.map((p) => (
              <View
                key={p}
                className={`provider-tab${providerId === p ? ' active' : ''}`}
                onClick={() => setProviderId(p)}
              >
                <Text className="provider-icon">{PROVIDER_ICONS[p] || '🤖'}</Text>
                <Text className="provider-name">{p}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 厂商头部 */}
      <View className="provider-header">
        <Text className="provider-name">
          {providerId || '-'}
        </Text>
        <Text className="provider-meta">
          共 {currentProviderCount} 个模型
          {currentProviderCount > filteredList.length ? `（已同步 ${filteredList.length} 条）` : ''}
        </Text>
      </View>

      {/* type tab */}
      <View className="type-tabs">
        {TYPE_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`type-tab${typeFilter === tab.key ? ' active' : ''}`}
            onClick={() => setTypeFilter(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
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
            <View key={`${m.provider}-${m.id}`} className="model-card">
              <View className="card-top">
                <Text className="model-name">{m.name}</Text>
                <Text className={`model-type-tag type-${m.type}`}>{typeLabel(m.type)}</Text>
              </View>
              <View className="card-price">
                <Text className="price-label">Input</Text>
                <Text className="price-value">¥{m.inputPrice}/千token</Text>
                {m.outputPrice !== '-' ? (
                  <>
                    <Text className="price-divider">|</Text>
                    <Text className="price-label">Output</Text>
                    <Text className="price-value">¥{m.outputPrice}/千token</Text>
                  </>
                ) : (
                  <Text className="price-extra">({m.payMode})</Text>
                )}
              </View>
              {m.desc ? <Text className="card-desc">{m.desc}</Text> : null}
              {m.tags.length > 0 ? (
                <View className="card-tags">
                  {m.tags.map((tag, i) => (
                    <Text key={i} className="tag-item">{tag}</Text>
                  ))}
                </View>
              ) : null}
              <View className="card-footer">
                <Text className="pay-mode">{m.payMode}</Text>
              </View>
            </View>
          ))
        )}

        {!loading && hasMore ? (
          <View className="state-wrap small">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : null}

        {!loading && !hasMore && visibleList.length > 0 ? (
          <View className="state-wrap small">
            <Text className="state-text">— 没有更多了 —</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
