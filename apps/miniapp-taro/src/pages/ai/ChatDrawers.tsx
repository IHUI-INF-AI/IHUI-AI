import { View, Text, Image } from '@tarojs/components'
import { DrawerComponent, ModelList, type ModelItem } from '@/components'

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
  return (
    <DrawerComponent visible={visible} onClose={onClose} height="60vh">
      <View className="drawer-header">
        <Text className="drawer-title">选择模型</Text>
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
  return (
    <DrawerComponent visible={visible} onClose={onClose} height="60vh">
      <View className="drawer-header">
        <Text className="drawer-title">素材库</Text>
      </View>
      {loading ? (
        <View className="drawer-empty">
          <Text>加载中...</Text>
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
          <Text>暂无素材</Text>
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
  return (
    <DrawerComponent visible={visible} onClose={onClose} height="60vh">
      <View className="drawer-header">
        <Text className="drawer-title">技能详情</Text>
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
              <Text className="agent-prompt-title">提示词</Text>
              <Text className="agent-prompt">{agent.prompt}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="drawer-empty">
          <Text>加载中...</Text>
        </View>
      )}
    </DrawerComponent>
  )
}
