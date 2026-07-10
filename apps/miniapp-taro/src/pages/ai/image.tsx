import { View, Text, Textarea, Button, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { generateImage } from '@/api'
import './image.css'

const sizes = [
  { value: '512x512', label: '512' },
  { value: '1024x1024', label: '1024' },
  { value: '1024x1792', label: '竖版' },
]
const examples = ['一只可爱的猫咪', '未来城市夜景', '抽象艺术作品', '油画风格山水']

export default function ImagePage() {
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
    } catch (e) {} finally { setLoading(false) }
  }, [prompt, size, loading])

  return (
    <View className="page">
      {result ? (
        <View className="canvas">
          <Image className="result-img" src={result} mode="aspectFit" />
        </View>
      ) : (
        <View className="empty">
          <Text className="empty-icon">🎨</Text>
          <Text className="empty-text">输入描述生成AI图片</Text>
        </View>
      )}
      {!result ? (
        <View className="examples">
          <Text className="ex-title">试试这些：</Text>
          <View className="ex-list">
            {examples.map(ex => (
              <Text key={ex} className="ex-item" onClick={() => setPrompt(ex)}>{ex}</Text>
            ))}
          </View>
        </View>
      ) : null}
      <View className="form">
        <Textarea
          className="input"
          value={prompt}
          placeholder="描述你想要生成的图片..."
          maxlength={500}
          onInput={e => setPrompt(e.detail.value)}
        />
        <View className="form-row">
          <View className="size-selector">
            {sizes.map(s => (
              <Text
                key={s.value}
                className={`size${size === s.value ? ' active' : ''}`}
                onClick={() => setSize(s.value)}
              >{s.label}</Text>
            ))}
          </View>
          <Button
            className="btn"
            onClick={onGenerate}
            disabled={!prompt || loading}
          >{loading ? '生成中' : '生成'}</Button>
        </View>
      </View>
    </View>
  )
}
