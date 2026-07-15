import { View, Text, Button } from '@tarojs/components'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

const CATEGORY_KEYS = [
  'writing',
  'coding',
  'design',
  'marketing',
  'education',
  'translation',
  'analysis',
  'customer',
]

export default function SetNeed() {
  const { t, tList } = useI18n()
  const [selected, setSelected] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = tList('plaza.setNeed.categories')
  const levels = tList('plaza.setNeed.levels')
  const budgets = tList('plaza.setNeed.budgets')

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
      Taro.showToast({ title: t('plaza.setNeed.selectAtLeast'), icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await post('/plaza/need', { categories: selected, level, budget })
      Taro.showToast({ title: t('plaza.setNeed.saved'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e) {
      logger.error('plaza/set-need', 'save', e)
    } finally {
      setSaving(false)
    }
  }, [selected, level, budget, t])

  return (
    <View className="page">
      <View className="card">
        <Text className="card-title">{t('plaza.setNeed.directionTitle')}</Text>
        <Text className="card-desc">{t('plaza.setNeed.directionDesc')}</Text>
        <View className="tag-group">
          {categories.map((label, i) => {
            const key = CATEGORY_KEYS[i] || label
            return (
              <View
                key={key}
                className={`tag${selected.includes(key) ? ' active' : ''}`}
                onClick={() => toggleCategory(key)}
              >
                <Text>{label}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className="card">
        <Text className="card-title">{t('plaza.setNeed.levelTitle')}</Text>
        <View className="tag-group">
          {levels.map((lv) => (
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
        <Text className="card-title">{t('plaza.setNeed.budgetTitle')}</Text>
        <View className="tag-group">
          {budgets.map((b) => (
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
        {t('plaza.setNeed.save')}
      </Button>
    </View>
  )
}
