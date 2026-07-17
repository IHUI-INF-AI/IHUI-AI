import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getAgentList } from '@/api'
import {
  AgentListPanel,
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

export default function AgentPage() {
  const { t } = useI18n()
  const [list, setList] = useState<AgentItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<ModelType | ''>('')
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
    if (keyword) {
      const kw = keyword.toLowerCase()
      arr = arr.filter(
        (a) =>
          (a.name || '').toLowerCase().includes(kw) || (a.desc || '').toLowerCase().includes(kw),
      )
    }
    return arr
  }, [list, keyword, activeType])

  const load = useCallback(async () => {
    try {
      const res = await getAgentList()
      const arr = (res.list || []).map((a: AgentItem) => ({
        id: String(a.id),
        name: a.name,
        desc: a.desc,
        avatar: a.avatar,
        category: a.category,
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

  const onSelectAgent = useCallback(
    (agent: AgentItem) => {
      goDetail(agent.id)
    },
    [goDetail],
  )

  const onSendQuery = useCallback(() => {
    if (!keyword.trim()) return
    Taro.navigateTo({ url: `/pages/ai/chat?prompt=${encodeURIComponent(keyword)}` })
  }, [keyword])

  useDidShow(load)

  return (
    <View className="page">
      <View className="bg-white pb-2 sticky top-0 z-10">
        <SearchBar
          value={keyword}
          placeholder={t('ai.agent.searchPlaceholder')}
          onInput={setKeyword}
          onSearch={onSendQuery}
          onClear={() => setKeyword('')}
        />
        <ModelTypeButtonGroup activeType={activeType} onSelect={(tp) => setActiveType(tp)} />
      </View>

      {filtered.length ? (
        <View className="px-3 py-2">
          <Text className="block text-xs text-gray-400 mb-2">
            {t('ai.agent.count', { n: filtered.length })}
          </Text>
          <AgentListPanel visible agents={filtered} loading={loading} onSelect={onSelectAgent} />
        </View>
      ) : (
        <EmptyState text={keyword || activeType ? t('ai.agent.notFound') : t('ai.agent.empty')} />
      )}

      <View className="h-20" />

      <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
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
