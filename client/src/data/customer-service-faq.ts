/**
 * 客服快捷 FAQ（与 AI 悬浮窗客服主题共用）
 */
export interface CustomerServiceFaqItem {
  id: number
  question: string
  answer: string
}

export const DEFAULT_CUSTOMER_SERVICE_FAQ: CustomerServiceFaqItem[] = [
  { id: 1, question: '如何修改账户密码？', answer: '请前往设置中心。' },
  { id: 2, question: 'API 调用失败怎么办？', answer: '请检查您的 API 令牌是否过期。' },
  { id: 3, question: '如何申请退款？', answer: '请提交工单申请。' },
]
