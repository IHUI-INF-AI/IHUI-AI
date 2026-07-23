import { logger } from '@/utils/logger'
import { View, Text, Input, Picker, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

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
    <View className="me-opt-group">
      {opts.map((o) => (
        <View
          key={o.value}
          className={`me-opt ${current === o.value ? 'me-opt-active' : ''}`}
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
    <View className="me-page">
      <View className="me-header">
        <Text className="me-back" onClick={() => Taro.navigateBack()}>
          {t('common.back')}
        </Text>
        <Text className="me-title">
          {tt('devEnter.modelEdit.title', '编辑模型')}
        </Text>
      </View>

      <ScrollView scrollY className="me-body">
        {/* 智能体信息 */}
        <View className="me-agent">
          {agentInfo.avatar ? (
            <Image className="me-avatar" src={agentInfo.avatar} mode="aspectFill" />
          ) : (
            <View className="me-avatar me-avatar-ph">
              <Text>{(agentInfo.name || '?').slice(0, 1)}</Text>
            </View>
          )}
          <View className="me-agent-info">
            <Text className="me-agent-name">
              {agentInfo.name || tt('devEnter.modelEdit.model', '模型')}
            </Text>
            {agentInfo.prologue ? (
              <Text className="me-agent-desc">{agentInfo.prologue}</Text>
            ) : null}
          </View>
        </View>

        {loading ? <Text className="me-loading">{t('common.loading')}</Text> : null}

        {/* 1. 种类多选 */}
        <Text className="me-label">
          {tt('devEnter.modelEdit.categoryLabel', '种类（多选）')}
        </Text>
        <View className="me-tag-bar">
          {CATEGORIES.map((c) => (
            <View
              key={c}
              className={`me-tag ${categories.includes(c) ? 'me-tag-active' : ''}`}
              onClick={() => toggleCategory(c)}
            >
              <Text>{c}</Text>
            </View>
          ))}
        </View>

        {/* 2. 部门 */}
        <Text className="me-label">{tt('devEnter.modelEdit.departmentLabel', '部门')}</Text>
        <Picker
          mode="selector"
          range={DEPARTMENTS}
          value={deptIndex}
          onChange={(e) => setDeptIndex(Number(e.detail.value))}
        >
          <View className="me-picker">
            <Text>{DEPARTMENTS[deptIndex]}</Text>
            <Text className="me-picker-arrow">▾</Text>
          </View>
        </Picker>

        {/* 3. 售卖方式 */}
        <Text className="me-label">
          {tt('devEnter.modelEdit.saleTypeLabel', '售卖方式')}
        </Text>
        {renderOpts(saleTypeOpts, saleType, (v) => setSaleType(v as SaleType))}

        {/* 4. 收费周期 + 价格 (付费/限时免费时显示) */}
        {saleType !== 'free' ? (
          <View className="me-card">
            <Text className="me-label">
              {tt('devEnter.modelEdit.chargePeriodLabel', '收费周期')}
            </Text>
            {renderOpts(periodOpts, chargePeriod, (v) =>
              setChargePeriod(v as ChargePeriod),
            )}
            {saleType === 'paid' ? (
              <View className="me-price-row">
                <Text className="me-label">
                  {tt('devEnter.modelEdit.priceLabel', '价格')}
                </Text>
                <View className="me-price-input">
                  <Text className="me-yuan">¥</Text>
                  <Input
                    className="me-input"
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
            <Text className="me-label">
              {tt('devEnter.modelEdit.limitedDurationLabel', '限时免费时限')}
            </Text>
            {renderOpts(durationOpts, limitedDuration, (v) =>
              setLimitedDuration(v as LimitedDuration),
            )}
          </View>
        ) : null}

        {/* 6. 面向群体 */}
        <Text className="me-label">
          {tt('devEnter.modelEdit.targetGroupLabel', '面向群体')}
        </Text>
        {renderOpts(groupOpts, targetGroup, (v) =>
          setTargetGroup(v as TargetGroup),
        )}

        {/* 7. 折扣参与 (非免费时显示) */}
        {saleType !== 'free' ? (
          <View>
            <Text className="me-label">
              {tt('devEnter.modelEdit.discountLabel', '折扣参与')}
            </Text>
            {renderOpts(discountOpts, discount, (v) => setDiscount(v as Discount))}
          </View>
        ) : null}

        {/* 提交审核 */}
        <View
          className={`me-submit ${submitting ? 'me-submit-disabled' : ''}`}
          onClick={onSubmit}
        >
          <Text>
            {submitting
              ? tt('devEnter.modelEdit.submitting', '提交中…')
              : tt('devEnter.modelEdit.submit', '提交审核')}
          </Text>
        </View>
        <View className="me-bottom-space" />
      </ScrollView>
    </View>
  )
}
