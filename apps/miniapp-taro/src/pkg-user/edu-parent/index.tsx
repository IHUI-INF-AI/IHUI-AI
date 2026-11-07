// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): apps/mobile-rn/src/screens/EduParentScreen.tsx(ConsoleTable 杠杆薄壳)
// 家长端首页镜像:已绑定孩子卡片列表(昵称/关系/状态),语义档类名与 RN token 同源。
// 端点与 RN 同源:GET /api/edu-ai-management/parent/children ⇒ { children: ChildInfo[] }。
// children 子页(课表/考勤/成绩/餐食/账单/学习计划)镜像排后续批。
import { useCallback, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { get } from '@/api'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { EmptyState, ScreenSkeleton } from '@/components/ScreenStates.taro'

interface ChildInfo {
  bindingId: string
  studentId: string
  relationship: string
  status: string
  student: { id: string; nickname: string; avatar: string | null } | null
}

export default function EduParentPage() {
  const { t } = useI18n()
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const statusLabel = useCallback(
    (s: string) => {
      const v = t(`eduParent.status.${s}`)
      return v === `eduParent.status.${s}` ? s : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await get<{ children: ChildInfo[] }>('/edu-ai-management/parent/children')
      setChildren(res?.children ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    void load()
  })

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background p-lg">
        <View className="flex items-center gap-md py-md">
          <Text className="text-heading font-bold text-foreground">{t('eduParent.title')}</Text>
        </View>

        <View
          className="rounded-lg border border-border bg-card p-lg flex items-center justify-between gap-sm"
          hoverClass="opacity-80"
          onClick={() => {
            void Taro.navigateTo({ url: '/pkg-user/edu-my-attendance/index' })
          }}
        >
          <Text className="text-title font-semibold text-foreground">
            {t('eduMyAttendance.title')}
          </Text>
          <Text className="text-label text-muted-foreground">
            {t('eduParent.myAttendanceHint')}
          </Text>
        </View>

        {loading ? (
          <ScreenSkeleton variant="card" />
        ) : failed ? (
          <View className="py-3xl text-center">
            <Text className="text-body text-muted-foreground">{t('common.loadFailed')}</Text>
          </View>
        ) : children.length === 0 ? (
          <EmptyState title={t('eduParent.empty')} />
        ) : (
          <View className="space-y-md">
            {children.map((c) => (
              <View
                key={c.bindingId}
                className="rounded-lg border border-border bg-card p-lg flex items-center justify-between gap-sm"
              >
                <View className="flex-1 min-w-0 space-y-xs">
                  <Text className="text-title font-semibold text-foreground truncate">
                    {c.student?.nickname ?? c.studentId}
                  </Text>
                  <Text className="text-label text-muted-foreground">{c.relationship}</Text>
                </View>
                <Text
                  className={`text-label font-semibold ${
                    c.status === 'active' || c.status === 'confirmed'
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  }`}
                >
                  {statusLabel(c.status)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
