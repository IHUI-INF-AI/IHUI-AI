import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getAskList, type Ask } from '@/api'
import './list.css'

export default function AskListPage() {
  const [list, setList] = useState<Ask[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState('new')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (reset = false) => {
    if (loading) return
    let curPage = page
    if (reset) { curPage = 1; setHasMore(true); setList([]); setPage(1) }
    if (!hasMore && !reset) return
    setLoading(true)
    try {
      const res = await getAskList({ page: curPage, pageSize: 10, keyword })
      const newList = res.list || []
      setList(prev => reset ? newList : [...prev, ...newList])
      setHasMore((reset ? newList.length : list.length + newList.length) < res.total)
      setPage(curPage + 1)
    } finally {
      setLoading(false)
    }
  }, [loading, page, hasMore, keyword, list.length])

  const switchTab = useCallback((t: string) => {
    setTab(t)
    load(true)
  }, [load])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/ask/detail?id=${id}` })
  }, [])

  const goCreate = useCallback(() => {
    Taro.navigateTo({ url: '/pages/ask/create' })
  }, [])

  const onSearchConfirm = useCallback(() => {
    load(true)
  }, [load])

  useReachBottom(() => load())

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View className="page">
      <View className="search-bar">
        <Input
          className="search-input"
          placeholder="搜索问题"
          value={keyword}
          onInput={e => setKeyword(e.detail.value)}
          onConfirm={onSearchConfirm}
        />
      </View>

      <View className="tabs">
        <Text className={`tab${tab === 'new' ? ' active' : ''}`} onClick={() => switchTab('new')}>最新</Text>
        <Text className={`tab${tab === 'hot' ? ' active' : ''}`} onClick={() => switchTab('hot')}>热门</Text>
        <Text className={`tab${tab === 'unanswered' ? ' active' : ''}`} onClick={() => switchTab('unanswered')}>待回答</Text>
      </View>

      {list.length ? (
        <View className="list">
          {list.map(a => (
            <View key={a.id} className="item" onClick={() => goDetail(a.id)}>
              <Text className="title">{a.title}</Text>
              <Text className="content">{a.content}</Text>
              <View className="meta">
                <Image className="avatar" src={a.avatar || '/static/default-avatar.png'} mode="aspectFill" />
                <Text className="author">{a.author}</Text>
                <Text className="time">{a.createTime}</Text>
                <Text className={`answers${a.adopted ? ' adopted' : ''}`}>{a.answers || 0}回答</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !list.length ? (
        <View className="empty"><Text>暂无问题</Text></View>
      ) : null}

      <View className="fab" onClick={goCreate}>+</View>
    </View>
  )
}
