// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/model-edit/ModelEditScreen.tsx
// 薄壳化(2026-11-06 路 1):页面只保留「数据装载 + 平台能力注入」,渲染统一走共享屏 ModelEditScreen。
// 形制锁:渲染对齐共享屏 ModelEditScreen(本页只做状态装载与注入,不另绘 UI)。
// 两端取值不同但都显式传(共享屏不内建):
//   ① cycleOptions:小程序「月/季/年」↔ RN「月/年/永久」;
//   ② audienceOptions:小程序「个人/企业」↔ RN「全部/会员」;
//   ③ loading 各传真实加载态;showCancel 小程序 false(返回交给原生导航栏)、RN true;
//   ④ 头像:共享屏只渲染首字母占位,小程序页不再显示头像图(无新增单端 prop)。

import { useTt, useI18n, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { get } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'
import { useTheme } from '@/rn-compat/theme'
import { submitModelEdit } from '@ihui/shared/utils'
import { updateAgentBilling } from '@ihui/api-client'
import { ModelEditScreen as SharedModelEditScreen } from '@ihui/rn-app/features/model-edit/ModelEditScreen'
import type {
  ModelEditAudience,
  ModelEditAudienceOption,
  ModelEditBaseInfo,
  ModelEditCycleOption,
  ModelEditFieldValues,
  ModelEditOption,
  ModelEditPayCycle,
  ModelEditSaleType,
} from '@ihui/types'

const CATEGORIES = [
  t('deventerModeledit.r1'),
  t('deventerModeledit.r2'),
  t('deventerModeledit.r3'),
  t('deventerModeledit.r4'),
  t('deventerModeledit.r5'),
  t('deventerModeledit.r6'),
  t('deventerModeledit.r7'),
  t('deventerModeledit.r8'),
]
const DEPARTMENTS = [
  '研发部',
  t('deventerModeledit.q1'),
  t('deventerModeledit.q2'),
  t('deventerModeledit.q3'),
  t('deventerModeledit.q4'),
  t('deventerModeledit.q5'),
]

type ChargePeriod = 'monthly' | 'quarterly' | 'yearly'
type LimitedDuration = '1day' | '3day' | '7day' | '30day'
type Discount = 'none' | 'partial' | 'full'

/** 小程序周期档 ↔ 共享屏周期值(小程序不提供「永久」档,映射表刻意不列 permanent) */
const PERIOD_TO_CYCLE: Record<ChargePeriod, ModelEditPayCycle> = {
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
}
const CYCLE_TO_PERIOD: Partial<Record<ModelEditPayCycle, ChargePeriod>> = {
  month: 'monthly',
  quarter: 'quarterly',
  year: 'yearly',
}

export default function ModelEdit() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()

  const router = useRouter()
  const agentId = (router.params.id as string) || ''

  // 头像不进 baseInfo:共享屏按首字母占位(与 RN 端同形,不新增单端 prop)
  const [agentInfo, setAgentInfo] = useState<{ name?: string; prologue?: string }>({})
  const [categories, setCategories] = useState<string[]>([])
  const [deptIndex, setDeptIndex] = useState(0)
  // 置灰判定由共享屏读同一份清单(packages/shared/src/constants/model-edit.ts)自行渲染
  const [saleType, setSaleType] = useState<ModelEditSaleType>('limited')
  const [chargePeriod, setChargePeriod] = useState<ChargePeriod>('monthly')
  const [limitedDuration, setLimitedDuration] = useState<LimitedDuration>('7day')
  const [targetGroup, setTargetGroup] = useState<ModelEditAudience>('individual')
  const [discount, setDiscount] = useState<Discount>('none')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadAgent = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const res = (await get(`/agents/${agentId}`)) as Record<string, unknown>
      // res.avatar 不再消费:共享屏按首字母占位,小程序页不再显示头像图
      setAgentInfo({
        name: (res.name as string) || (res.agentName as string),
        prologue: (res.prologue as string) || (res.description as string) || undefined,
      })
    } catch (e) {
      logger.error('model-edit', t('deventerModeledit.q6'), e)
    } finally {
      setLoading(false)
    }
  }, [agentId, t])

  useDidShow(() => {
    loadAgent()
  })

  const toggleCategory = (cat: string) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
  }

  const categoryOptions: ModelEditOption[] = CATEGORIES.map((c) => ({ id: c, label: c }))
  const deptOptions: ModelEditOption[] = DEPARTMENTS.map((d) => ({ id: d, label: d }))
  const freeDurationOptions: { id: LimitedDuration; label: string }[] = [
    { id: '1day', label: tt('devEnter.modelEdit.limitedDuration1Day', '1天') },
    { id: '3day', label: tt('devEnter.modelEdit.limitedDuration3Day', '3天') },
    { id: '7day', label: tt('devEnter.modelEdit.limitedDuration7Day', '7天') },
    { id: '30day', label: tt('devEnter.modelEdit.limitedDuration30Day', '30天') },
  ]
  const freeDurations = freeDurationOptions.map((o) => o.label)
  const discountOptions: ModelEditOption[] = [
    { id: 'none', label: tt('devEnter.modelEdit.discountNone', '不参与') },
    { id: 'partial', label: tt('devEnter.modelEdit.discountPartial', '部分参与') },
    { id: 'full', label: tt('devEnter.modelEdit.discountFull', '全部参与') },
  ]
  // 共享屏不内建这两组选项:小程序显式传「月/季/年」与「个人/企业」
  const cycleOptions: ModelEditCycleOption[] = [
    { value: 'month', label: tt('devEnter.modelEdit.chargePeriodMonthly', '月') },
    { value: 'quarter', label: tt('devEnter.modelEdit.chargePeriodQuarterly', '季') },
    { value: 'year', label: tt('devEnter.modelEdit.chargePeriodYearly', '年') },
  ]
  const audienceOptions: ModelEditAudienceOption[] = [
    { value: 'individual', label: tt('devEnter.modelEdit.targetGroupIndividual', '个人') },
    { value: 'enterprise', label: tt('devEnter.modelEdit.targetGroupEnterprise', '企业') },
  ]

  const baseInfo: ModelEditBaseInfo = {
    name: agentInfo.name || tt('devEnter.modelEdit.model', '模型'),
    prologue: agentInfo.prologue || '',
  }
  const freeDurLabel = freeDurationOptions.find((o) => o.id === limitedDuration)?.label ?? ''
  const fields: ModelEditFieldValues = {
    categories,
    dept: DEPARTMENTS[deptIndex] ?? DEPARTMENTS[0] ?? '',
    saleType,
    cycle: PERIOD_TO_CYCLE[chargePeriod],
    price,
    freeDur: freeDurLabel,
    audience: targetGroup,
    discount,
  }

  const handleChange = <K extends keyof ModelEditFieldValues>(
    key: K,
    value: ModelEditFieldValues[K],
  ) => {
    switch (key) {
      case 'categories':
        setCategories(value as string[])
        break
      case 'dept':
        setDeptIndex(Math.max(0, DEPARTMENTS.indexOf(value as string)))
        break
      case 'saleType':
        setSaleType(value as ModelEditSaleType)
        break
      case 'cycle': {
        const period = CYCLE_TO_PERIOD[value as ModelEditPayCycle]
        // 小程序不提供「永久」档:未注入档位不落状态(共享屏只渲染注入的三档)
        if (period) setChargePeriod(period)
        break
      }
      case 'price':
        setPrice(value as string)
        break
      case 'freeDur': {
        const opt = freeDurationOptions.find((o) => o.label === value)
        if (opt) setLimitedDuration(opt.id)
        break
      }
      case 'audience':
        setTargetGroup(value as ModelEditAudience)
        break
      case 'discount':
        // 共享屏点已选档会回传 '':小程序「不参与」本身是一档,保持原选择
        if (value !== '') setDiscount(value as Discount)
        break
    }
  }

  const onSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      // 与 RN 端同形:仅 price/isFree 两列真落库(PUT /agents/:agentId),其余只读字段不进 body。
      // 端点由宿主注入(同跨端纪律),成功只在真实请求回来后才出现,失败原样上屏。
      const outcome = await submitModelEdit(
        (id, payload) => updateAgentBilling(id, payload),
        agentId,
        { saleType, price },
      )
      if (outcome.ok) {
        onToast(tt('devEnter.modelEdit.saveSuccess', '保存成功'), { kind: 'success' })
      } else {
        onToast(outcome.error.message, { kind: 'error' })
      }
    } catch (e) {
      onToast(e instanceof Error ? e.message : String(e), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ThemeRoot>
      <SharedModelEditScreen
        t={t}
        baseInfo={baseInfo}
        fields={fields}
        categoryOptions={categoryOptions}
        deptOptions={deptOptions}
        freeDurations={freeDurations}
        discountOptions={discountOptions}
        cycleOptions={cycleOptions}
        audienceOptions={audienceOptions}
        loading={loading}
        showCancel={false}
        submitting={submitting}
        onChange={handleChange}
        onToggleCategory={toggleCategory}
        onSave={onSubmit}
        onCancel={() => undefined}
        colorScheme={resolvedTheme}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
