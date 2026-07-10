import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getAgentList } from '@/api'
import './agent.css'

interface Agent {
  id: string
  name: string
  desc: string
  avatar?: string
  uses: number
}

export default function AgentPage() {
  const [list, setList] = useState<Agent[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  const filtered = useMemo(() => {
    if (!keyword) return list
    return list.filter(a => a.name.includes(keyword) || a.desc.includes(keyword))
  }, [list, keyword])

  const load = useCallback(async () => {
    try { setList((await getAgentList()).list || []) } finally { setLoading(false) }
  }, [])

  const goDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${id}` })
  }, [])

  useDidShow(load)

  return (
    <View className="page">
      <View className="search-bar">
        <Input
          className="search-input"
          placeholder="搜索Agent"
          value={keyword}
          onInput={e => setKeyword(e.detail.value)}
        />
      </View>
      {filtered.length ? (
        <View className="list">
          {filtered.map(a => (
            <View key={a.id} className="item" onClick={() => goDetail(a.id)}>
              <Image className="avatar" src={a.avatar || '/static/default-agent.png'} mode="aspectFill" />
              <View className="body">
                <Text className="name">{a.name}</Text>
                <Text className="desc">{a.desc}</Text>
                <Text className="uses">{a.uses}次使用</Text>
              </View>
              <Text className="arrow">›</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !filtered.length ? <View className="empty"><Text>暂无Agent</Text></View> : null}
    </View>
  )
}
