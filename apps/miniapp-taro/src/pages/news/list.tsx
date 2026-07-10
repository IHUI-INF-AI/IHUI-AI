import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getNewsList, type News } from '@/api'
import './list.css'

export default function NewsListPage() {
  const [list, setList] = useState<News[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (reset = false) => {
    if (loading) return
    let curPage = page
    if (reset) { curPage = 1; setHasMore(true); setList([]); setPage(1) }
    if (!hasMore && !reset) return
    setLoading(true)
    try {
      const res = await getNewsList({ page: curPage, pageSize: 10, keyword })
      const newList = res.list || []
      setList(prev => reset ? newList : [...prev, ...newList])
      setHasMore((reset ? newList.length : list.length + newList.length) < res.total)
      setPage(curPage + 1)
    } finally {
      setLoading(false)
    }
  }, [loading, page, hasMore, keyword, list.length])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/news/detail?id=${id}` })
  }, [])

  const onSearchConfirm = useCallback(() => {
    load(true)
  }, [load])

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

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
          placeholder="搜索资讯"
          value={keyword}
          onInput={e => setKeyword(e.detail.value)}
          onConfirm={onSearchConfirm}
        />
      </View>

      {list.length ? (
        <View className="list">
          {list.map(n => (
            <View key={n.id} className="item" onClick={() => goDetail(n.id)}>
              {n.coverUrl ? <Image className="cover" src={n.coverUrl} mode="aspectFill" /> : null}
              <View className="body">
                <Text className="title">{n.title}</Text>
                <Text className="summary">{n.summary}</Text>
                <View className="meta">
                  <Text className="time">{n.createTime}</Text>
                  <Text className="views">{n.views || 0}阅读</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !list.length ? (
        <View className="empty"><Text>暂无资讯</Text></View>
      ) : null}

      {loading ? (
        <View className="loading"><Text>加载中...</Text></View>
      ) : null}
    </View>
  )
}
