/**
 * 客服 FAQ 数据 — 迁移自旧架构 client/src/data/customer-service-faq.ts
 * 导出客服常见问题列表常量，供客服中心页面/工单引导使用
 */

export interface FaqItem {
  /** FAQ 唯一标识 */
  id: string
  /** 分类标识 */
  category: string
  /** 问题 */
  question: string
  /** 答案 */
  answer: string
  /** 关键词，用于检索匹配 */
  keywords: string[]
  /** 是否置顶 */
  pinned?: boolean
}

export interface FaqCategory {
  /** 分类标识 */
  id: string
  /** 分类名称 */
  name: string
  /** 排序权重，越小越靠前 */
  sortOrder: number
}

/** FAQ 分类 */
export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'account', name: '账号与登录', sortOrder: 1 },
  { id: 'billing', name: '会员与计费', sortOrder: 2 },
  { id: 'usage', name: '功能使用', sortOrder: 3 },
  { id: 'ai', name: 'AI 对话', sortOrder: 4 },
  { id: 'security', name: '账号安全', sortOrder: 5 },
  { id: 'other', name: '其他', sortOrder: 99 },
]

/** 客服 FAQ 列表 */
export const FAQ_LIST: FaqItem[] = [
  {
    id: 'faq-001',
    category: 'account',
    question: '如何注册 IHUI-AI 账号？',
    answer:
      '点击登录页的「注册」按钮，支持手机号、邮箱注册，也可使用微信/Google 第三方登录。注册后需完成手机或邮箱验证。',
    keywords: ['注册', '账号', 'sign up', '注册账号'],
    pinned: true,
  },
  {
    id: 'faq-002',
    category: 'account',
    question: '忘记密码怎么办？',
    answer:
      '在登录页点击「忘记密码」，输入注册手机号或邮箱，按提示完成验证后重置密码。若收不到验证码，请联系客服。',
    keywords: ['忘记密码', '重置密码', '找回密码', 'password'],
  },
  {
    id: 'faq-003',
    category: 'billing',
    question: 'VIP 会员有哪些权益？',
    answer:
      'VIP 会员享有更高 AI 对话额度、优先客服、专属模型、去广告等权益。具体权益可在「会员中心」查看，不同等级权益不同。',
    keywords: ['vip', '会员', '权益', 'membership'],
    pinned: true,
  },
  {
    id: 'faq-004',
    category: 'billing',
    question: '如何申请退款？',
    answer:
      '在「订单中心」找到对应订单，点击「申请退款」并填写原因。虚拟商品退款需在购买后 7 天内且未使用额度申请，审核通过后原路退回。',
    keywords: ['退款', '退费', 'refund'],
  },
  {
    id: 'faq-005',
    category: 'usage',
    question: 'AI 对话额度用完了怎么办？',
    answer:
      '每日额度会在次日 0 点重置；如需更多额度，可升级 VIP 会员或购买额度包。会员额度按月发放。',
    keywords: ['额度', '次数', 'quota', '用完'],
  },
  {
    id: 'faq-006',
    category: 'ai',
    question: 'AI 回答不准确怎么办？',
    answer:
      'AI 生成内容可能存在误差，建议：1) 补充更详细的上下文；2) 切换模型；3) 对关键信息进行人工核实。重要决策请勿完全依赖 AI。',
    keywords: ['不准确', '错误', '幻觉', '模型', '回答'],
  },
  {
    id: 'faq-007',
    category: 'ai',
    question: '支持哪些 AI 模型？',
    answer:
      '平台支持多家厂商的主流大模型，包括 GPT、Claude、Gemini 及国产模型。具体可用模型可在「模型广场」查看，VIP 会员可使用更多高级模型。',
    keywords: ['模型', 'model', 'gpt', 'claude', 'gemini'],
  },
  {
    id: 'faq-008',
    category: 'security',
    question: '如何保护账号安全？',
    answer:
      '建议：1) 开启两步验证（TOTP）；2) 使用强密码并定期更换；3) 不在公共设备保存登录状态；4) 警惕钓鱼信息，平台不会索要密码。',
    keywords: ['安全', '两步验证', 'totp', '密码', 'security'],
    pinned: true,
  },
  {
    id: 'faq-009',
    category: 'other',
    question: '如何联系人工客服？',
    answer:
      '在「帮助中心」点击右下角悬浮客服按钮，或提交工单。客服工作时间为 9:00-22:00，紧急问题请优先提交工单。',
    keywords: ['人工客服', '联系客服', '工单', '客服'],
  },
]

/** 按 ID 查询 FAQ */
export function findFaqById(id: string): FaqItem | undefined {
  return FAQ_LIST.find((item) => item.id === id)
}

/** 按分类筛选 FAQ */
export function findFaqsByCategory(categoryId: string): FaqItem[] {
  return FAQ_LIST.filter((item) => item.category === categoryId)
}

/** 关键词检索 FAQ（命中 question / answer / keywords） */
export function searchFaqs(keyword: string): FaqItem[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return FAQ_LIST
  return FAQ_LIST.filter((item) => {
    return (
      item.question.toLowerCase().includes(kw) ||
      item.answer.toLowerCase().includes(kw) ||
      item.keywords.some((k) => k.toLowerCase().includes(kw))
    )
  })
}
