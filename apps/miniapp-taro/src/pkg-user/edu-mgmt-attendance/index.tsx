// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): apps/mobile-rn/src/screens/EduAttendanceScreen.tsx
// 声明式薄壳:列表渲染归 ChildRecordsView,本页只配列定义 + 取数 + 三个动作槽。
// 动作一律「服务端为准」:成功后 bump reloadToken 重新取列表,不做本地乐观更新。
// 写接口入参见 ./contract.ts —— status 已从契约里删除(状态由服务端按该班考勤规则现算),
// 回填非当日必须同批给出该日内时刻,否则本端拒发请求。
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import Button from '@/components/Button'
import { get, post, put } from '@/api'
import { formatDate, nowDate } from '@/utils/time'
import { ChildRecordsView, type ChildRecordRow } from '../edu-child/records-page'
import DayBar from './day-bar'
import {
  TONE_CLASS,
  backfillBlocked,
  buildBatchPayload,
  buildCheckInPayload,
  buildCheckOutPayload,
  statusTally,
  statusToneOf,
} from './contract'

interface Row {
  id: string
  studentId: string
  classId: string
  /** 服务端回带的考勤日:写动作以此为准,不被页顶选择带跑 */
  date: string
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
  /** 今日业务日(Asia/Shanghai,单源 @/utils/time;此前用 toISOString() 取 UTC 日 ⇒ 早八点前错一天) */
  const today = nowDate()
  /** 取数与写动作的业务日,默认当日;可经 DayBar 选到历史日(回填) */
  const [date, setDate] = useState(today)
  /** 签到时刻 HH:mm;'' = 未选 ⇒ 由服务器落 now(仅当日合法) */
  const [hm, setHm] = useState('')
  /** 行 id → 后端原始行(壳只给 cells,动作需要的 classId/date/时刻留在本页) */
  const [meta, setMeta] = useState<Record<string, Row>>({})
  /** 进行中的动作键(行内动作 = in:<id> / out:<id>,头部 = batch) */
  const [busy, setBusy] = useState('')
  /** 失败与点名结果的常驻回显:后端 message 必须上屏,不许静默 */
  const [notice, setNotice] = useState('')
  const [tick, setTick] = useState(0)

  /**
   * 壳的取数回调是**首帧闭包**(其 useCallback 依赖为 []),所以业务日绝不能靠闭包捕获;
   * 经 ref 传递,壳在 reloadToken 变化时读到的才是新日。
   * 赋值必须写在 render 体内:子组件的 effect 早于父组件 effect 执行,放 useEffect 里会晚一帧。
   */
  const dateRef = useRef(date)
  dateRef.current = date

  /** 换日 = 换 token ⇒ 壳重取数;动作成功只进 tick 段 */
  const reloadToken = `${date}#${tick}`

  const st = (s: string) => {
    const k = `eduAttendance.status.${s}`
    const v = t(k)
    return v === k ? s : v
  }

  /** 时刻按上海墙钟渲染(此前 slice(11,16) 取的是 ISO 里的 UTC 时段,早八点后一律少 8 小时) */
  const clock = (v: string | null) => (v ? formatDate(v, 'HH:mm') || '—' : '—')

  const rows = useMemo(() => Object.values(meta), [meta])
  const classIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.classId).filter(Boolean))),
    [rows],
  )
  const targetClassId = classIds[0] ?? ''
  const tally = useMemo(() => statusTally(rows), [rows])

  /** 回填未给时刻 ⇒ 一切「签到」类写动作禁用(签退不受影响:时刻由服务器落) */
  const momentMissing = backfillBlocked(date, today, hm)

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
      const payload = buildCheckInPayload({
        studentId: r.studentId,
        classId: r.classId,
        date: r.date || date,
        hm,
        today,
      })
      // 载荷构造不出来 = 回填缺该日内时刻:请求一律不发出去,并把原因常驻上屏
      if (!payload) {
        setNotice(t('eduAttendance.backfillNeedsTime'))
        return
      }
      await post('/edu-ai-management/attendance/check-in', payload)
      Taro.showToast({ title: t('eduAttendance.checkedInToast'), icon: 'success' })
      setTick((n) => n + 1)
    })

  const onCheckOut = (r: Row) =>
    run(`out:${r.id}`, async () => {
      await put(
        '/edu-ai-management/attendance/check-out',
        buildCheckOutPayload({ studentId: r.studentId, classId: r.classId, date: r.date || date }),
      )
      Taro.showToast({ title: t('eduAttendance.checkedOutToast'), icon: 'success' })
      setTick((n) => n + 1)
    })

  const onBatch = () =>
    run('batch', async () => {
      const payload = buildBatchPayload({ classId: targetClassId, date, hm, today })
      if (!payload) {
        setNotice(t('eduAttendance.backfillNeedsTime'))
        return
      }
      const res = await post<BatchOutcome>('/edu-ai-management/attendance/batch-check-in', payload)
      const created = res?.created ?? 0
      const skipped = res?.skipped ?? 0
      const missed = res?.missedIds?.length ?? 0
      setNotice(t('eduAttendance.batchResult', { created, skipped, missed }))
      Taro.showToast({ title: t('eduAttendance.batchDoneToast'), icon: 'success' })
      setTick((n) => n + 1)
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
              disabled={Boolean(busy) || !r.classId || momentMissing}
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
    [meta, busy, momentMissing, t],
  )

  const noClass = classIds.length === 0
  const headerAction = (
    <>
      <DayBar date={date} hm={hm} today={today} onDate={setDate} onHm={setHm} />
      <Button
        size="sm"
        loading={busy === 'batch'}
        disabled={noClass || Boolean(busy) || momentMissing}
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
      {/* 状态构成:壳的 tone 是按列生效的,逐行色档要等壳补 rowCellTone —— 这一行先把真色档给出来 */}
      {tally.length > 0 ? (
        <View className="w-full flex flex-wrap items-center justify-end gap-2">
          {tally.map((x) => (
            <Text key={x.code} className={`text-xs ${TONE_CLASS[statusToneOf(x.code)]}`}>
              {`${st(x.code)} ${x.count}`}
            </Text>
          ))}
        </View>
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
          // 刻意不挂 tone:状态逐行不同,按列着色会把迟到/缺勤一起染绿(账面造假那一型的另一半)
          { key: 'status', title: t('eduAttendance.statusTitle') },
          { key: 'checkIn', title: t('eduAttendance.checkIn') },
          { key: 'checkOut', title: t('eduAttendance.checkOut') },
          { key: 'remark', title: t('eduChildMeals.ingredients') },
        ]}
        headerAction={headerAction}
        rowActions={rowActions}
        load={async (): Promise<ChildRecordRow[]> => {
          const res = await get<{ list: Row[] }>(
            `/edu-ai-management/attendance?date=${dateRef.current}`,
          )
          const list = (res as { list?: Row[] } | null)?.list ?? []
          setMeta(Object.fromEntries(list.map((r) => [r.id, r])))
          return list.map((r) => ({
            id: r.id,
            cells: {
              student: r.studentId,
              status: st(r.status),
              checkIn: clock(r.checkInTime),
              checkOut: clock(r.checkOutTime),
              remark: r.remark ?? '',
            },
          }))
        }}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
