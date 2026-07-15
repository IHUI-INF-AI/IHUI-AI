import { View, Text, Input, Textarea, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getBusinessCard, updateBusinessCard } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function BusinessCardIndex() {
  const { t } = useI18n()
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
      Taro.showToast({ title: t('businessCard.saved'), icon: 'success' })
      setEditing(false)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [card, t])

  const update = (key: string, value: string) =>
    setCard((prev: Record<string, unknown> | null) => (prev ? { ...prev, [key]: value } : prev))

  return (
    <View className="card-page">
      <View className="page-header">
        <Text className="page-title">{t('businessCard.title')}</Text>
      </View>
      {card ? (
        <View className="card-form">
          {card.avatar ? (
            <Image className="card-avatar" src={card.avatar as string} mode="aspectFill" />
          ) : null}
          <View className="form-item">
            <Text className="form-label">{t('businessCard.name')}</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={(card.name as string) || ''}
              onInput={(e) => update('name', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('businessCard.position')}</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={(card.title as string) || ''}
              onInput={(e) => update('title', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('businessCard.company')}</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={(card.company as string) || ''}
              onInput={(e) => update('company', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('businessCard.phone')}</Text>
            <Input
              className="form-input"
              disabled={!editing}
              value={(card.phone as string) || ''}
              onInput={(e) => update('phone', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('businessCard.intro')}</Text>
            <Textarea
              className="form-textarea"
              disabled={!editing}
              value={(card.intro as string) || ''}
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
              {t('businessCard.save')}
            </Button>
          ) : (
            <Button className="action-btn" onClick={() => setEditing(true)}>
              {t('businessCard.edit')}
            </Button>
          )}
        </View>
      ) : (
        <Text className="loading-text">{t('businessCard.loading')}</Text>
      )}
    </View>
  )
}
