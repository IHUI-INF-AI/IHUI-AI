import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import './index.css'

interface NeedCategory {
  key: string
  label: string
}

const CATEGORIES: NeedCategory[] = [
  { key: 'writing', label: '文案写作' },
  { key: 'coding', label: '编程开发' },
  { key: 'design', label: '设计创作' },
  { key: 'marketing', label: '营销推广' },
  { key: 'education', label: '教育培训' },
  { key: 'translation', label: '翻译服务' },
  { key: 'analysis', label: '数据分析' },
  { key: 'customer', label: '客服咨询' },
]

const LEVELS = ['入门级', '进阶级', '专业级']

export default function SetNeed() {
  const [selected, setSelected] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await get<Record<string, unknown>>('/plaza/need')
      if (res) {
        setSelected((res.categories as string[]) || [])
        setLevel((res.level as string) || '')
        setBudget((res.budget as string) || '')
      }
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => load())

  const toggleCategory = useCallback((key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])

  const save = useCallback(async () => {
    if (!selected.length) {
      Taro.showToast({ title: '请至少选择一个需求方向', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await post('/plaza/need', { categories: selected, level, budget })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e) {
      console.error('[plaza/set-need] save failed:', e)
    } finally {
      setSaving(false)
    }
  }, [selected, level, budget])

  return (
    <View className="page">
      <View className="card">
        <Text className="card-title">需求方向</Text>
        <Text className="card-desc">选择您感兴趣的方向，我们将为您推荐相关模型</Text>
        <View className="tag-group">
          {CATEGORIES.map((cat) => (
            <View
              key={cat.key}
              className={`tag${selected.includes(cat.key) ? ' active' : ''}`}
              onClick={() => toggleCategory(cat.key)}
            >
              <Text>{cat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="card">
        <Text className="card-title">使用水平</Text>
        <View className="tag-group">
          {LEVELS.map((lv) => (
            <View
              key={lv}
              className={`tag${level === lv ? ' active' : ''}`}
              onClick={() => setLevel(lv)}
            >
              <Text>{lv}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="card">
        <Text className="card-title">预算范围（选填）</Text>
        <View className="tag-group">
          {['免费', '100元内', '100-500元', '500元以上'].map((b) => (
            <View
              key={b}
              className={`tag${budget === b ? ' active' : ''}`}
              onClick={() => setBudget(b)}
            >
              <Text>{b}</Text>
            </View>
          ))}
        </View>
      </View>

      <Button className="save-btn" loading={saving} onClick={save} disabled={saving}>
        保存设置
      </Button>
    </View>
  )
}
