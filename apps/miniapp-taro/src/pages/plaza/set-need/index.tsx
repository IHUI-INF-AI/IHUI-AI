import { View, Text, Button } from '@tarojs/components'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background pb-[140rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Text className="block text-[30rpx] text-foreground font-semibold">{t('plaza.setNeed.directionTitle')}</Text>
        <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] mb-[24rpx]">{t('plaza.setNeed.directionDesc')}</Text>
        <View className="flex flex-wrap gap-[20rpx] mt-[24rpx]">
          {categories.map((label, i) => {
            const key = CATEGORY_KEYS[i] || label
            const active = selected.includes(key)
            return (
              <View
                key={key}
                className={`px-[32rpx] py-[16rpx] rounded-[8rpx] ${active ? 'bg-[#e6f7ee]' : 'bg-background'}`}
                onClick={() => toggleCategory(key)}
              >
                <Text className={`text-[26rpx] ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Text className="block text-[30rpx] text-foreground font-semibold">{t('plaza.setNeed.levelTitle')}</Text>
        <View className="flex flex-wrap gap-[20rpx] mt-[24rpx]">
          {levels.map((lv) => {
            const active = level === lv
            return (
              <View
                key={lv}
                className={`px-[32rpx] py-[16rpx] rounded-[8rpx] ${active ? 'bg-[#e6f7ee]' : 'bg-background'}`}
                onClick={() => setLevel(lv)}
              >
                <Text className={`text-[26rpx] ${active ? 'text-primary' : 'text-muted-foreground'}`}>{lv}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Text className="block text-[30rpx] text-foreground font-semibold">{t('plaza.setNeed.budgetTitle')}</Text>
        <View className="flex flex-wrap gap-[20rpx] mt-[24rpx]">
          {budgets.map((b) => {
            const active = budget === b
            return (
              <View
                key={b}
                className={`px-[32rpx] py-[16rpx] rounded-[8rpx] ${active ? 'bg-[#e6f7ee]' : 'bg-background'}`}
                onClick={() => setBudget(b)}
              >
                <Text className={`text-[26rpx] ${active ? 'text-primary' : 'text-muted-foreground'}`}>{b}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <Button className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[88rpx] leading-[88rpx] bg-primary text-foreground rounded-[44rpx] text-[30rpx]" loading={saving} onClick={save} disabled={saving}>
        {t('plaza.setNeed.save')}
      </Button>
    </View>
  )
}
