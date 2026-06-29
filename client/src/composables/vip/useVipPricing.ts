import { t } from '@/utils/i18n'

 
/**
 * VIP 定价管理 Composable
 *
 * 负责 VIP 定价计划、计费周期和价格计算逻辑
 *
 * @packageDocumentation
 */

import { ref, computed, onMounted } from 'vue'
import { getVipPackages } from '@/api/vip'

/**
 * 定价计划接口
 */
export interface PricingPlan {
  /** 计划 ID */
  id: number
  /** 计划名称 */
  name: string
  /** 计划描述 */
  description: string
  /** 月度价格 */
  monthlyPrice: number
  /** 年度价格 */
  yearlyPrice: number
  /** 是否有年度折扣 */
  yearlyDiscount: boolean
  /** 是否推荐 */
  recommended: boolean
  /** 计划特性 */
  features: {
    /** 特性分类名称 */
    name: string
    /** 特性项列表 */
    items: string[]
  }[]
}

/**
 * 计费周期类型
 */
export type BillingCycle = 'monthly' | 'yearly'

/**
 * VIP 定价管理 Composable
 *
 * @returns 返回定价计划、计费周期和相关方法
 *
 * @example
 * ```vue
 * <script setup>
const { t } = useI18n()

 * import { useVipPricing } from '@/composables/vip/useVipPricing'
 *
 * const { billingCycle, pricingPlans, getCurrentPrice, handleSelectPlan } = useVipPricing()
 * </script>
 *
 * <template>
 *   <el-radio-group v-model="billingCycle">
 *     <el-radio-button label="monthly">月付</el-radio-button>
 *     <el-radio-button label="yearly">年付</el-radio-button>
 *   </el-radio-group>
 *
 *   <div v-for="plan in pricingPlans" :key="plan.id">
 *     <h3>{{ plan.name }}</h3>
 *     <p>价格: ¥{{ getCurrentPrice(plan) }}</p>
 *     <el-button @click="handleSelectPlan(plan)">选择计划</el-button>
 *   </div>
 * </template>
 * ```
 */
export function useVipPricing() {
  const billingCycle = ref<BillingCycle>('monthly')
  const selectedPlan = ref<PricingPlan | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const defaultPricingPlans: PricingPlan[] = [
    {
      id: 1,
      name: t('text.use_vip_pricing.会员'),
      description: t('text.use_vip_pricing.适合个人用户和专'),
      monthlyPrice: 49,
      yearlyPrice: 588,
      yearlyDiscount: true,
      recommended: true,
      features: [
        {
          name: t('text.use_vip_pricing.会员功能'),
          items: [
            t('text.use_vip_pricing.无限次AI对话'),
            t('text.use_vip_pricing.图片生成'),
            t('text.use_vip_pricing.语音输入'),
            t('text.use_vip_pricing.文件上传'),
            t('text.use_vip_pricing.30天历史记录'),
            t('text.use_vip_pricing.专属客服'),
            t('text.use_vip_pricing.优先响应'),
            t('text.use_vip_pricing.高级模型访问'),
          ],
        },
        {
          name: t('text.use_vip_pricing.工具权限'),
          items: [
            t('text.use_vip_pricing.100+AI工具'),
            t('text.use_vip_pricing.专业模板库'),
            t('text.use_vip_pricing.大文件上传支持'),
            t('text.use_vip_pricing.优先体验新功能'),
          ],
        },
      ],
    },
    {
      id: 2,
      name: t('text.use_vip_pricing.操盘手'),
      description: t('text.use_vip_pricing.适合高级用户和团1'),
      monthlyPrice: 324,
      yearlyPrice: 3888,
      yearlyDiscount: true,
      recommended: false,
      features: [
        {
          name: t('text.use_vip_pricing.操盘手功能'),
          items: [
            t('text.use_vip_pricing.无限次AI对话'),
            t('text.use_vip_pricing.图片生成'),
            t('text.use_vip_pricing.视频生成'),
            t('text.use_vip_pricing.语音输入'),
            t('text.use_vip_pricing.文件上传'),
            t('text.use_vip_pricing.永久历史记录'),
            t('text.use_vip_pricing.专属客服'),
            t('text.use_vip_pricing.优先响应'),
            t('text.use_vip_pricing.高级模型访问'),
            t('text.use_vip_pricing.API访问'),
            t('text.use_vip_pricing.自定义模型'),
            t('text.use_vip_pricing.团队协作'),
            t('text.use_vip_pricing.数据导出'),
            t('text.use_vip_pricing.专属顾问'),
          ],
        },
        {
          name: t('text.use_vip_pricing.工具权限'),
          items: [
            t('text.use_vip_pricing.全部AI工具'),
            t('text.use_vip_pricing.企业模板库'),
            t('text.use_vip_pricing.无限文件上传'),
            t('text.use_vip_pricing.私有化部署'),
            t('text.use_vip_pricing.API接口访问'),
            t('text.use_vip_pricing.团队管理功能'),
            t('text.use_vip_pricing.数据安全审计'),
          ],
        },
      ],
    },
  ]

  const pricingPlans = ref<PricingPlan[]>(defaultPricingPlans)

  const fetchPricingPlans = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await getVipPackages() as { success?: boolean; data?: unknown }
      
      if (response.success && response.data && Array.isArray(response.data)) {
        const responseData = response.data as Array<Record<string, unknown>>
        if (responseData.length === 0) {
          pricingPlans.value = defaultPricingPlans
          return
        }
        pricingPlans.value = responseData.map((pkg: Record<string, unknown>) => {
          const pkgId = pkg.id || pkg.levelId || pkg.packageId
          const pkgPrice = pkg.price
          const pkgName = pkg.name || pkg.levelName || pkg.title || pkg.packageName || 'VIP会员'
          const pkgDesc = pkg.description || pkg.desc || pkg.packageDesc || ''
          const pkgFeatures = Array.isArray(pkg.features) ? pkg.features : [
            {
              name: '会员功能',
              items: Array.isArray(pkg.privileges) ? pkg.privileges : (Array.isArray(pkg.benefits) ? pkg.benefits : ['基础功能']),
            },
          ]
          return {
            id: typeof pkgId === 'number' ? pkgId : Number(pkgId || 0),
            name: typeof pkgName === 'string' ? pkgName : 'VIP会员',
            description: typeof pkgDesc === 'string' ? pkgDesc : '',
            monthlyPrice: typeof pkg.monthlyPrice === 'number' ? pkg.monthlyPrice : (typeof pkgPrice === 'number' ? pkgPrice : 0),
            yearlyPrice: typeof pkg.yearlyPrice === 'number' ? pkg.yearlyPrice : (typeof pkgPrice === 'number' ? pkgPrice * 10 : 0),
            yearlyDiscount: pkg.yearlyDiscount !== false,
            recommended: Boolean(pkg.recommended || pkg.isRecommended || false),
            features: pkgFeatures as Array<{ name: string; items: string[] }>,
          }
        })
      }
    } catch (_err: unknown) {
      pricingPlans.value = defaultPricingPlans
      error.value = null
    } finally {
      loading.value = false
    }
  }

  const getCurrentPrice = (plan: PricingPlan): number => {
    if (billingCycle.value === 'yearly') {
      return plan.yearlyPrice
    }
    return plan.monthlyPrice
  }

  const getDiscountAmount = (plan: PricingPlan): number => {
    if (billingCycle.value === 'yearly' && plan.yearlyDiscount) {
      return plan.monthlyPrice * 12 - plan.yearlyPrice
    }
    return 0
  }

  const getRecommendedPlan = computed(() => {
    return pricingPlans.value.find(plan => plan.recommended) || null
  })

  const handleSelectPlan = (plan: PricingPlan): void => {
    selectedPlan.value = plan
  }

  const handleQuickUpgrade = (): void => {
    const recommendedPlan = getRecommendedPlan.value
    if (recommendedPlan) {
      selectedPlan.value = recommendedPlan
    }
  }

  const scrollToPlans = (): void => {
    const plansElement = document.getElementById('pricing-plans')
    if (plansElement) {
      plansElement.scrollIntoView({ behavior: 'smooth' })
    }
  }

  onMounted(() => {
    void fetchPricingPlans()
  })

  return {
    billingCycle,
    selectedPlan,
    pricingPlans,
    loading,
    error,
    fetchPricingPlans,
    getRecommendedPlan,
    getCurrentPrice,
    getDiscountAmount,
    handleSelectPlan,
    handleQuickUpgrade,
    scrollToPlans,
  }
}
