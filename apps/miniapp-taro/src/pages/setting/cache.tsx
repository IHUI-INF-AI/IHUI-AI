import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { clearCacheSize, clearCache } from '@/api'
import './cache.css'

export default function CachePage() {
  const [size, setSize] = useState('0KB')

  const load = useCallback(async () => {
    try {
      setSize((await clearCacheSize()).size)
    } catch (e) {
      console.error('[setting/cache] 获取缓存大小 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  const onClear = useCallback(async () => {
    try {
      await clearCache()
      Taro.showToast({ title: '清理成功', icon: 'success' })
      load()
    } catch (e) {
      console.error('[setting/cache] 清理缓存 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [load])

  const onClearAll = useCallback(() => {
    onClear()
  }, [onClear])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="card">
        <View className="row" onClick={onClear}>
          <Text className="label">当前缓存</Text>
          <Text className="value">{size}</Text>
        </View>
        <View className="row" onClick={onClear}>
          <Text className="label">清除图片缓存</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="row" onClick={onClear}>
          <Text className="label">清除文件缓存</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>

      <Button className="btn" onClick={onClearAll}>
        一键清理
      </Button>

      <View className="tips">
        <Text>清理缓存不会影响您的账号数据</Text>
        <Text>清理后已下载的内容需重新加载</Text>
      </View>
    </View>
  )
}
