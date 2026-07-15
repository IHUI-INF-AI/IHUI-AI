import { View, Text, Image } from '@tarojs/components'
import { DrawerComponent, ModelList, type ModelItem } from '@/components'
import { useI18n } from '@/i18n'

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
