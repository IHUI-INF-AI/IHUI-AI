import { logger } from '@/utils/logger'
import { View, Text, Input, Picker, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'

const CATEGORIES = [
  '文案写作',
  '图像设计',
  '视频创作',
  '编程开发',
  '营销策划',
  '办公效率',
  '学习教育',
  '生活助手',
]
const DEPARTMENTS = ['研发部', '产品部', '设计部', '运营部', '市场部', '销售部']

type SaleType = 'free' | 'limited' | 'paid'
type ChargePeriod = 'monthly' | 'quarterly' | 'yearly'
type LimitedDuration = '1day' | '3day' | '7day' | '30day'
type TargetGroup = 'individual' | 'enterprise'
type Discount = 'none' | 'partial' | 'full'

interface Opt {
  value: string
  label: string
}

const OPT_BASE = 'py-[14rpx] px-[28rpx] bg-card rounded-[12rpx] text-[26rpx] text-secondary-foreground border border-border'
const OPT_ACTIVE = 'bg-[rgba(0,242,255,0.12)] text-primary border-primary'
const TAG_BASE = 'py-[12rpx] px-[24rpx] bg-card rounded-[12rpx] text-[24rpx] text-secondary-foreground border border-border'
const TAG_ACTIVE = 'bg-[rgba(0,242,255,0.12)] text-primary border-primary'

export default function ModelEdit() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }

  const router = useRouter()
  const agentId = (router.params.id as string) || ''

  const [agentInfo, setAgentInfo] = useState<{
    name?: string
    avatar?: string
    prologue?: string
  }>({})
  const [categories, setCategories] = useState<string[]>([])
  const [deptIndex, setDeptIndex] = useState(0)
  const [saleType, setSaleType] = useState<SaleType>('limited')
  const [chargePeriod, setChargePeriod] = useState<ChargePeriod>('monthly')
  const [limitedDuration, setLimitedDuration] = useState<LimitedDuration>('7day')
  const [targetGroup, setTargetGroup] = useState<TargetGroup>('individual')
  const [discount, setDiscount] = useState<Discount>('none')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadAgent = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const res = (await get(`/agents/${agentId}`)) as Record<string, unknown>
      setAgentInfo({
        name: (res.name as string) || (res.agentName as string),
        avatar: (res.avatar as string) || undefined,
        prologue:
          (res.prologue as string) || (res.description as string) || undefined,
      })
    } catch (e) {
      logger.error('model-edit', '加载智能体', e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useDidShow(() => {
    loadAgent()
  })

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

  const saleTypeOpts: Opt[] = [
    { value: 'free', label: tt('devEnter.modelEdit.saleTypeFree', '免费') },
    {
      value: 'limited',
      label: tt('devEnter.modelEdit.saleTypeLimited', '限时免费'),
    },
    { value: 'paid', label: tt('devEnter.modelEdit.saleTypePaid', '付费') },
  ]
  const periodOpts: Opt[] = [
    {
      value: 'monthly',
      label: tt('devEnter.modelEdit.chargePeriodMonthly', '月'),
    },
    {
      value: 'quarterly',
      label: tt('devEnter.modelEdit.chargePeriodQuarterly', '季'),
    },
    {
      value: 'yearly',
      label: tt('devEnter.modelEdit.chargePeriodYearly', '年'),
    },
  ]
  const durationOpts: Opt[] = [
    {
      value: '1day',
      label: tt('devEnter.modelEdit.limitedDuration1Day', '1天'),
    },
    {
      value: '3day',
      label: tt('devEnter.modelEdit.limitedDuration3Day', '3天'),
    },
    {
      value: '7day',
      label: tt('devEnter.modelEdit.limitedDuration7Day', '7天'),
    },
    {
      value: '30day',
      label: tt('devEnter.modelEdit.limitedDuration30Day', '30天'),
    },
  ]
  const groupOpts: Opt[] = [
    {
      value: 'individual',
      label: tt('devEnter.modelEdit.targetGroupIndividual', '个人'),
    },
    {
      value: 'enterprise',
      label: tt('devEnter.modelEdit.targetGroupEnterprise', '企业'),
    },
  ]
  const discountOpts: Opt[] = [
    { value: 'none', label: tt('devEnter.modelEdit.discountNone', '不参与') },
    {
      value: 'partial',
      label: tt('devEnter.modelEdit.discountPartial', '部分参与'),
    },
    { value: 'full', label: tt('devEnter.modelEdit.discountFull', '全部参与') },
  ]

  const renderOpts = (
    opts: Opt[],
    current: string,
    onSelect: (v: string) => void,
  ) => (
    <View className="flex flex-wrap gap-[16rpx]">
      {opts.map((o) => (
        <View
          key={o.value}
          className={`${OPT_BASE} ${current === o.value ? OPT_ACTIVE : ''}`}
          onClick={() => onSelect(o.value)}
        >
          <Text>{o.label}</Text>
        </View>
      ))}
    </View>
  )

  const onSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    const formData = {
      agentId,
      agentName: agentInfo.name,
      categories: categories.join(','),
      department: DEPARTMENTS[deptIndex],
      saleType,
      chargePeriod: saleType === 'free' ? '' : chargePeriod,
      limitedDuration: saleType === 'limited' ? limitedDuration : '',
      targetGroup,
      discount: saleType === 'free' ? '' : discount,
      price: saleType === 'paid' ? price : '',
    }
    try {
      await post(`/developer/agents/${agentId}/charge`, formData)
      Taro.showToast({
        title: tt('devEnter.modelEdit.submitSuccess', '提交成功'),
        icon: 'success',
      })
    } catch (e) {
      logger.error('model-edit', '提交收费配置', e)
      Taro.showToast({
        title: tt('devEnter.modelEdit.mockSuccess', '接口暂未开放,已模拟提交'),
        icon: 'success',
      })
    } finally {
      setSubmitting(false)
      setTimeout(() => Taro.navigateBack(), 1200)
    }
  }

  return (
    <View className="min-h-screen bg-background flex flex-col">
      <View className="flex items-center p-[24rpx] bg-card gap-[24rpx]">
        <Text className="text-[28rpx] text-primary" onClick={() => Taro.navigateBack()}>
          {t('common.back')}
        </Text>
        <Text className="text-[34rpx] font-semibold text-foreground">
          {tt('devEnter.modelEdit.title', '编辑模型')}
        </Text>
      </View>

      <ScrollView scrollY className="flex-1 p-[24rpx] box-border">
        {/* 智能体信息 */}
        <View className="flex items-center bg-card p-[24rpx] rounded-[16rpx] mb-[16rpx] gap-[20rpx] border border-border">
          {agentInfo.avatar ? (
            <Image className="w-[88rpx] h-[88rpx] rounded-[16rpx] bg-secondary flex-shrink-0" src={agentInfo.avatar} mode="aspectFill" />
          ) : (
            <View className="w-[88rpx] h-[88rpx] rounded-[16rpx] bg-secondary flex-shrink-0 flex items-center justify-center text-primary text-[36rpx] font-semibold">
              <Text>{(agentInfo.name || '?').slice(0, 1)}</Text>
            </View>
          )}
          <View className="flex-1 overflow-hidden">
            <Text className="block text-[30rpx] font-semibold text-foreground">
              {agentInfo.name || tt('devEnter.modelEdit.model', '模型')}
            </Text>
            {agentInfo.prologue ? (
              <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden line-clamp-2">{agentInfo.prologue}</Text>
            ) : null}
          </View>
        </View>

        {loading ? <Text className="block text-[24rpx] text-muted-foreground text-center py-[16rpx]">{t('common.loading')}</Text> : null}

        {/* 1. 种类多选 */}
        <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">
          {tt('devEnter.modelEdit.categoryLabel', '种类（多选）')}
        </Text>
        <View className="flex flex-wrap gap-[16rpx]">
          {CATEGORIES.map((c) => (
            <View
              key={c}
              className={`${TAG_BASE} ${categories.includes(c) ? TAG_ACTIVE : ''}`}
              onClick={() => toggleCategory(c)}
            >
              <Text>{c}</Text>
            </View>
          ))}
        </View>

        {/* 2. 部门 */}
        <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">{tt('devEnter.modelEdit.departmentLabel', '部门')}</Text>
        <Picker
          mode="selector"
          range={DEPARTMENTS}
          value={deptIndex}
          onChange={(e) => setDeptIndex(Number(e.detail.value))}
        >
          <View className="flex items-center justify-between py-[20rpx] px-[24rpx] bg-card rounded-[12rpx] text-[28rpx] text-foreground border border-border">
            <Text>{DEPARTMENTS[deptIndex]}</Text>
            <Text className="text-muted-foreground text-[24rpx]">▾</Text>
          </View>
        </Picker>

        {/* 3. 售卖方式 */}
        <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">
          {tt('devEnter.modelEdit.saleTypeLabel', '售卖方式')}
        </Text>
        {renderOpts(saleTypeOpts, saleType, (v) => setSaleType(v as SaleType))}

        {/* 4. 收费周期 + 价格 (付费/限时免费时显示) */}
        {saleType !== 'free' ? (
          <View className="bg-card rounded-[16rpx] pt-[8rpx] px-[24rpx] pb-[24rpx] mt-[8rpx] border border-border">
            <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">
              {tt('devEnter.modelEdit.chargePeriodLabel', '收费周期')}
            </Text>
            {renderOpts(periodOpts, chargePeriod, (v) =>
              setChargePeriod(v as ChargePeriod),
            )}
            {saleType === 'paid' ? (
              <View className="mt-[8rpx]">
                <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">
                  {tt('devEnter.modelEdit.priceLabel', '价格')}
                </Text>
                <View className="flex items-center bg-secondary rounded-[12rpx] px-[20rpx] mt-[12rpx] border border-border">
                  <Text className="text-[32rpx] text-primary mr-[12rpx] font-semibold">¥</Text>
                  <Input
                    className="flex-1 h-[72rpx] text-[28rpx] text-foreground"
                    type="digit"
                    value={price}
                    placeholder={tt('devEnter.modelEdit.pricePlaceholder', '请输入价格')}
                    onInput={(e) => setPrice(e.detail.value)}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 5. 限时免费时限 (限时免费时显示) */}
        {saleType === 'limited' ? (
          <View>
            <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">
              {tt('devEnter.modelEdit.limitedDurationLabel', '限时免费时限')}
            </Text>
            {renderOpts(durationOpts, limitedDuration, (v) =>
              setLimitedDuration(v as LimitedDuration),
            )}
          </View>
        ) : null}

        {/* 6. 面向群体 */}
        <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">
          {tt('devEnter.modelEdit.targetGroupLabel', '面向群体')}
        </Text>
        {renderOpts(groupOpts, targetGroup, (v) =>
          setTargetGroup(v as TargetGroup),
        )}

        {/* 7. 折扣参与 (非免费时显示) */}
        {saleType !== 'free' ? (
          <View>
            <Text className="block text-[26rpx] text-muted-foreground mt-[24rpx] mb-[16rpx]">
              {tt('devEnter.modelEdit.discountLabel', '折扣参与')}
            </Text>
            {renderOpts(discountOpts, discount, (v) => setDiscount(v as Discount))}
          </View>
        ) : null}

        {/* 提交审核 */}
        <View
          className={`mt-[40rpx] p-[26rpx] bg-[linear-gradient(90deg,#00f2ff,#8b5cf6)] text-[#121217] text-center rounded-[16rpx] text-[30rpx] font-semibold ${submitting ? 'opacity-60' : ''}`}
          onClick={onSubmit}
        >
          <Text>
            {submitting
              ? tt('devEnter.modelEdit.submitting', '提交中…')
              : tt('devEnter.modelEdit.submit', '提交审核')}
          </Text>
        </View>
        <View className="h-[60rpx]" />
      </ScrollView>
    </View>
  )
}
