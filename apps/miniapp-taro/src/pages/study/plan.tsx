// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Button, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyPlan, post } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface PlanItem {
  id: string
  title: string
  target: number
  progress: number
}

export default function StudyPlan() {
  const { t } = useI18n()
  const [list, setList] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTarget, setNewTarget] = useState('30')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getStudyPlan()
      setList(res.list || [])
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t])

  const onAdd = useCallback(() => {
    setNewTitle('')
    setNewTarget('30')
    setShowAdd(true)
  }, [])

  const submitAdd = useCallback(async () => {
    const title = newTitle.trim()
    if (!title) {
      Taro.showToast({ title: t('study.publish.enterTitle'), icon: 'none' })
      return
    }
    const target = Number(newTarget) || 30
    setSaving(true)
    try {
      await post('/study/plan', { title, target })
      setShowAdd(false)
      Taro.showToast({ title: t('common.success'), icon: 'success' })
      setLoading(true)
      await load()
    } catch {
      Taro.showToast({ title: t('study.planPage.addFailed'), icon: 'none' })
    } finally {
      setSaving(false)
    }
  }, [newTitle, newTarget, load, t])

  useDidShow(() => {
    load()
  })

  return (
    <ThemeRoot>
      {/* 对齐 RN StudyPlanScreen(共享屏):容器 bg surface.bg;卡片 p14dp→28rpx / radius 12dp→24rpx / border light;进度条 h6dp→12rpx / bg surface.muted / fill success;次级文字 11dp→22rpx text.tertiary */}
      <View className="min-h-screen bg-background pb-[180rpx]">
        {list.length > 0 && (
          <View className="p-[28rpx] flex flex-col gap-[16rpx]">
            {list.map((p) => (
              <View key={p.id} className="bg-card rounded-[24rpx] border border-border p-[28rpx]">
                <View className="flex justify-between items-center">
                  <Text className="flex-1 text-[36rpx] text-foreground font-bold overflow-hidden">
                    {p.title}
                  </Text>
                  <Text className="text-[22rpx] text-[var(--color-text-tertiary)] ml-[16rpx] flex-shrink-0">
                    {t('study.planPage.target', { n: p.target })}
                  </Text>
                </View>
                <View className="h-[12rpx] bg-muted rounded-[24rpx] mt-[20rpx] overflow-hidden">
                  <View
                    className="h-full bg-success rounded-[24rpx]"
                    style={{ width: `${p.progress}%` }}
                  />
                </View>
                <View className="flex justify-between items-center mt-[16rpx]">
                  <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                    {t('study.planPage.completed', { n: p.progress })}
                  </Text>
                  {/* 状态徽章对齐 RN statusBadge(10dp→20rpx/600/px6→12rpx/py4→8rpx/radius 4dp→8rpx):完成=success.lighter+deepText,进行中=success.light+success.DEFAULT */}
                  <Text
                    className={`text-[20rpx] font-semibold px-[12rpx] py-[8rpx] rounded-[8rpx] ${
                      p.progress >= p.target
                        ? 'bg-[var(--color-success-lighter)] text-[var(--color-success-deep-text)]'
                        : 'bg-[var(--color-success-light)] text-success'
                    }`}
                  >
                    {p.progress >= p.target
                      ? t('study.planPage.statusDone')
                      : t('study.planPage.statusInProgress')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {!loading && list.length === 0 && (
          <View className="flex items-center justify-center py-[96rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{t('study.planPage.empty')}</Text>
          </View>
        )}
        <Button
          className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[100rpx] leading-[100rpx] bg-primary text-primary-foreground rounded-[30rpx] text-[32rpx] font-semibold text-center"
          onClick={onAdd}
        >
          {t('study.planPage.add')}
        </Button>

        {showAdd && (
          <View
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--color-black-40)]"
            onClick={() => setShowAdd(false)}
          >
            <View
              className="mx-6 w-full max-w-[600rpx] bg-card rounded-[24rpx] border border-border p-[28rpx]"
              hoverClass="opacity-60"
              onClick={(e) => e.stopPropagation()}
            >
              <Text className="block text-[32rpx] text-foreground font-semibold mb-[24rpx]">
                {t('study.planPage.add')}
              </Text>
              {/* 输入框对齐 RN fieldStyles.input:border light / radius 12dp→24rpx / h 50dp→100rpx / px 12dp→24rpx / bg surface.muted */}
              <Input
                className="h-[100rpx] px-[24rpx] bg-muted border border-border rounded-[24rpx] text-[32rpx] text-foreground mb-[24rpx]"
                placeholder={t('study.publish.titlePlaceholder')}
                value={newTitle}
                onInput={(e) => setNewTitle(e.detail.value)}
              />
              <View className="flex items-center mb-[24rpx]">
                <Input
                  className="flex-1 h-[100rpx] px-[24rpx] bg-muted border border-border rounded-[24rpx] text-[32rpx] text-foreground"
                  type="number"
                  placeholder={t('study.planPage.target', { n: 30 })}
                  value={newTarget}
                  onInput={(e) => setNewTarget(e.detail.value)}
                />
              </View>
              <View className="flex gap-[16rpx]">
                <Button
                  className="flex-1 h-[100rpx] leading-[100rpx] bg-muted text-foreground rounded-[24rpx] text-[32rpx] text-center"
                  onClick={() => setShowAdd(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1 h-[100rpx] leading-[100rpx] bg-primary text-primary-foreground rounded-[24rpx] text-[32rpx] font-semibold text-center"
                  loading={saving}
                  disabled={saving}
                  onClick={submitAdd}
                >
                  {t('common.confirm')}
                </Button>
              </View>
            </View>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
