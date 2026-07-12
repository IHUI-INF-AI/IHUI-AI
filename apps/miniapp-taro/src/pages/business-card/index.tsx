import { View, Text, Input, Textarea, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getBusinessCard, updateBusinessCard } from '@/api'
import './index.css'

export default function BusinessCardIndex() {
  const [card, setCard] = useState<Record<string, unknown> | null>(null)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await getBusinessCard()) as Record<string, unknown>
      setCard(res)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(load)

  const onSave = useCallback(async () => {
    if (!card) return
    setSubmitting(true)
    try {
      await updateBusinessCard(card)
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setEditing(false)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [card])

  const update = (key: string, value: string) =>
    setCard((prev: Record<string, unknown> | null) => (prev ? { ...prev, [key]: value } : prev))

  return (
    <View className="card-page">
      <View className="page-header">
        <Text className="page-title">个人名片</Text>
      </View>
      {card ? (
        <View className="card-form">
          {card.avatar ? (
            <Image className="card-avatar" src={card.avatar} mode="aspectFill" />
          ) : null}
          <View className="form-item">
            <Text className="form-label">姓名</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={card.name || ''}
              onInput={(e) => update('name', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">职位</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={card.title || ''}
              onInput={(e) => update('title', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">公司</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={card.company || ''}
              onInput={(e) => update('company', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">手机</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={card.phone || ''}
              onInput={(e) => update('phone', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">简介</Text>
            <Textarea
              className="form-textarea"
              disabled={!editing}
              value={card.intro || ''}
              onInput={(e) => update('intro', e.detail.value)}
            />
          </View>
          {editing ? (
            <Button
              className="action-btn"
              loading={submitting}
              disabled={submitting}
              onClick={onSave}
            >
              保存
            </Button>
          ) : (
            <Button className="action-btn" onClick={() => setEditing(true)}>
              编辑名片
            </Button>
          )}
        </View>
      ) : (
        <Text className="loading-text">加载中...</Text>
      )}
    </View>
  )
}
