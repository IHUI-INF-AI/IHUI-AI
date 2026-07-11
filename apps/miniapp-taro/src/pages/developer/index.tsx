import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperAgents } from '@/api'
import './index.css'

export default function DeveloperIndex() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await getDeveloperAgents()
      setList(res?.list || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="developer-page">
      <View className="page-header">
        <Text className="page-title">开发者中心</Text>
      </View>
      <View className="agent-list">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : list.length ? (
          list.map((agent: any) => (
            <View key={agent.id} className="agent-item">
              <Image
                className="agent-avatar"
                src={agent.avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="agent-body">
                <Text className="agent-name">{agent.name || '未命名智能体'}</Text>
                <Text className="agent-stat">使用 {agent.uses || 0} 次</Text>
              </View>
              <Text className="agent-status">{agent.status || '已上架'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无智能体</Text>
        )}
      </View>
    </View>
  )
}
