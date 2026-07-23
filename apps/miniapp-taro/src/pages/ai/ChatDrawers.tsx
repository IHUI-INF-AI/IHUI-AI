import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DrawerComponent, ModelList, type ModelItem } from '@/components'
import { useI18n } from '@/i18n'
import type { ChatMessage } from '@/api'

interface MaterialItem {
  id: string
  title: string
  coverUrl?: string
  content?: string
}
interface AgentInfo {
  id: string
  name: string
  desc: string
  avatar?: string
  prompt: string
}

/** 历史对话条目(对标原 ai_assistant.vue 历史抽屉) */
export interface ChatHistoryEntry {
  id: string
  title: string
  preview: string
  timestamp: number
  messages: ChatMessage[]
}

/** 历史时间格式化(对标原 ai_assistant.vue 历史列表时间显示) */
function formatHistoryTime(timestamp: number): string {
  try {
    const d = new Date(timestamp)
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

export function ModelDrawer({
  visible,
  onClose,
  models,
  selectedId,
  loading,
  onSelect,
}: {
  visible: boolean
  onClose: () => void
  models: ModelItem[]
  selectedId: string
  loading: boolean
  onSelect: (m: ModelItem) => void
}) {
  const { t } = useI18n()
  return (
    <DrawerComponent visible={visible} onClose={onClose} height="60vh">
      <View className="drawer-header">
        <Text className="drawer-title">{t('ai.chatDrawers.selectModel')}</Text>
      </View>
      <ModelList models={models} selectedId={selectedId} onSelect={onSelect} loading={loading} />
    </DrawerComponent>
  )
}

export function MaterialDrawer({
  visible,
  onClose,
  materials,
  loading,
  onSelect,
}: {
  visible: boolean
  onClose: () => void
  materials: MaterialItem[]
  loading: boolean
  onSelect: (m: MaterialItem) => void
}) {
  const { t } = useI18n()
  return (
    <DrawerComponent visible={visible} onClose={onClose} height="60vh">
      <View className="drawer-header">
        <Text className="drawer-title">{t('ai.chatDrawers.materialLibrary')}</Text>
      </View>
      {loading ? (
        <View className="drawer-empty">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : materials.length ? (
        <View className="material-list">
          {materials.map((m) => (
            <View key={m.id} className="material-item" onClick={() => onSelect(m)}>
              {m.coverUrl ? (
                <Image className="material-cover" src={m.coverUrl} mode="aspectFill" />
              ) : null}
              <Text className="material-title">{m.title}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="drawer-empty">
          <Text>{t('ai.chatDrawers.emptyMaterial')}</Text>
        </View>
      )}
    </DrawerComponent>
  )
}

export function AgentDrawer({
  visible,
  onClose,
  agent,
}: {
  visible: boolean
  onClose: () => void
  agent: AgentInfo | null
}) {
  const { t } = useI18n()
  return (
    <DrawerComponent visible={visible} onClose={onClose} height="60vh">
      <View className="drawer-header">
        <Text className="drawer-title">{t('ai.chatDrawers.skillDetail')}</Text>
      </View>
      {agent ? (
        <View className="agent-info">
          <View className="agent-header">
            {agent.avatar ? (
              <Image className="agent-avatar" src={agent.avatar} mode="aspectFill" />
            ) : (
              <View className="agent-avatar agent-avatar-default">
                <Text>{agent.name.charAt(0)}</Text>
              </View>
            )}
            <View className="agent-meta">
              <Text className="agent-name">{agent.name}</Text>
              <Text className="agent-desc">{agent.desc}</Text>
            </View>
          </View>
          {agent.prompt ? (
            <View className="agent-prompt-wrap">
              <Text className="agent-prompt-title">{t('ai.chatDrawers.promptLabel')}</Text>
              <Text className="agent-prompt">{agent.prompt}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="drawer-empty">
          <Text>{t('common.loading')}</Text>
        </View>
      )}
    </DrawerComponent>
  )
}

/** 历史对话抽屉(对标原 ai_assistant.vue 历史抽屉,导航栏点击历史图标滑出) */
export function HistoryDrawer({
  visible,
  onClose,
  histories,
  onSelect,
  onClear,
}: {
  visible: boolean
  onClose: () => void
  histories: ChatHistoryEntry[]
  onSelect: (h: ChatHistoryEntry) => void
  onClear: () => void
}) {
  const { t } = useI18n()
  /** 清空历史(对标原 ai_assistant.vue clearHistory,带二次确认) */
  function handleClear() {
    Taro.showModal({
      title: t('common.hint'),
      content: t('ai.history.clearConfirm'),
      success: (res) => {
        if (res.confirm) {
          onClear()
          Taro.showToast({ title: t('ai.history.cleared'), icon: 'none' })
        }
      },
    })
  }
  return (
    <DrawerComponent visible={visible} onClose={onClose} height="60vh">
      <View className="drawer-header">
        <Text className="drawer-title">{t('ai.history.title')}</Text>
      </View>
      {histories.length ? (
        <ScrollView scrollY className="history-list">
          {histories.map((h) => (
            <View key={h.id} className="history-item" onClick={() => onSelect(h)}>
              <Text className="history-item-title">{h.title}</Text>
              <Text className="history-item-preview">{h.preview}</Text>
              <Text className="history-item-time">{formatHistoryTime(h.timestamp)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="drawer-empty">
          <Text>{t('ai.history.empty')}</Text>
        </View>
      )}
      {histories.length ? (
        <View className="history-clear-btn" onClick={handleClear}>
          <Text>{t('ai.clear')}</Text>
        </View>
      ) : null}
    </DrawerComponent>
  )
}
