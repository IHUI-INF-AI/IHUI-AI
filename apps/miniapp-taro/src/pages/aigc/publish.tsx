import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { publishAigc } from '@/api'
import './publish.css'

export default function AigcPublish() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = useCallback(async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await publishAigc({ title, content })
      Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [title, content])

  return (
    <View className="publish-page">
      <View className="page-header">
        <Text className="page-title">发布作品</Text>
      </View>
      <View className="form">
        <View className="form-item">
          <Text className="form-label">标题</Text>
          <Input
            className="form-input"
            placeholder="请输入作品标题"
            value={title}
            onInput={(e) => setTitle(e.detail.value)}
          />
        </View>
        <View className="form-item">
          <Text className="form-label">描述</Text>
          <Textarea
            className="form-textarea"
            placeholder="请输入作品描述"
            value={content}
            onInput={(e) => setContent(e.detail.value)}
          />
        </View>
        <Button
          className="submit-btn"
          loading={submitting}
          disabled={submitting}
          onClick={onSubmit}
        >
          发布
        </Button>
      </View>
    </View>
  )
}
