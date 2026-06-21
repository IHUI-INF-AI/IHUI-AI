import { t } from '@/utils/i18n'

 
/**
 * VIP 用户评价管理 Composable
 *
 * 负责 VIP 用户评价数据的配置和管理
 *
 * @packageDocumentation
 */

import { ref } from 'vue'

/**
 * 用户评价接口
 */
export interface Testimonial {
  /** 评价 ID */
  id: number
  /** 用户名称 */
  name: string
  /** 用户职位 */
  title: string
  /** 用户头像 */
  avatar: string
  /** 评分 (1-5) */
  rating: number
  /** 评价内容 */
  content: string
}

/**
 * VIP 用户评价管理 Composable
 *
 * @returns 返回用户评价列表
 *
 * @example
 * ```vue
 * <script setup>
 * import { useVipTestimonials } from '@/composables/vip/useVipTestimonials'
 *
 * const { testimonials } = useVipTestimonials()
 * </script>
 *
 * <template>
 *   <div v-for="testimonial in testimonials" :key="testimonial.id">
 *     <img :src="testimonial.avatar" :alt="testimonial.name" />
 *     <h4>{{ testimonial.name }}</h4>
 *     <p>{{ testimonial.content }}</p>
 *     <el-rate :model-value="testimonial.rating" disabled />
 *   </div>
 * </template>
 * ```
 */
export function useVipTestimonials() {
  const testimonials = ref<Testimonial[]>([
    {
      id: 1,
      name: '张先生',
      title: t('text.use_vip_testimonials.产品经理'),
      avatar: '',
      rating: 5,
      content:
        t('text.use_vip_testimonials.VIP会员真的很1'),
    },
    {
      id: 2,
      name: '李女士',
      title: t('text.use_vip_testimonials.内容创作者2'),
      avatar: '',
      rating: 5,
      content:
        t('text.use_vip_testimonials.作为内容创作者A3'),
    },
    {
      id: 3,
      name: '王先生',
      title: t('text.use_vip_testimonials.程序员4'),
      avatar: '',
      rating: 5,
      content: t('text.use_vip_testimonials.代码生成和优化工5'),
    },
  ])

  return {
    testimonials,
  }
}
