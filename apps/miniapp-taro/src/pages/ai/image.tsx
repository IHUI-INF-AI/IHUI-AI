import { logger } from '@/utils/logger'
import { View, Text, Textarea, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { generateImage } from '@/api'
import { useI18n } from '@/i18n'
import './image.css'

export default function ImagePage() {
  const { t, tList } = useI18n()
  const sizes = [
    { value: '512x512', label: '512' },
    { value: '1024x1024', label: '1024' },
    { value: '1024x1792', label: t('ai.image.vertical') },
  ]
  const examples = tList('ai.image.examples')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const onGenerate = useCallback(async () => {
    if (!prompt || loading) return
    setLoading(true)
    try {
      const res = await generateImage({ prompt, size })
      setResult(res.url)
    } catch (e) {
      logger.error('ai/image', '生成图片', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [prompt, size, loading, t])

  return (
    <View className="page">
      {result ? (
        <View className="canvas">
          <Image className="result-img" src={result} mode="aspectFit" />
        </View>
      ) : (
        <View className="empty">
          <Text className="empty-icon">🎨</Text>
          <Text className="empty-text">{t('ai.image.emptyHint')}</Text>
        </View>
      )}
      {!result ? (
        <View className="examples">
          <Text className="ex-title">{t('ai.image.tryThese')}</Text>
          <View className="ex-list">
            {examples.map((ex) => (
              <Text key={ex} className="ex-item" onClick={() => setPrompt(ex)}>
                {ex}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      <View className="form">
        <Textarea
          className="input"
          value={prompt}
          placeholder={t('ai.image.placeholder')}
          maxlength={500}
          onInput={(e) => setPrompt(e.detail.value)}
        />
        <View className="form-row">
          <View className="size-selector">
            {sizes.map((s) => (
              <Text
                key={s.value}
                className={`size${size === s.value ? ' active' : ''}`}
                onClick={() => setSize(s.value)}
              >
                {s.label}
              </Text>
            ))}
          </View>
          <Button className="btn" onClick={onGenerate} disabled={!prompt || loading}>
            {loading ? t('ai.image.generating') : t('ai.image.generate')}
          </Button>
        </View>
      </View>
    </View>
  )
}
