// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): apps/mobile-rn/src/screens/EduChild*Screen.tsx(ConsoleTable 杠杆薄壳族)
// children 六子页(课表/考勤/成绩/餐食/账单/学习计划)的共享镜像渲染件:
// 列驱动的记录卡片列表(语义档类名与 RN token 同源),各页薄壳只配标题键、列定义与取数。
import { useCallback, useState, type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import BackChevron from '@/components/BackChevron'
import { EmptyState, ScreenSkeleton } from '@/components/ScreenStates.taro'

export interface ChildRecordColumn {
  key: string
  title: string
  /** 值强调色:ok=绿 / warn=黄 / danger=红 / 缺省=前景 */
  tone?: 'ok' | 'warn' | 'danger'
  flex?: boolean
}

export interface ChildRecordRow {
  id: string
  cells: Record<string, string>
}

/** 六子页共享镜像页(非路由页,由各薄壳包 ThemeRoot 后渲染) */
export function ChildRecordsView(options: {
  titleKey: string
  columns: ChildRecordColumn[]
  load: () => Promise<ChildRecordRow[]>
}): ReactNode {
  const { t } = useI18n()
  const [rows, setRows] = useState<ChildRecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const list = await options.load()
      setRows(list)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useDidShow(() => {
    void load()
  })

  const toneClass = (tone?: 'ok' | 'warn' | 'danger') =>
    tone === 'ok'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'danger'
          ? 'text-destructive'
          : 'text-foreground'

  return (
    <View className="min-h-screen bg-background p-4">
      <View className="flex items-center gap-3 py-3">
        <BackChevron />
        <Text className="text-xl font-bold text-foreground">{t(options.titleKey)}</Text>
      </View>
      {loading ? (
        <ScreenSkeleton variant="list" />
      ) : failed ? (
        <View className="py-8 text-center">
          <Text className="text-sm text-muted-foreground">{t('common.loadFailed')}</Text>
        </View>
      ) : rows.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <View className="space-y-3">
          {rows.map((r) => (
            <View key={r.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              {options.columns.map((c) => {
                const v = r.cells[c.key]
                if (!v) return null
                return (
                  <View
                    key={c.key}
                    className={`flex items-center justify-between gap-2 ${c.flex ? '' : ''}`}
                  >
                    <Text className="text-xs text-muted-foreground shrink-0">{c.title}</Text>
                    <Text className={`text-sm text-right ${toneClass(c.tone)}`}>{v}</Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/** 通用参数读取(children 子页统一 childId query 参数) */
export function childIdOf(): string {
  return Taro.getCurrentInstance().router?.params?.childId ?? ''
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
