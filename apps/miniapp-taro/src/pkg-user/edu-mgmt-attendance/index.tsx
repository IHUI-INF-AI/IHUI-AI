// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): apps/mobile-rn/src/screens/EduAttendanceScreen.tsx
// 声明式薄壳:列表渲染归 ChildRecordsView,本页只配列定义 + 取数 + 三个动作槽。
// 动作一律「服务端为准」:成功后 bump reloadToken 重新取列表,不做本地乐观更新。
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import Button from '@/components/Button'
import { get, post, put } from '@/api'
import { ChildRecordsView, type ChildRecordRow } from '../edu-child/records-page'

interface Row {
  id: string
  studentId: string
  classId: string
  status: string
  checkInTime: string | null
  checkOutTime: string | null
  remark: string | null
}

interface BatchOutcome {
  created: number
  skipped: number
  missedIds: string[]
}

/**
 * 行内动作可见性判据(唯一实现,用例直接钉它)。
 * 签到只看「无 checkInTime」,签退只看「有 checkInTime ∧ 无 checkOutTime」——
 * 签退**绝不按 checkInMethod 挡**:学生自签过的行教师同样必须能签退
 * (web 侧踩过该缺陷并已修,此处不得回潮)。
 */
export function actionAvailability(r: {
  checkInTime: string | null
  checkOutTime: string | null
}): { canCheckIn: boolean; canCheckOut: boolean } {
  return {
    canCheckIn: !r.checkInTime,
    canCheckOut: Boolean(r.checkInTime) && !r.checkOutTime,
  }
}

export default function Page() {
  const { t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  /** 行 id → 后端原始行(壳只给 cells,动作需要的 classId/时刻留在本页) */
  const [meta, setMeta] = useState<Record<string, Row>>({})
  /** 进行中的动作键(行内动作 = in:<id> / out:<id>,头部 = batch) */
  const [busy, setBusy] = useState('')
  /** 失败与点名结果的常驻回显:后端 message 必须上屏,不许静默 */
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const st = (s: string) => {
    const k = `eduAttendance.status.${s}`
    const v = t(k)
    return v === k ? s : v
  }

  const classIds = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(meta)
            .map((r) => r.classId)
            .filter(Boolean),
        ),
      ),
    [meta],
  )
  const targetClassId = classIds[0] ?? ''

  const run = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusy(key)
      setNotice('')
      try {
        await action()
      } catch (e) {
        // 传输层已 toast 过一次,这里再落一条常驻回显:toast 会消失,失败不能消失
        const msg = (e as Error)?.message || t('common.loadFailed')
        setNotice(msg)
        Taro.showToast({ title: msg, icon: 'none' })
      } finally {
        setBusy('')
      }
    },
    [t],
  )

  const onCheckIn = (r: Row) =>
    run(`in:${r.id}`, async () => {
      await post('/edu-ai-management/attendance/check-in', {
        studentId: r.studentId,
        classId: r.classId,
        date: today,
        checkInMethod: 'manual',
        status: 'present',
      })
      Taro.showToast({ title: t('eduAttendance.checkedInToast'), icon: 'success' })
      setReloadToken((n) => n + 1)
    })

  const onCheckOut = (r: Row) =>
    run(`out:${r.id}`, async () => {
      await put('/edu-ai-management/attendance/check-out', {
        studentId: r.studentId,
        classId: r.classId,
        date: today,
        checkOutMethod: 'manual',
      })
      Taro.showToast({ title: t('eduAttendance.checkedOutToast'), icon: 'success' })
      setReloadToken((n) => n + 1)
    })

  const onBatch = () =>
    run('batch', async () => {
      const res = await post<BatchOutcome>('/edu-ai-management/attendance/batch-check-in', {
        classId: targetClassId,
        date: today,
      })
      const created = res?.created ?? 0
      const skipped = res?.skipped ?? 0
      const missed = res?.missedIds?.length ?? 0
      setNotice(t('eduAttendance.batchResult', { created, skipped, missed }))
      Taro.showToast({ title: t('eduAttendance.batchDoneToast'), icon: 'success' })
      setReloadToken((n) => n + 1)
    })

  const rowActions = useCallback(
    (row: ChildRecordRow): ReactNode => {
      const r = meta[row.id]
      if (!r) return null
      const { canCheckIn, canCheckOut } = actionAvailability(r)
      if (!canCheckIn && !canCheckOut) return null
      return (
        <>
          {canCheckIn ? (
            <Button
              size="sm"
              loading={busy === `in:${r.id}`}
              disabled={Boolean(busy) || !r.classId}
              onClick={() => void onCheckIn(r)}
            >
              {t('eduAttendance.checkInFor')}
            </Button>
          ) : null}
          {canCheckOut ? (
            <Button
              size="sm"
              variant="outline"
              loading={busy === `out:${r.id}`}
              disabled={Boolean(busy) || !r.classId}
              onClick={() => void onCheckOut(r)}
            >
              {t('eduAttendance.checkOut')}
            </Button>
          ) : null}
        </>
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta, busy, t],
  )

  const noClass = classIds.length === 0
  const headerAction = (
    <>
      <Button
        size="sm"
        loading={busy === 'batch'}
        disabled={noClass || Boolean(busy)}
        onClick={onBatch}
      >
        {t('eduAttendance.batchCheckIn')}
      </Button>
      {noClass ? (
        <Text className="text-xs text-muted-foreground">{t('eduAttendance.noClassReason')}</Text>
      ) : classIds.length > 1 ? (
        <Text className="text-xs text-muted-foreground">
          {t('eduAttendance.multiClass', { classId: targetClassId })}
        </Text>
      ) : null}
      {notice ? <Text className="w-full text-xs text-foreground">{notice}</Text> : null}
    </>
  )

  return (
    <ThemeRoot>
      <ChildRecordsView
        titleKey="eduMgmt.attendanceTitle"
        reloadToken={reloadToken}
        columns={[
          { key: 'student', title: t('eduAttendance.student') },
          { key: 'status', title: t('eduAttendance.statusTitle'), tone: 'ok' },
          { key: 'checkIn', title: t('eduAttendance.checkIn') },
          { key: 'checkOut', title: t('eduAttendance.checkOut') },
          { key: 'remark', title: t('eduChildMeals.ingredients') },
        ]}
        headerAction={headerAction}
        rowActions={rowActions}
        load={async (): Promise<ChildRecordRow[]> => {
          const res = await get<{ list: Row[] }>(`/edu-ai-management/attendance?date=${today}`)
          const list = (res as { list?: Row[] } | null)?.list ?? []
          setMeta(Object.fromEntries(list.map((r) => [r.id, r])))
          return list.map((r) => ({
            id: r.id,
            cells: {
              student: r.studentId,
              status: st(r.status),
              checkIn: r.checkInTime?.slice(11, 16) ?? '—',
              checkOut: r.checkOutTime?.slice(11, 16) ?? '—',
              remark: r.remark ?? '',
            },
          }))
        }}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
