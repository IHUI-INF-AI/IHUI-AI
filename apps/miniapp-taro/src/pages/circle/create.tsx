import { View, Text, Input, Textarea, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createCircle } from '@/api'
import { TOPIC_EVENT } from '@/constants/events'
import './create.css'

interface FormState {
  title: string
  content: string
  images: string[]
}

export default function CircleCreatePage() {
  const [form, setForm] = useState<FormState>({ title: '', content: '', images: [] })
  const [topic, setTopic] = useState('')

  const addImg = useCallback(() => {
    Taro.chooseImage({
      count: 9 - form.images.length,
      sizeType: ['compressed'],
      success: (res) => {
        setForm(f => ({ ...f, images: [...f.images, ...res.tempFilePaths] }))
      }
    })
  }, [form.images.length])

  const removeImg = useCallback((i: number) => {
    setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))
  }, [])

  const chooseTopic = useCallback(() => {
    Taro.navigateTo({ url: '/pages/topic/list?from=create' })
  }, [])

  const onSubmit = useCallback(async () => {
    if (!form.title || !form.content) return
    try {
      await createCircle(form)
      Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (e) {}
  }, [form])

  useDidShow(() => {
    // 页面显示时无需额外操作
  })

  // 监听从话题选择页选中后触发的事件
  useEffect(() => {
    const handler = (name: string) => setTopic(name || '')
    Taro.eventCenter.on(TOPIC_EVENT, handler)
    return () => {
      Taro.eventCenter.off(TOPIC_EVENT, handler)
    }
  }, [])

  return (
    <View className="page">
      <View className="card">
        <Input
          className="title-input"
          value={form.title}
          placeholder="标题（必填）"
          maxlength={30}
          onInput={e => setForm(f => ({ ...f, title: e.detail.value }))}
        />
        <Textarea
          className="content-input"
          value={form.content}
          placeholder="分享你的想法..."
          maxlength={1000}
          onInput={e => setForm(f => ({ ...f, content: e.detail.value }))}
        />
        <View className="images">
          {form.images.map((img, i) => (
            <View key={i} className="img-item">
              <Image className="img" src={img} mode="aspectFill" />
              <View className="del" onClick={() => removeImg(i)}>×</View>
            </View>
          ))}
          {form.images.length < 9 ? (
            <View className="add-img" onClick={addImg}>+</View>
          ) : null}
        </View>
      </View>

      <View className="card">
        <View className="row" onClick={chooseTopic}>
          <Text className="label">话题</Text>
          <Text className="value">{topic || '选择话题'} ›</Text>
        </View>
      </View>

      <Button
        className="btn"
        onClick={onSubmit}
        disabled={!form.title || !form.content}
      >发布</Button>
    </View>
  )
}
