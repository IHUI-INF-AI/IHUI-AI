import { t } from '@/utils/i18n'

 
/**
 * VIP 权益管理 Composable
 *
 * 负责 VIP 会员权益列表的配置和管理
 *
 * @packageDocumentation
 */

import { ref, markRaw } from 'vue'
import {
  Gift as Promotion,
  Zap as Lightning,
  Target as Aim,
  Gift as Present,
  Headphones as Headset,
  Coins as Coin,
} from '@/lib/lucide-fallback'

/**
 * VIP 权益接口
 */
export interface VipBenefit {
  /** 权益 ID */
  id: number
  /** 权益图标 */
  icon: any
  /** 权益标题 */
  title: string
  /** 权益描述 */
  description: string
  /** 权益颜色 */
  color: string
  /** 权益特性列表 */
  features: string[]
}

/**
 * VIP 权益管理 Composable
 *
 * @returns 返回 VIP 权益列表
 *
 * @example
 * ```vue
 * <script setup>
 * import { useVipBenefits } from '@/composables/vip/useVipBenefits'
 *
 * const { vipBenefits } = useVipBenefits()
 * </script>
 *
 * <template>
 *   <div v-for="benefit in vipBenefits" :key="benefit.id">
 *     <h3>{{ benefit.title }}</h3>
 *     <p>{{ benefit.description }}</p>
 *   </div>
 * </template>
 * ```
 */
export function useVipBenefits() {
  const vipBenefits = ref<VipBenefit[]>([
    {
      id: 1,
      icon: markRaw(Promotion),
      title: t('text.use_vip_benefits.无限制使用'),
      description: t('text.use_vip_benefits.所有AI工具无限1'),
      color: 'var(--el-color-primary)',
      features: ['无限次AI对话', '无限制工具使用', '无限文件上传', '无限历史记录'],
    },
    {
      id: 2,
      icon: markRaw(Lightning),
      title: t('text.use_vip_benefits.优先处理2'),
      description: t('text.use_vip_benefits.享受更快的响应速3'),
      color: 'var(--el-color-primary)',
      features: ['优先队列处理', '更快响应速度', '高峰期优先', '专用服务器'],
    },
    {
      id: 3,
      icon: markRaw(Aim),
      title: t('text.use_vip_benefits.专属模型4'),
      description: t('text.use_vip_benefits.访问最新最强的A5'),
      color: 'var(--el-color-primary)',
      features: ['GPT-4 Turbo', 'Claude-3 Opus', '最新模型优先体验', '专属模型定制'],
    },
    {
      id: 4,
      icon: markRaw(Present),
      title: t('text.use_vip_benefits.专属福利6'),
      description: t('text.use_vip_benefits.丰富的会员专属福7'),
      color: 'var(--el-color-primary)',
      features: ['每月免费Token', '生日专属礼品', '节日特别优惠', '新功能抢先体验'],
    },
    {
      id: 5,
      icon: markRaw(Headset),
      title: t('text.use_vip_benefits.专属客服8'),
      description: t('text.use_vip_benefits.724小时专属客9'),
      color: 'var(--el-color-primary)',
      features: ['24小时在线客服', '专属客服经理', '优先问题处理', '电话技术支持'],
    },
    {
      id: 6,
      icon: markRaw(Coin),
      title: t('text.use_vip_benefits.数据安全10'),
      description: t('text.use_vip_benefits.企业级数据安全保11'),
      color: 'var(--el-color-primary)',
      features: ['数据加密存储', '隐私保护升级', '数据备份服务', '安全审计报告'],
    },
  ])

  return {
    vipBenefits,
  }
}
