import { View, Text, Button, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyPlan, post } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background pb-[60px]">
      {list.length > 0 && (
        <View className="p-3">
          {list.map((p) => (
            <View key={p.id} className="bg-card rounded-2xl p-3 mb-3">
              <View className="flex justify-between items-center">
                <Text className="text-sm text-foreground font-semibold">{p.title}</Text>
                <Text className="text-xs text-muted-foreground">
                  {t('study.planPage.target', { n: p.target })}
                </Text>
              </View>
              <View className="h-1.5 bg-muted rounded mt-2">
                <View className="h-full bg-primary rounded" style={{ width: `${p.progress}%` }} />
              </View>
              <View className="flex justify-between mt-1.5">
                <Text className="text-xs text-muted-foreground">
                  {t('study.planPage.completed', { n: p.progress })}
                </Text>
                <Text
                  className={`text-xs ${p.progress >= p.target ? 'text-[#4caf50]' : 'text-[#ff9a3c]'}`}
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
        <View className="text-center py-16 text-muted-foreground">
          <Text>{t('study.planPage.empty')}</Text>
        </View>
      )}
      <Button
        className="fixed bottom-4 left-4 right-4 bg-primary text-white rounded-md text-sm"
        onClick={onAdd}
      >
        {t('study.planPage.add')}
      </Button>

      {showAdd && (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <View
            className="mx-6 w-full max-w-[300px] bg-card rounded-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-base text-foreground font-semibold mb-3">
              {t('study.planPage.add')}
            </Text>
            <Input
              className="h-9 px-3 bg-background rounded-md text-sm mb-3"
              placeholder={t('study.publish.titlePlaceholder')}
              value={newTitle}
              onInput={(e) => setNewTitle(e.detail.value)}
            />
            <View className="flex items-center mb-3">
              <Input
                className="h-9 px-3 bg-background rounded-md text-sm flex-1"
                type="number"
                placeholder={t('study.planPage.target', { n: 30 })}
                value={newTarget}
                onInput={(e) => setNewTarget(e.detail.value)}
              />
            </View>
            <View className="flex gap-3">
              <Button
                className="flex-1 h-9 leading-9 bg-muted text-foreground rounded-md text-sm"
                onClick={() => setShowAdd(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1 h-9 leading-9 bg-primary text-white rounded-md text-sm"
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
  )
}
