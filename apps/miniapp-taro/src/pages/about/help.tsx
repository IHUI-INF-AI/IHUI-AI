import { View, Text, Input } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getHelp } from '@/api'
import './help.css'

interface HelpItem {
  id: string
  title: string
  content: string
}

export default function HelpPage() {
  const [list, setList] = useState<HelpItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [opened, setOpened] = useState('')
  const [loading, setLoading] = useState(true)

  const filtered = useMemo(() => {
    if (!keyword) return list
    return list.filter(h => h.title.includes(keyword) || h.content.includes(keyword))
  }, [list, keyword])

  const load = useCallback(async () => {
    try {
      const res = await getHelp()
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setOpened(prev => prev === id ? '' : id)
  }, [])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="search-bar">
        <Input
          className="search-input"
          placeholder="搜索帮助"
          value={keyword}
          onInput={e => setKeyword(e.detail.value)}
        />
      </View>

      {filtered.length ? (
        <View className="list">
          {filtered.map(h => (
            <View key={h.id} className="item" onClick={() => toggle(h.id)}>
              <View className="item-head">
                <Text className="title">{h.title}</Text>
                <Text className={`arrow${opened === h.id ? ' open' : ''}`}>›</Text>
              </View>
              {opened === h.id ? (
                <View className="content">
                  <Text>{h.content}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !filtered.length ? (
        <View className="empty"><Text>暂无帮助内容</Text></View>
      ) : null}
    </View>
  )
}
