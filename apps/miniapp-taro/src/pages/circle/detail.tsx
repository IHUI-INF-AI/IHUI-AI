import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getCircleDetail, type Circle } from '@/api'
import './detail.css'

export default function CircleDetailPage() {
  const [data, setData] = useState<Circle>({} as Circle)
  const [liked, setLiked] = useState(false)
  const [id, setId] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try { setData(await getCircleDetail(id)) } catch {}
  }, [id])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    if (q?.id) {
      setId(q.id)
      load()
    }
  })

  const previewImg = useCallback((i: number) => {
    Taro.previewImage({ urls: data.images || [], current: data.images?.[i] || '' })
  }, [data.images])

  const onFollow = useCallback(() => {
    Taro.showToast({ title: '关注成功', icon: 'success' })
  }, [])

  const onLike = useCallback(() => {
    setLiked(prev => {
      const next = !prev
      setData(d => ({ ...d, likes: (d.likes || 0) + (next ? 1 : -1) }))
      return next
    })
  }, [])

  const onShare = useCallback(() => {
    Taro.showToast({ title: '点击右上角分享', icon: 'none' })
  }, [])

  return (
    <View className="page">
      {data.author ? (
        <View className="head">
          <Image className="avatar" src={data.avatar || '/static/default-avatar.png'} mode="aspectFill" />
          <View className="user-info">
            <Text className="name">{data.author}</Text>
            <Text className="time">{data.createTime}</Text>
          </View>
          <Button className="follow" size="mini" onClick={onFollow}>关注</Button>
        </View>
      ) : null}

      {data.title ? (
        <View className="body">
          <Text className="title">{data.title}</Text>
          <Text className="content">{data.content}</Text>
          {data.images?.length ? (
            <View className="images">
              {data.images.map((img, i) => (
                <Image key={i} className="img" src={img} mode="aspectFill" onClick={() => previewImg(i)} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="actions">
        <View className={`action${liked ? ' active' : ''}`} onClick={onLike}>
          <Text>♡</Text><Text>{data.likes || 0}</Text>
        </View>
        <View className="action"><Text>💬</Text><Text>{data.comments || 0}</Text></View>
        <View className="action" onClick={onShare}><Text>↗</Text><Text>分享</Text></View>
      </View>
    </View>
  )
}
