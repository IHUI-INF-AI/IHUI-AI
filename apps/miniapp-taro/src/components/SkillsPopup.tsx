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
      <View className="px-4 py-3 mb-2">
        <Text className="text-base font-semibold text-foreground dark:text-muted-foreground">
          {t('ai.skillsPopup.title')}
        </Text>
      </View>

      <View className="px-4 py-2">
        <Input
          className="w-full h-9 px-3 text-sm bg-muted rounded-lg text-foreground dark:text-muted-foreground"
          type="text"
          placeholder={t('ai.skillsPopup.searchPlaceholder')}
          placeholderClass="text-muted-foreground"
          value={keyword}
          onInput={handleSearch}
        />
      </View>

      <ScrollView
        scrollX
        className="whitespace-nowrap px-3 py-2 mb-2"
      >
        {CATEGORIES.map((c) => (
          <View
            key={c.key}
            className={`inline-block px-3 py-1 mr-2 text-xs rounded-md ${category === c.key ? 'bg-primary text-white' : 'bg-muted text-foreground dark:text-muted-foreground'}`}
            onClick={() => setCategory(c.key)}
          >
            <Text>{t(c.labelKey)}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView scrollY className="flex-1" style={{ maxHeight: '50vh' }}>
        {loading ? (
          <View className="py-12 text-center text-sm text-muted-foreground">
            <Text>{t('ai.common.loading')}</Text>
          </View>
        ) : filtered.length ? (
          <View className="px-3 py-2">
            {filtered.map((agent) => (
              <View
                key={agent.id}
                className={`flex items-center p-3 mb-2 rounded-xl active:bg-muted ${selectedId === agent.id ? 'bg-primary/10 border border-primary' : 'bg-muted'}`}
                onClick={() => handleSelect(agent)}
              >
                {agent.avatar ? (
                  <Image
                    className="w-10 h-10 rounded-md mr-3 bg-muted"
                    src={agent.avatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-10 h-10 rounded-md mr-3 bg-primary flex items-center justify-center text-white text-base font-semibold">
                    <Text>{agent.name.charAt(0)}</Text>
                  </View>
                )}
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-foreground dark:text-muted-foreground truncate">
                      {agent.name}
                    </Text>
                    {selectedId === agent.id ? (
                      <Text className="ml-2 text-xs text-primary">✓</Text>
                    ) : null}
                  </View>
                  {agent.desc ? (
                    <Text className="block text-xs text-muted-foreground dark:text-muted-foreground mt-1 truncate">
                      {agent.desc}
                    </Text>
                  ) : null}
                </View>
                {typeof agent.uses === 'number' ? (
                  <View className="ml-2 text-xs text-muted-foreground">
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
