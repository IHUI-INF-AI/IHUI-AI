import { View, Text, Input, Textarea, Button, Picker } from '@tarojs/components'
import { logger } from '@/utils/logger'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { post } from '@/api'
import './index.css'

const CATEGORIES = ['课程笔记', '技术分享', '学习心得', '项目实战', '问答讨论', '资源推荐']
const VISIBILITY = ['公开', '仅好友', '私密']

export default function StudyPublish() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(0)
  const [visibility, setVisibility] = useState(0)
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = useCallback(async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      Taro.showToast({ title: '请输入内容', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await post('/study/publish', {
        title: title.trim(),
        content: content.trim(),
        category: CATEGORIES[category],
        visibility: VISIBILITY[visibility],
        tags: tags.trim(),
      })
      Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e) {
      logger.error('study/publish', 'submit', e)
    } finally {
      setSaving(false)
    }
  }, [title, content, category, visibility, tags])

  return (
    <View className="page">
      <View className="card">
        <Input
          className="title-input"
          placeholder="请输入标题（最多50字）"
          maxlength={50}
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
        />
      </View>

      <View className="card">
        <Textarea
          className="content-input"
          placeholder="分享你的学习内容..."
          maxlength={2000}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
        />
        <View className="word-count">
          <Text>{content.length}/2000</Text>
        </View>
      </View>

      <View className="card">
        <Picker
          mode="selector"
          range={CATEGORIES}
          value={category}
          onChange={(e) => setCategory(Number(e.detail.value))}
        >
          <View className="picker-row">
            <Text className="picker-label">分类</Text>
            <Text className="picker-value">{CATEGORIES[category]}</Text>
            <Text className="arrow">›</Text>
          </View>
        </Picker>
        <View className="divider" />
        <Picker
          mode="selector"
          range={VISIBILITY}
          value={visibility}
          onChange={(e) => setVisibility(Number(e.detail.value))}
        >
          <View className="picker-row">
            <Text className="picker-label">可见范围</Text>
            <Text className="picker-value">{VISIBILITY[visibility]}</Text>
            <Text className="arrow">›</Text>
          </View>
        </Picker>
        <View className="divider" />
        <Input
          className="tags-input"
          placeholder="添加标签，用逗号分隔（选填）"
          value={tags}
          onInput={(e) => setTags(e.detail.value)}
        />
      </View>

      <Button className="submit-btn" loading={saving} onClick={submit} disabled={saving}>
        发布
      </Button>
    </View>
  )
}
