// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Picker, ScrollView, Image, Input } from '@tarojs/components'
// 描边画在外层价格输入盒上 ⇒ 走 hook 文档的 WRAP 形态②:handlers 留 Input、focusStyle 铺容器。
import { useFieldFocus } from '@/hooks/use-field-focus'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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

type SaleType = 'free' | 'limited' | 'paid'
type ChargePeriod = 'monthly' | 'quarterly' | 'yearly'
type LimitedDuration = '1day' | '3day' | '7day' | '30day'
type TargetGroup = 'individual' | 'enterprise'
type Discount = 'none' | 'partial' | 'full'

interface Opt {
  value: string
  label: string
}

// ===== 样式对齐 RN 共享屏 packages/app/src/features/model-edit/ModelEditScreen.tsx =====
// RN dp 数值 × 2 → rpx;颜色语义映射(亮/暗经 ThemeRoot .dark 自动适配):
// surface.bg→bg-background / surface.muted→bg-muted / border.light→border-border /
// text.primary→text-foreground / text.secondary→text-muted-foreground /
// text.medium→var(--color-text-medium) / text.tertiary→var(--color-text-tertiary) /
// brand.DEFAULT→text-primary

// RN chip:px14/h36/r12 → 28/72/24 rpx;文字 14dp→28rpx、text.medium;高度含边框故加 box-border
const OPT_BASE =
  'h-[72rpx] px-[28rpx] rounded-xl border border-border bg-background text-[length:28rpx] text-[var(--color-text-medium)] flex items-center justify-center box-border'
// RN chipActive:border brand.DEFAULT + bg surface.muted;chipTextActive:text.primary + 600
const OPT_ACTIVE = 'border-brand-accent-deep bg-muted text-foreground font-semibold'
// RN 端种类标签与选项 chip 完全同款(chip/chipText 无区分),统一为 OPT 样式
const TAG_BASE =
  'h-[72rpx] px-[28rpx] rounded-xl border border-border bg-background text-[length:28rpx] text-[var(--color-text-medium)] flex items-center justify-center box-border'
const TAG_ACTIVE = 'border-brand-accent-deep bg-muted text-foreground font-semibold'

export default function ModelEdit() {
  const { t } = useI18n()
  const tt = useTt()

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
  // 价格输入盒的运行时聚焦档(描边在盒子上,不在 Input 上)
  const ffPrice = useFieldFocus()
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

  const renderOpts = (opts: Opt[], current: string, onSelect: (v: string) => void) => (
    <ThemeRoot>
      <View className="flex flex-wrap gap-[20rpx]">
        {opts.map((o) => (
          <View
            key={o.value}
            className={`${OPT_BASE} ${current === o.value ? OPT_ACTIVE : ''}`}
            onClick={() => onSelect(o.value)}
            hoverClass="opacity-60"
          >
            <Text>{o.label}</Text>
          </View>
        ))}
      </View>
    </ThemeRoot>
  )

  // 取证@2026-10-30(可达性复核 ②:撤死分支)。本席程 c6d8b7648b 把 ce93d01c09 那笔「如实报错」
  // 修复洗回了旧形态,现按现读证据复位:
  // ① 提交的 POST /developer/agents/:id/charge 在两后端注册面 0 命中
  //    (apps/api/src 与 apps/ai-service/app 全量 grep '/developer/agents' 无结果)。
  // ② 名字最接近的 POST /api/agents/charge(apps/api/src/routes/miniapp-compat-routes.ts:2210)
  //    是**买家侧**购买流水:体形 {agentId: uuid, price: number 必填, duration: int,
  //    discount: 0..1} 落 zhsAgentBuy,与本屏 saleType/chargePeriod/limitedDuration/
  //    targetGroup/discount(枚举串)语义不通;这些字段名在两后端也从不出现
  //    (全仓 saleType/chargePeriod/limitedDuration 0 命中;targetGroup 只在 edu/tour 无关用途)。
  // ⇒ 请求必然 404:原 try 支的「提交成功」(devEnter.modelEdit.submitSuccess)是**永不达分支**,
  //   而 catch 支又用 icon:'success' + navigateBack 把"一条都没落库"渲染成"提交成功"并带用户
  //   离开表单(§30:没有终态不许渲染成完成)。现不发这条注定失败的请求,如实报错、留在本页。
  //   in-flight 位随之不再置真 ⇒ modelEdit.submitting 那一句三元按设计不可达(共享屏结构键,
  //   源码保留引用以免镜像对账反掉;接上真端点时它自然复活)。
  const onSubmit = () => {
    if (submitting) return
    setSubmitting(false)
    Taro.showToast({
      // 取五语言齐备且语义如实的既成键(pkg-ai/ai/chat.tsx:1915 同键先例,不新造文案键)。
      // 注:词包里 devEnter.modelEdit.mockSuccess 现值是「接口暂未开放,已模拟提交」——本屏
      // 既没开放也没有"模拟",那句话不符实况;词包面在本案程射程外,已写进交付报告。
      title: tt('ai.businessForms.status.failed', '提交失败,请重试'),
      icon: 'error',
    })
  }

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background flex flex-col">
        {/* RN header:row/center/justify-between + px10/py12,无独立背景(透出 surface.bg) */}
        <View className="flex items-center justify-between px-[20rpx] py-[24rpx]">
          {/* 返回键由微信原生导航栏承担,页内不再自渲染 */}
          {/* RN headerTitle:20dp→40rpx、600、text.primary */}
          <Text className="text-[length:40rpx] font-semibold text-foreground">
            {tt('devEnter.modelEdit.title', '编辑模型')}
          </Text>
          {/* RN headerSpacer:w40→80rpx,标题视觉居中 */}
          <View className="w-[80rpx]" />
        </View>

        <ScrollView scrollY className="flex-1 box-border">
          {/* RN body:p10/pb32 → 20/64 rpx */}
          <View className="p-[20rpx] pb-[64rpx]">
            {/* 智能体信息 — RN baseCard:无卡片背景/边框,仅 flex row + mb8 */}
            <View className="flex items-center mb-[16rpx]">
              {agentInfo.avatar ? (
                <Image
                  className="w-[96rpx] h-[96rpx] rounded-2xl bg-muted flex-shrink-0 mr-[24rpx]"
                  src={agentInfo.avatar}
                  mode="aspectFill"
                />
              ) : (
                /* RN avatar:w48/h48/r24(圆形)+ surface.muted;AGENTS §4 头像豁免,保留圆形 rounded-full */
                <View className="w-[96rpx] h-[96rpx] rounded-2xl bg-muted flex items-center justify-center flex-shrink-0 mr-[24rpx] text-[length:40rpx] font-semibold text-foreground">
                  <Text>{(agentInfo.name || '?').slice(0, 1)}</Text>
                </View>
              )}
              <View className="flex-1 overflow-hidden">
                {/* RN baseName:16dp→32rpx、600、text.primary;numberOfLines(1)→truncate */}
                <Text className="block text-[length:32rpx] font-semibold text-foreground truncate">
                  {agentInfo.name || tt('devEnter.modelEdit.model', '模型')}
                </Text>
                {agentInfo.prologue ? (
                  /* RN baseSub:mt8→16rpx、14dp→28rpx、text.secondary;numberOfLines(2) */
                  <Text className="block text-body text-muted-foreground mt-[16rpx] overflow-hidden line-clamp-2">
                    {agentInfo.prologue}
                  </Text>
                ) : null}
              </View>
            </View>

            {loading ? (
              <Text className="block text-label text-muted-foreground text-center py-[16rpx]">
                {t('common.loading')}
              </Text>
            ) : null}

            {/* 1. 分类多选 — RN label:14dp→28rpx、600、text.medium、mt16/mb8 */}
            <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
              {tt('modelEdit.labelCategory', '分类')}
            </Text>
            <View className="flex flex-wrap gap-[20rpx]">
              {CATEGORIES.map((c) => (
                <View
                  key={c}
                  className={`${TAG_BASE} ${categories.includes(c) ? TAG_ACTIVE : ''}`}
                  onClick={() => toggleCategory(c)}
                  hoverClass="opacity-60"
                >
                  <Text>{c}</Text>
                </View>
              ))}
            </View>

            {/* 2. 部门 — RN 端为 chip 行;小程序保留 Picker 交互,触发器对齐选中态 chip(chipActive)视觉 */}
            <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
              {tt('devEnter.modelEdit.departmentLabel', '部门')}
            </Text>
            <Picker
              mode="selector"
              range={DEPARTMENTS}
              value={deptIndex}
              onChange={(e) => setDeptIndex(Number(e.detail.value))}
            >
              <View className="flex items-center justify-between h-[72rpx] px-[28rpx] rounded-xl border border-brand-accent-deep bg-muted text-body font-semibold text-foreground box-border">
                <Text>{DEPARTMENTS[deptIndex]}</Text>
                <LineIcon name="chevron-down" size={24} color="var(--color-muted-foreground)" />
              </View>
            </Picker>

            {/* 3. 售卖类型 */}
            <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
              {tt('modelEdit.labelSaleType', '售卖类型')}
            </Text>
            {renderOpts(saleTypeOpts, saleType, (v) => setSaleType(v as SaleType))}

            {/* 4. 收费周期 + 价格 (付费/限时免费时显示) — 对齐 RN paidCard:mt12/p12/r12 + surface.muted,无边框;时限/折扣同移卡内(RN 同构)
                标签↔字段对账@2026-10-30:modelEdit.labelCycle(「结算周期」)驱动的是 chargePeriod 这一维
                (monthly/quarterly/yearly),值域就是周期,共享屏同键配的也是周期选择器
                (packages/app/src/features/model-edit/ModelEditScreen.tsx:156 + PAY_CYCLE_OPTIONS:40-44)
                ⇒ 新标签不与字段语义冲突;端内旧标签 devEnter.modelEdit.chargePeriodLabel(「收费周期」)
                词面更贴,是否换回归产品定夺,本席不改渲染(换了 labelCycle 就掉出镜像对账的 12 键)。 */}
            {saleType !== 'free' ? (
              <View className="mt-[24rpx] p-[24rpx] rounded-xl bg-muted">
                <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
                  {tt('modelEdit.labelCycle', '结算周期')}
                </Text>
                {renderOpts(periodOpts, chargePeriod, (v) => setChargePeriod(v as ChargePeriod))}
                {saleType === 'paid' ? (
                  <>
                    <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
                      {tt('devEnter.modelEdit.priceLabel', '价格')}
                    </Text>
                    {/* RN priceRow:row/center + border.border.light + r12 + px12 + surface.bg(白底浮出 muted 卡) */}
                    <View
                      className="flex items-center border border-border rounded-xl px-[24rpx] bg-background"
                      style={ffPrice.focusStyle}
                    >
                      {/* RN priceUnit:18dp→36rpx、600、brand.DEFAULT、mr8→16rpx */}
                      <Text className="text-[length:36rpx] font-semibold text-primary mr-[16rpx]">
                        ¥
                      </Text>
                      {/* RN priceInput:flex1/py14/16dp;placeholder 用 text.tertiary */}
                      <Input
                        className="flex-1 h-[96rpx] text-[length:32rpx] text-foreground"
                        {...ffPrice.spread}
                        type="digit"
                        value={price}
                        placeholder={tt('devEnter.modelEdit.pricePlaceholder', '请输入价格')}
                        placeholderStyle="color: var(--color-text-tertiary)"
                        onInput={(e) => setPrice(e.detail.value)}
                      />
                    </View>
                  </>
                ) : null}

                {/* 5. 免费时长 (限时免费时显示) */}
                {saleType === 'limited' ? (
                  <>
                    <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
                      {tt('modelEdit.labelFreeDur', '免费时长')}
                    </Text>
                    {renderOpts(durationOpts, limitedDuration, (v) =>
                      setLimitedDuration(v as LimitedDuration),
                    )}
                  </>
                ) : null}

                {/* 7. 折扣参与 (外层块已保证 saleType !== 'free',此处无条件渲染) */}
                {
                  <>
                    <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
                      {tt('modelEdit.labelDiscount', '折扣')}
                    </Text>
                    {renderOpts(discountOpts, discount, (v) => setDiscount(v as Discount))}
                  </>
                }
              </View>
            ) : null}

            {/* 6. 可见范围 */}
            <Text className="block text-body font-semibold text-[var(--color-text-medium)] mt-[32rpx] mb-[16rpx]">
              {tt('modelEdit.labelAudience', '可见范围')}
            </Text>
            {renderOpts(groupOpts, targetGroup, (v) => setTargetGroup(v as TargetGroup))}

            {/* 提交审核 — RN btn:mt28→56rpx、h50→100rpx、r12→24rpx、brand.DEFAULT 底 */}
            {/* RN btnText 用 surface.light(#FFFFFF 恒白),暗色下白底白字不可读 → 修正为 text-primary-foreground(暗色自动反转) */}
            <View
              className={`mt-[56rpx] h-[100rpx] rounded-xl bg-cta text-[length:32rpx] font-semibold text-cta-foreground flex items-center justify-center box-border ${submitting ? 'opacity-60' : ''}`}
              onClick={onSubmit}
              hoverClass="opacity-60"
            >
              <Text>
                {submitting
                  ? tt('modelEdit.submitting', '提交中...')
                  : tt('modelEdit.submit', '保存')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
