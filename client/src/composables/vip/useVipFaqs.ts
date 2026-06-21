 
/**
 * VIP FAQ 管理 Composable
 *
 * 负责 VIP FAQ 数据的管理和 HTML 内容清理
 *
 * @packageDocumentation
 */

import { ref } from 'vue'
import DOMPurify from 'dompurify'

/**
 * FAQ 接口
 */
export interface Faq {
  /** FAQ ID */
  id: string
  /** 问题 */
  question: string
  /** 答案 */
  answer: string
}

/**
 * VIP FAQ 管理 Composable
 *
 * @returns 返回 FAQ 列表、激活状态和 HTML 清理方法
 *
 * @example
 * ```vue
 * <script setup>
 * import { useVipFaqs } from '@/composables/vip/useVipFaqs'
 *
 * const { faqs, activeFaq, sanitizeHtml } = useVipFaqs()
 * </script>
 *
 * <template>
 *   <el-collapse v-model="activeFaq">
 *     <el-collapse-item
 *       v-for="faq in faqs"
 *       :key="faq.id"
 *       :name="faq.id"
 *       :title="faq.question"
 *     >
 *       <div v-html="sanitizeHtml(faq.answer)"></div>
 *     </el-collapse-item>
 *   </el-collapse>
 * </template>
 * ```
 */
export function useVipFaqs() {
  const activeFaq = ref<string[]>(['1'])

  const faqs = ref<Faq[]>([
    {
      id: '1',
      question: 'VIP会员有什么特权？',
      answer:
        'VIP会员可以享受无限制使用所有AI工具、优先响应速度、访问最新AI模型、专属客服支持、每月免费Token等多项特权。',
    },
    {
      id: '2',
      question: '如何升级VIP会员？',
      answer:
        '您可以在本页面选择合适的套餐，点击"立即开通"按钮，选择支付方式完成支付即可升级为VIP会员。',
    },
    {
      id: '3',
      question: 'VIP会员可以退款吗？',
      answer: '我们提供7天无理由退款保障。如果您在开通VIP后7天内不满意，可以申请全额退款。',
    },
    {
      id: '4',
      question: '年付和月付有什么区别？',
      answer: '年付享受8折优惠，相比月付可以节省20%的费用。同时年付用户还可以享受更多专属福利。',
    },
    {
      id: '5',
      question: 'VIP会员到期后会怎样？',
      answer:
        '会员到期后，您的账户会自动降级为普通用户，但之前的使用记录和数据会保留。您可以随时续费恢复VIP特权。',
    },
    {
      id: '6',
      question: '可以更换套餐吗？',
      answer:
        '可以的。您可以随时升级到更高级的套餐，差价会按比例计算。降级套餐需要等到当前周期结束。',
    },
  ])

  const sanitizeHtml = (html: string): string => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'span'],
      ALLOWED_ATTR: ['class'],
    })
  }

  return {
    activeFaq,
    faqs,
    sanitizeHtml,
  }
}
