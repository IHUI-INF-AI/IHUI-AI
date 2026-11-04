// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 考勤页顶部的「业务日 + 签到时刻」选择条(唯一实现,只在 edu-mgmt-attendance 内消费)。
//
// 为什么长这样:本页是 ChildRecordsView 的声明式薄壳,自带两个槽 —— headerAction(标题行右侧)
// 与 rowActions(行尾)。日期/时刻是**整页作用域**的取数与写入口径(列表按它取、代签/点名按它写),
// 所以进 headerAction 而不是逐行;行尾只留"这一行签没签"的两个动作。
//
// 时刻档刻意允许留空:留空 = 由服务器落 now(只有当日合法)。选到非当日却还没给时刻时,
// 本条直接把可读原因摆在控件下方,并由页面禁用写按钮 —— 失效方向是"多要一次说明",
// 不是"先打出去吃 400"。
import type { ReactNode } from 'react'
import { Picker, View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import LineIcon from '@/components/LineIcon'
import { backfillBlocked } from './contract'

/** 选择条外壳类名:描边取中性档 border-border(不得取墨档),圆角取 chip 角色档 rounded-md。 */
const CHIP = 'flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1'

export function DayBar(options: {
  /** 当前业务日 YYYY-MM-DD(上海日,单源 @/utils/time) */
  date: string
  /** 签到时刻 HH:mm;'' = 未选(仅当日合法,由服务器落 now) */
  hm: string
  /** 今日业务日,用于判"是否回填" */
  today: string
  onDate: (value: string) => void
  onHm: (value: string) => void
}): ReactNode {
  const { t } = useI18n()
  const blocked = backfillBlocked(options.date, options.today, options.hm)
  return (
    <View className="flex flex-wrap items-center justify-end gap-2">
      <Picker mode="date" value={options.date} onChange={(e) => options.onDate(e.detail.value)}>
        <View className={CHIP}>
          <Text className="text-xs text-foreground">{options.date}</Text>
          <LineIcon name="chevron-down" size={24} />
        </View>
      </Picker>
      <Picker mode="time" value={options.hm} onChange={(e) => options.onHm(e.detail.value)}>
        <View className={CHIP}>
          <Text className="text-xs text-muted-foreground">{t('eduAttendance.checkInAt')}</Text>
          <Text
            className={
              options.hm === '' ? 'text-xs text-muted-foreground' : 'text-xs text-foreground'
            }
          >
            {options.hm === '' ? t('eduAttendance.momentNow') : options.hm}
          </Text>
          <LineIcon name="chevron-down" size={24} />
        </View>
      </Picker>
      {blocked ? (
        <Text className="w-full text-xs text-amber-600">
          {t('eduAttendance.backfillNeedsTime')}
        </Text>
      ) : null}
    </View>
  )
}

export default DayBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
