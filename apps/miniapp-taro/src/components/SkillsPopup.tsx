// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import SearchBar from '@/components/SearchBar'
import type { Agent } from '@ihui/api-client'
import { useState, useMemo, useCallback } from 'react'
import DrawerComponent from './DrawerComponent'
import EmptyState from './EmptyState'
import CategoryBar from './CategoryBar'

export type SkillCategory = 'all' | 'text' | 'image' | 'video' | 'audio'

export type AgentItem = Pick<Agent, 'id' | 'name'> & {
  description?: string
  avatar?: string
  useCount?: number
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
  { key: 'all', labelKey: 'common.all' },
  { key: 'text', labelKey: 'aigc.list.catText' },
  { key: 'image', labelKey: 'aigc.list.catImage' },
  { key: 'video', labelKey: 'aigc.list.catVideo' },
  { key: 'audio', labelKey: 'aigc.list.catAudio' },
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
        !kw || a.name.toLowerCase().includes(kw) || (a.description || '').toLowerCase().includes(kw)
      return matchCat && matchKw
    })
  }, [agents, keyword, category])

  const handleSelect = useCallback(
    (agent: AgentItem) => {
      onSelect?.(agent)
    },
    [onSelect],
  )

  return (
    <DrawerComponent visible={visible} onClose={onClose} height="70vh">
      <View className="px-4 py-3 mb-2">
        <Text className="text-base font-semibold text-foreground dark:text-muted-foreground">
          {t('ai.skillsPopup.title')}
        </Text>
      </View>

      {/* 搜索栏(统一圆角输入井,共享 SearchBar) */}
      <View className="px-4 py-2">
        <SearchBar
          className=""
          value={keyword}
          placeholder={t('ai.skillsPopup.searchPlaceholder')}
          onInput={setKeyword}
          onClear={() => setKeyword('')}
        />
      </View>

      <CategoryBar
        className="mb-2 px-3 py-2"
        value={category}
        onChange={(id) => setCategory(id as SkillCategory)}
        items={CATEGORIES.map((c) => ({ id: c.key, label: t(c.labelKey) }))}
      />

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
                className={`flex items-center p-3 mb-2 rounded-xl ${selectedId === agent.id ? 'bg-primary/10 border border-brand-accent-deep' : 'bg-muted'}`}
                onClick={() => handleSelect(agent)}
                hoverClass="opacity-60"
              >
                {agent.avatar ? (
                  <Image
                    className="w-10 h-10 rounded-md mr-3 bg-muted"
                    src={agent.avatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-10 h-10 rounded-md mr-3 bg-primary flex items-center justify-center text-primary-foreground text-base font-semibold">
                    <Text>{agent.name.charAt(0)}</Text>
                  </View>
                )}
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-foreground dark:text-muted-foreground truncate">
                      {agent.name}
                    </Text>
                    {selectedId === agent.id ? (
                      <LineIcon
                        name="check-success"
                        size="14px"
                        color="var(--color-success)"
                        className="ml-2"
                      />
                    ) : null}
                  </View>
                  {agent.description ? (
                    <Text className="block text-xs text-muted-foreground dark:text-muted-foreground mt-1 truncate">
                      {agent.description}
                    </Text>
                  ) : null}
                </View>
                {typeof agent.useCount === 'number' ? (
                  <View className="ml-2 text-xs text-muted-foreground">
                    <Text>{t('ai.skillsPopup.uses', { n: agent.useCount })}</Text>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
