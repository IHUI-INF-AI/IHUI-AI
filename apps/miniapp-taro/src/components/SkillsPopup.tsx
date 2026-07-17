import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import { useState, useMemo, useCallback } from 'react'
import DrawerComponent from './DrawerComponent'
import EmptyState from './EmptyState'
import { useI18n } from '@/i18n'

export type SkillCategory = 'all' | 'text' | 'image' | 'video' | 'audio'

export interface AgentItem {
  id: string
  name: string
  desc?: string
  avatar?: string
  uses?: number
  category?: SkillCategory
}

export interface SkillsPopupProps {
  visible?: boolean
  agents?: AgentItem[]
  loading?: boolean
  selectedId?: string
  onSelect?: (agent: AgentItem) => void
  onClose?: () => void
}

const CATEGORIES: { key: SkillCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'ai.skillsPopup.categoryAll' },
  { key: 'text', labelKey: 'ai.skillsPopup.categoryText' },
  { key: 'image', labelKey: 'ai.skillsPopup.categoryImage' },
  { key: 'video', labelKey: 'ai.skillsPopup.categoryVideo' },
  { key: 'audio', labelKey: 'ai.skillsPopup.categoryAudio' },
]

export default function SkillsPopup({
  visible = false,
  agents = [],
  loading = false,
  selectedId = '',
  onSelect,
  onClose,
}: SkillsPopupProps) {
  const { t } = useI18n()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<SkillCategory>('all')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return agents.filter((a) => {
      const matchCat = category === 'all' || a.category === category
      const matchKw =
        !kw || a.name.toLowerCase().includes(kw) || (a.desc || '').toLowerCase().includes(kw)
      return matchCat && matchKw
    })
  }, [agents, keyword, category])

  const handleSelect = useCallback(
    (agent: AgentItem) => {
      onSelect?.(agent)
    },
    [onSelect],
  )

  const handleSearch = useCallback((e: { detail: { value?: string } }) => {
    setKeyword(e.detail.value || '')
  }, [])

  return (
    <DrawerComponent visible={visible} onClose={onClose} height="70vh">
      <View className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <Text className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {t('ai.skillsPopup.title')}
        </Text>
      </View>

      <View className="px-4 py-2">
        <Input
          className="w-full h-9 px-3 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-800 dark:text-gray-100"
          type="text"
          placeholder={t('ai.skillsPopup.searchPlaceholder')}
          placeholderClass="text-gray-400"
          value={keyword}
          onInput={handleSearch}
        />
      </View>

      <ScrollView
        scrollX
        className="whitespace-nowrap px-3 py-2 border-b border-gray-100 dark:border-gray-800"
      >
        {CATEGORIES.map((c) => (
          <View
            key={c.key}
            className={`inline-block px-3 py-1 mr-2 text-xs rounded-md ${category === c.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
            onClick={() => setCategory(c.key)}
          >
            <Text>{t(c.labelKey)}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView scrollY className="flex-1" style={{ maxHeight: '50vh' }}>
        {loading ? (
          <View className="py-12 text-center text-sm text-gray-400">
            <Text>{t('ai.common.loading')}</Text>
          </View>
        ) : filtered.length ? (
          <View className="px-3 py-2">
            {filtered.map((agent) => (
              <View
                key={agent.id}
                className={`flex items-center p-3 mb-2 rounded-xl active:bg-gray-50 dark:active:bg-gray-800 ${selectedId === agent.id ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-800'}`}
                onClick={() => handleSelect(agent)}
              >
                {agent.avatar ? (
                  <Image
                    className="w-10 h-10 rounded-md mr-3 bg-gray-200"
                    src={agent.avatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-10 h-10 rounded-md mr-3 bg-green-600 flex items-center justify-center text-white text-base font-semibold">
                    <Text>{agent.name.charAt(0)}</Text>
                  </View>
                )}
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {agent.name}
                    </Text>
                    {selectedId === agent.id ? (
                      <Text className="ml-2 text-xs text-green-600">✓</Text>
                    ) : null}
                  </View>
                  {agent.desc ? (
                    <Text className="block text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {agent.desc}
                    </Text>
                  ) : null}
                </View>
                {typeof agent.uses === 'number' ? (
                  <View className="ml-2 text-xs text-gray-400">
                    <Text>{t('ai.skillsPopup.uses', { n: agent.uses })}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text={keyword ? t('ai.skillsPopup.notFound') : t('ai.skillsPopup.empty')} />
        )}
      </ScrollView>
    </DrawerComponent>
  )
}
