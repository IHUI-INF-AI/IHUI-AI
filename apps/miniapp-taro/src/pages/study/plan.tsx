// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/study-plan/StudyPlanScreen.tsx
//
// 薄壳(2026-11-14 收敛):列表视图委托共享屏 `StudyPlanScreen`,本端只保留平台职责:
//   ① 取数 —— GET /study/plan + 新建 POST;② AI 操控通道 useUiField 登记;
//   ③ 新增弹层(页面级弹层,不进共享屏);④ 轻提示。
// 卡片用共享屏的 renderItem 槽位承载本端独有字段(目标分钟 / 今日已学 / 状态徽章),
// 卡片脚复用同目录 ./plan-card 的 PlanFoot —— 与 RN 侧 statusLabel 词条逐字同源。
import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import { getStudyPlan, post } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { FocusInput } from '@/components/FocusField'
import { StudyPlanScreen } from '@ihui/rn-app/features/study-plan/StudyPlanScreen'
import { useAppTheme } from '@/lib/theme'
import { PlanFoot, statusClass, statusLabel, statusOf, type PlanItem } from './plan-card'
import { onToast } from '@/host/on-toast'

export default function StudyPlan() {
  const { t } = useI18n()
  const { resolved } = useAppTheme()
  const gate = useAuthReadyGate()
  const [list, setList] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTarget, setNewTarget] = useState('30')
  const [saving, setSaving] = useState(false)
  // AI 操控通道(2026-09-21):新增计划弹层的两个输入框,只在弹层展开时登记(收起即摘除,
  // 旧 id 如实失败),避免快照里出现界面上看不见的控件。
  useUiField(
    showAdd
      ? {
          kind: 'input',
          label: t('study.publish.titlePlaceholder'),
          maxLength: 50,
          readValue: () => newTitle,
          setValue: setNewTitle,
        }
      : null,
  )
  useUiField(
    showAdd
      ? {
          kind: 'number',
          label: t('study.planPage.target', { n: 30 }),
          inputType: 'number',
          readValue: () => newTarget,
          setValue: setNewTarget,
        }
      : null,
  )

  const load = useCallback(async () => {
    try {
      const res = (await getStudyPlan()) as { list?: PlanItem[] }
      setList(res.list || [])
    } catch {
      onToast(t('common.failed'), { kind: 'error' })
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
      onToast(t('study.publish.enterTitle'), { kind: 'info' })
      return
    }
    const target = Number(newTarget) || 30
    setSaving(true)
    try {
      await post('/study/plan', { title, target })
      setShowAdd(false)
      onToast(t('common.success'), { kind: 'success' })
      setLoading(true)
      await load()
    } catch {
      onToast(t('study.planPage.addFailed'), { kind: 'error' })
    } finally {
      setSaving(false)
    }
  }, [newTitle, newTarget, load, t])

  // G-933 冷启动抢跑门控:GET /api/study/plan 由 `miniapp-compat-routes.ts:2397`
  // 的 inline checkAuth 守 ⇒ 需鉴权。新增计划的 POST /api/study/plan 是用户动作,不经这一道门。
  useDidShow(() => {
    gate.waitUntilReady(load)
  })

  return (
    <ThemeRoot>
      <StudyPlanScreen
        t={t}
        items={list.map((p) => ({
          id: p.id,
          title: p.title,
          courseName: t('study.planPage.target', { n: p.target }),
          totalLessons: 0,
          completedLessons: 0,
          progress: p.progress,
          status: statusOf(p),
          deadline: p.deadline ?? '',
        }))}
        loading={loading}
        refreshing={false}
        error=""
        onRefresh={load}
        onPressItem={() => undefined}
        onBack={() => undefined}
        colorScheme={resolved}
        onToast={onToast}
        // 卡片走本端原实现:目标分钟 / 今日已学 / 状态徽章都是本端独有字段,
        // 共享默认卡片没有这三格(强行塞进 courseName 会把「目标分钟」显示成课程名)。
        renderItem={(item) => {
          const p = list.find((x) => x.id === item.id)
          if (!p) return null
          return (
            <View className="bg-card rounded-lg border border-border p-[28rpx]">
              <View className="flex justify-between items-center">
                <Text className="flex-1 text-subtitle text-foreground font-bold overflow-hidden">
                  {p.title}
                </Text>
                <Text className="text-caption text-[var(--color-text-tertiary)] ml-[16rpx] flex-shrink-0">
                  {t('study.planPage.target', { n: p.target })}
                </Text>
              </View>
              <View className="h-[12rpx] bg-muted rounded-xl mt-[20rpx] overflow-hidden">
                <View className="h-full bg-success rounded-xl" style={{ width: `${p.progress}%` }} />
              </View>
              <View className="flex justify-between items-center mt-[16rpx]">
                <Text className="text-caption text-[var(--color-text-tertiary)]">
                  {t('study.planPage.completed', { n: p.minutes ?? 0 })}
                </Text>
                {/* 状态徽章对齐 RN statusBadge(10dp→20rpx/600/px6→12rpx/py4→8rpx/radius 4dp→8rpx),
                    三档 active/completed/overdue 由进度与截止日推出;完成带 ✓ */}
                <Text
                  className={`text-badge font-semibold px-[12rpx] py-[8rpx] rounded-sm flex-shrink-0 ${statusClass(statusOf(p))}`}
                >
                  {statusLabel(t, statusOf(p))}
                </Text>
              </View>
              <PlanFoot item={p} t={t} />
            </View>
          )
        }}
        renderFooter={() => (
          <Button
            className="h-[100rpx] leading-[100rpx] bg-cta text-cta-foreground rounded-sm text-title font-semibold text-center"
            onClick={onAdd}
          >
            {t('study.planPage.add')}
          </Button>
        )}
      />

      {showAdd && (
        <View
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--color-black-40)]"
          onClick={() => setShowAdd(false)}
        >
          <View
            className="mx-2xl w-full max-w-[600rpx] bg-card ui-card rounded-lg border border-border p-[28rpx]"
            hoverClass="opacity-60"
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-title text-foreground font-semibold mb-[24rpx]">
              {t('study.planPage.add')}
            </Text>
            {/* 输入框对齐 RN fieldStyles.input:border light / radius 12dp→24rpx / h 50dp→100rpx / px 12dp→24rpx / bg surface.muted */}
            <FocusInput
              className="h-[100rpx] px-[24rpx] bg-muted border border-border rounded-sm text-title text-foreground mb-[24rpx]"
              placeholder={t('study.publish.titlePlaceholder')}
              value={newTitle}
              onInput={(e) => setNewTitle(e.detail.value)}
            />
            <View className="flex items-center mb-[24rpx]">
              <FocusInput
                className="flex-1 h-[100rpx] px-[24rpx] bg-muted border border-border rounded-sm text-title text-foreground"
                type="number"
                placeholder={t('study.planPage.target', { n: 30 })}
                value={newTarget}
                onInput={(e) => setNewTarget(e.detail.value)}
              />
            </View>
            <View className="flex gap-[16rpx]">
              <Button
                className="flex-1 h-[100rpx] leading-[100rpx] bg-muted text-foreground rounded-sm text-title text-center"
                onClick={() => setShowAdd(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1 h-[100rpx] leading-[100rpx] bg-cta text-cta-foreground rounded-sm text-title font-semibold text-center"
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
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
