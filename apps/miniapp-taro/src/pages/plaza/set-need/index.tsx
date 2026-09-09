// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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
    /* 对齐 RN 端 packages/app/src/features/set-need/SetNeedScreen.tsx 视觉语言:
       页面底 surface.bg→bg-background / label 16dp→32rpx 600 text.primary→text-foreground /
       区块间距 scrollContent gap 8dp→16rpx,label→选项组 8dp→16rpx /
       选项块按 input 块语言: bg surface.muted→bg-muted 圆角 12dp→24rpx
       padding 12/14dp→24/28rpx 字 16dp→32rpx text.primary→text-foreground /
       激活态 brand.DEFAULT→bg-primary + text-primary-foreground
       (RN 选中强调用 surface.light 固定白字,暗色下 brand=白会白上白不可读,
       按语义 token 修正为 primary-foreground,亮色表现与 RN 完全一致) /
       提交钮: bg brand→bg-primary 圆角 12dp→24rpx 字 16dp→32rpx 600
       高≈paddingVertical 15dp*2+行高→100rpx(兄弟页固定底钮档位),bottom 32rpx 平台惯例。
       注:小程序页为"偏好选择"(categories/level/budget),RN 屏为"发布需求表单",
       内容不同,仅对齐视觉语言;ThemeRoot 上提到页面根(修复暗色作用域)。 */
    <ThemeRoot className="min-h-screen bg-background px-[20rpx] pt-[24rpx] pb-[180rpx]">
      <View>
        <Text className="block text-[32rpx] text-foreground font-semibold">
          {t('plaza.setNeed.directionTitle')}
        </Text>
        <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx]">
          {t('plaza.setNeed.directionDesc')}
        </Text>
        <View className="flex flex-wrap gap-[16rpx] mt-[16rpx]">
          {categories.map((label, i) => {
            const key = CATEGORY_KEYS[i] || label
            const active = selected.includes(key)
            return (
              <View
                key={key}
                className={`px-[24rpx] py-[28rpx] rounded-[24rpx] ${active ? 'bg-primary' : 'bg-muted'}`}
                onClick={() => toggleCategory(key)}
                hoverClass="opacity-60">
                <Text
                  className={`text-[32rpx] ${active ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {label}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className="mt-[16rpx]">
        <Text className="block text-[32rpx] text-foreground font-semibold">
          {t('plaza.setNeed.levelTitle')}
        </Text>
        <View className="flex flex-wrap gap-[16rpx] mt-[16rpx]">
          {levels.map((lv) => {
            const active = level === lv
            return (
              <View
                key={lv}
                className={`px-[24rpx] py-[28rpx] rounded-[24rpx] ${active ? 'bg-primary' : 'bg-muted'}`}
                onClick={() => setLevel(lv)}
                hoverClass="opacity-60">
                <Text
                  className={`text-[32rpx] ${active ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {lv}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className="mt-[16rpx]">
        <Text className="block text-[32rpx] text-foreground font-semibold">
          {t('plaza.setNeed.budgetTitle')}
        </Text>
        <View className="flex flex-wrap gap-[16rpx] mt-[16rpx]">
          {budgets.map((b) => {
            const active = budget === b
            return (
              <View
                key={b}
                className={`px-[24rpx] py-[28rpx] rounded-[24rpx] ${active ? 'bg-primary' : 'bg-muted'}`}
                onClick={() => setBudget(b)}
                hoverClass="opacity-60">
                <Text
                  className={`text-[32rpx] ${active ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {b}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <Button
        className="fixed bottom-[32rpx] left-[20rpx] right-[20rpx] h-[100rpx] leading-[100rpx] bg-primary text-primary-foreground rounded-[24rpx] text-[32rpx] font-semibold"
        loading={saving}
        onClick={save}
        disabled={saving}
      >
        {t('plaza.setNeed.save')}
      </Button>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
